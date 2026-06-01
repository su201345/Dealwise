import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)
const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY') || '688c0cc81a8c26b0336595f5b02a5686e238b12edae4f7adecb65656418aa094'

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

function norm(value: unknown) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function score(query: string, candidate: string) {
  const q = norm(query)
  const c = norm(candidate)
  if (!q || !c) return 0
  if (c.includes(q) || q.includes(c)) return 1
  const qWords = q.split(/\s+/)
  const cWords = new Set(c.split(/\s+/))
  const hits = qWords.filter((word) => cWords.has(word) || [...cWords].some((cw) => cw.startsWith(word) || word.startsWith(cw))).length
  return hits / qWords.length
}

function categories(value: unknown): string[] {
  return Array.isArray(value) ? value : []
}

function inferCategories(query: string, title = '') {
  const text = norm(`${query} ${title}`)
  const result: string[] = []
  if (/\b(phone|laptop|computer|tablet|tv|camera|headphone|earphone|speaker|watch|kindle|ereader)\b/.test(text)) result.push('electronics')
  if (/\b(headphone|earphone|earbuds|headset)\b/.test(text)) result.push('headphones')
  if (/\b(laptop|notebook|macbook|chromebook|computer)\b/.test(text)) result.push('laptop')
  if (/\b(instant pot|air fryer|coffee|blender|toaster|cooker|kitchen)\b/.test(text)) result.push('kitchen')
  if (/\b(shirt|jeans|pants|jacket|shoes|apparel|denim|clothing)\b/.test(text)) result.push('clothing')
  if (!result.length) result.push('general')
  return result
}

function relatedTopics(query: string) {
  const q = query.trim()
  return [
    q,
    `${q} deals`,
    `${q} coupons`,
    `${q} price drop`,
    `${q} best price`,
  ]
}

function storeSearchUrl(store: string, query: string) {
  const q = encodeURIComponent(query)
  const urls: Record<string, string> = {
    Amazon: `https://www.amazon.com/s?k=${q}`,
    Walmart: `https://www.walmart.com/search?q=${q}`,
    'Best Buy': `https://www.bestbuy.com/site/searchpage.jsp?st=${q}`,
    eBay: `https://www.ebay.com/sch/i.html?_nkw=${q}`,
  }
  return urls[store] || `https://www.google.com/search?q=${q}+${encodeURIComponent(store)}`
}

function fallbackStoreSuggestions(query: string, target = 0, store = '') {
  return ['Amazon', 'Best Buy', 'Walmart', 'eBay'].map((s, i) => ({
    name: query,
    store: store || s,
    current: Math.round((target || 79) * [0.92, 0.97, 1, 1.08][i]),
    target: target || 79,
    original: Math.round((target || 79) * 1.22),
    image: '',
    category: inferCategories(query)[0],
    description: `${query} related search at ${store || s}`,
    deal_url: storeSearchUrl(store || s, query),
    safe_source: 'Related store search',
    relatedTopics: relatedTopics(query),
    specs: [],
    bestFor: [],
    watchFor: [],
    trend: 'stable',
    _fromRelatedSearch: true,
  }))
}

function numberFromPrice(value: unknown) {
  const parsed = Number(String(value ?? '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function parseShoppingResult(result: any, preferredStore = '') {
  const price = numberFromPrice(result.extracted_price || result.price)
  const original = numberFromPrice(result.extracted_original_price || result.original_price)
  return {
    name: result.title || '',
    store: result.source || preferredStore || 'Online',
    current: price ? Math.round(price) : 0,
    price: price ? Math.round(price) : 0,
    original: original ? Math.round(original) : Math.round((price || 79) * 1.2),
    image: result.thumbnail || '',
    category: inferCategories(result.title || preferredStore)[0],
    description: result.title || '',
    deal_url: result.link || result.product_link || storeSearchUrl(result.source || preferredStore || 'Google Shopping', result.title || ''),
    safe_source: 'SerpAPI Google Shopping',
    source: 'SerpAPI Google Shopping',
    title: result.title || '',
  }
}

async function serpShopping(query: string, store = '') {
  if (!SERPAPI_KEY) return []
  const url = new URL('https://serpapi.com/search.json')
  url.searchParams.set('engine', 'google_shopping')
  url.searchParams.set('q', store ? `${query} ${store}` : query)
  url.searchParams.set('api_key', SERPAPI_KEY)
  url.searchParams.set('num', '6')
  url.searchParams.set('gl', 'us')
  url.searchParams.set('hl', 'en')

  const response = await fetch(url)
  if (!response.ok) throw new Error(`SerpAPI request failed with ${response.status}`)
  const data = await response.json()
  if (data.error) throw new Error(`SerpAPI error: ${data.error}`)
  return Array.isArray(data.shopping_results) ? data.shopping_results : []
}

async function saveSerpResultsToCatalog(results: any[], query: string) {
  const rows = results.map((result) => {
    const parsed = parseShoppingResult(result)
    if (!parsed.name || !parsed.price) return null
    return {
      name: parsed.name,
      category: inferCategories(query, parsed.name)[0],
      store: parsed.store,
      price: parsed.price,
      original: parsed.original,
      image: parsed.image,
      description: parsed.description || parsed.name,
      source: 'SerpAPI',
    }
  }).filter(Boolean)

  if (rows.length) {
    await db(
      supabase.from('catalog').upsert(rows, { onConflict: 'name,store', ignoreDuplicates: true }),
      'Saving SerpAPI catalog results failed',
    )
  }
}

async function db<T>(promise: PromiseLike<{ data: T; error: { message: string } | null }>, label: string): Promise<T> {
  const { data, error } = await promise
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

async function getCoupons() {
  return await db<any[]>(supabase.from('coupons').select('*'), 'Loading coupons failed')
}

async function couponsForItem(item: any) {
  const coupons = await getCoupons()
  return coupons.filter((coupon) => {
    if (Number(item.current || 0) < Number(coupon.minimum || 0)) return false
    const storeMatch = norm(coupon.store) === norm(item.store) || score(item.store || '', coupon.store) >= 0.7
    const itemText = `${item.name} ${item.category || ''} ${item.description || ''}`
    const catMatch = categories(coupon.categories).some((cat) => score(cat, itemText) >= 0.5 || score(itemText, cat) >= 0.5)
    return storeMatch && catMatch
  })
}

function applyBestCoupon(item: any, coupons: any[]) {
  if (!coupons.length) return { finalPrice: item.current, discount: 0, coupon: null }
  const best = coupons
    .map((coupon) => {
      const discount = coupon.type === 'percent'
        ? Math.min(item.current, item.current * (Number(coupon.value) / 100))
        : Math.min(item.current, Number(coupon.value || 0))
      return { coupon, discount }
    })
    .sort((a, b) => b.discount - a.discount)[0]
  return { finalPrice: Math.max(0, item.current - best.discount), discount: best.discount, coupon: best.coupon }
}

async function searchCatalog(q: string, store = '') {
  const rows = await db<any[]>(supabase.from('catalog').select('*').order('category'), 'Loading catalog failed')
  const scored = rows
    .map((row) => ({ ...row, _score: score(q, `${row.name} ${row.category}`) }))
    .filter((row) => row._score >= 0.35)
    .sort((a, b) => b._score - a._score)

  const names: string[] = []
  for (const row of scored) {
    const name = norm(row.name)
    if (!names.includes(name)) names.push(name)
    if (names.length >= 2) break
  }

  const results = scored.filter((row) => names.includes(norm(row.name)))
  if (store) {
    results.sort((a, b) => {
      const aMatch = norm(a.store).includes(norm(store)) ? -1 : 0
      const bMatch = norm(b.store).includes(norm(store)) ? -1 : 0
      return aMatch - bMatch || b._score - a._score
    })
  }
  return results.slice(0, 8)
}

async function saveSearch(rawQuery: string, store = '', resultCount = 0, fuzzyScores: Record<string, unknown> = {}) {
  const row = await db<any>(
    supabase.from('searches').insert({
      query: rawQuery,
      raw_query: rawQuery,
      expanded_query: rawQuery,
      store,
      result_count: resultCount,
      fuzzy_scores: fuzzyScores,
    }).select('*').single(),
    'Saving search failed',
  )
  return row.id
}

async function linkSearchToItem(searchId: number, itemId: number, role = 'typed') {
  await db(supabase.from('searches').update({ led_to_item_id: itemId }).eq('id', searchId), 'Updating search failed')
  await db(
    supabase.from('item_searches').upsert(
      { item_id: itemId, search_id: searchId, role },
      { onConflict: 'item_id,search_id' },
    ),
    'Linking search failed',
  )
}

async function persistSearchTrail(trail: any[] | undefined, itemId: number) {
  for (const entry of trail || []) {
    const query = String(entry.query || '').trim()
    if (!query) continue
    const sid = await saveSearch(query, entry.store || '', Number(entry.resultCount || 0), {
      ...(entry.fuzzyScores || {}),
      relatedTopics: relatedTopics(query),
    })
    await linkSearchToItem(sid, itemId, entry.role || 'typed')
  }
}

async function handler(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })

  const url = new URL(req.url)
  const path = url.pathname.replace(/^.*\/dealwise-api/, '') || '/'
  const method = req.method

  if (path === '/api/coupons' && method === 'GET') {
    const store = url.searchParams.get('store')
    let query = supabase.from('coupons').select('*').order('store').order('value', { ascending: false })
    if (store) query = query.ilike('store', store)
    const coupons = await db<any[]>(query, 'Loading coupons failed')
    return json(200, { coupons })
  }

  if (path === '/api/catalog' && method === 'GET') {
    const q = url.searchParams.get('q') || ''
    const store = url.searchParams.get('store') || ''
    if (q.trim()) {
      const catalog = await searchCatalog(q, store)
      return json(200, { catalog, total: catalog.length })
    }
    const catalog = await db<any[]>(supabase.from('catalog').select('*').order('category'), 'Loading catalog failed')
    return json(200, { catalog, total: catalog.length })
  }

  if (path === '/api/suggest' && method === 'GET') {
    const q = url.searchParams.get('q') || ''
    const target = Number(url.searchParams.get('target') || 0)
    const store = url.searchParams.get('store') || ''
    if (!q.trim()) return json(400, { error: 'Missing q' })
    const hits = await searchCatalog(q, store)
    const suggestions = hits.length ? hits.map((row) => ({
      name: row.name,
      store: row.store,
      current: row.price,
      target: target || Math.round(row.price * 0.85),
      original: row.original,
      image: row.image || '',
      category: row.category,
      description: row.description || row.name,
      specs: [],
      bestFor: [],
      watchFor: [],
      trend: 'stable',
      _fromCatalog: true,
      deal_url: storeSearchUrl(row.store, row.name),
      safe_source: 'Supabase catalog',
    })) : fallbackStoreSuggestions(q, target, store)
    await saveSearch(q, store, suggestions.length, { relatedTopics: relatedTopics(q) })
    return json(200, { suggestions })
  }

  if (path === '/api/deals' && method === 'GET') {
    const q = url.searchParams.get('q') || ''
    const store = url.searchParams.get('store') || ''
    if (!q.trim()) return json(400, { error: 'Missing q' })
    if (SERPAPI_KEY) {
      try {
        const results = await serpShopping(q, store)
        await saveSerpResultsToCatalog(results, q)
        const offers = results
          .map((result) => parseShoppingResult(result, store))
          .filter((offer) => offer.price > 0)
          .slice(0, 4)
          .map((offer) => ({
            store: offer.store,
            price: offer.price,
            original: offer.original,
            url: offer.deal_url,
            source: offer.source,
            title: offer.title || q,
            image: offer.image,
          }))
        if (offers.length) {
          await saveSearch(q, store, offers.length, { relatedTopics: relatedTopics(q), source: 'SerpAPI Google Shopping' })
          return json(200, { offers, source: 'SerpAPI Google Shopping' })
        }
      } catch (error) {
        console.error(error)
      }
    }
    const base = norm(q).includes('laptop') ? 649 : norm(q).includes('phone') ? 799 : norm(q).includes('headphone') ? 249 : 79
    await saveSearch(q, store, 1)
    return json(200, {
      offers: [{
        store: store || 'Demo',
        price: base,
        original: Math.round(base * 1.25),
        url: `https://www.google.com/search?q=${encodeURIComponent(`${q} buy`)}`,
        source: 'Supabase Edge demo fallback',
        title: q,
      }],
    })
  }

  if (path === '/api/items' && method === 'GET') {
    const rows = await db<any[]>(supabase.from('items').select('*').order('created_at', { ascending: false }), 'Loading items failed')
    const items = []
    for (const item of rows) {
      const coupons = await couponsForItem(item)
      items.push({ ...item, coupons, couponResult: applyBestCoupon(item, coupons) })
    }
    return json(200, { items })
  }

  if (path === '/api/items' && method === 'POST') {
    const body = await req.json().catch(() => ({}))
    if (!body.name) return json(400, { error: 'name required' })
    const row = {
      name: body.name,
      target: Number(body.target || 0),
      current: Number(body.current || 0),
      original: Number(body.original || 0),
      store: body.store || '',
      trend: body.trend || 'stable',
      image: body.image || '',
      category: body.category || '',
      description: body.description || '',
      deal_url: body.deal_url || '',
      safe_source: body.safe_source || '',
      last_checked: body.last_checked || new Date().toISOString(),
    }
    const item = await db<any>(supabase.from('items').insert(row).select('*').single(), 'Saving item failed')
    await persistSearchTrail(body.searchTrail, item.id)
    const coupons = await couponsForItem(item)
    return json(201, { item: { ...item, coupons, couponResult: applyBestCoupon(item, coupons) } })
  }

  const itemMatch = path.match(/^\/api\/items\/(\d+)$/)
  if (itemMatch && method === 'PUT') {
    const id = Number(itemMatch[1])
    const body = await req.json().catch(() => ({}))
    const item = await db<any>(supabase.from('items').update(body).eq('id', id).select('*').single(), 'Updating item failed')
    const coupons = await couponsForItem(item)
    return json(200, { item: { ...item, coupons, couponResult: applyBestCoupon(item, coupons) }, alerts: [] })
  }
  if (itemMatch && method === 'DELETE') {
    await db(supabase.from('items').delete().eq('id', Number(itemMatch[1])), 'Deleting item failed')
    return json(200, { ok: true })
  }

  if (path === '/api/alerts' && method === 'GET') {
    const alerts = await db<any[]>(supabase.from('alerts').select('*').order('created_at', { ascending: false }).limit(50), 'Loading alerts failed')
    return json(200, { alerts })
  }

  if (path === '/api/search' && method === 'GET') {
    const q = url.searchParams.get('q') || ''
    if (!q.trim()) return json(400, { error: 'Missing q' })
    const items = await db<any[]>(supabase.from('items').select('*'), 'Loading items failed')
    const matchedItems = items.filter((item) => score(q, `${item.name} ${item.category || ''}`) >= 0.45)
    let catalogItems = await searchCatalog(q)
    const coupons = (await getCoupons()).filter((coupon) => score(q, coupon.store) >= 0.7 || categories(coupon.categories).some((cat) => score(q, cat) >= 0.5))
    if (!matchedItems.length && !catalogItems.length && !coupons.length) {
      catalogItems = fallbackStoreSuggestions(q)
    }
    await saveSearch(q, '', matchedItems.length + catalogItems.length + coupons.length, { relatedTopics: relatedTopics(q) })
    return json(200, { query: q, items: matchedItems, catalogItems, coupons, relatedTopics: relatedTopics(q) })
  }

  if (path === '/api/searches' && method === 'GET') {
    const searches = await db<any[]>(supabase.from('searches').select('*').order('searched_at', { ascending: false }).limit(100), 'Loading searches failed')
    return json(200, { searches })
  }

  return json(404, { error: 'Not found' })
}

Deno.serve((req) => handler(req).catch((error) => json(500, { error: error.message })))
