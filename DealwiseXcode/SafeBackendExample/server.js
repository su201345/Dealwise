// Dealwise backend - Supabase + SerpAPI + search trail + coupon persistence
// Start: SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... node server.js

require('dotenv').config();

const http = require('node:http');
const https = require('node:https');
const { URL } = require('node:url');
const { createClient } = require('@supabase/supabase-js');
const {
  fuzzyMatchItems, queryMatchesCoupon, matchScore, expandQuery
} = require('./fuzzy');

const PORT = Number(process.env.PORT || 4173);
const SERPAPI_KEY = process.env.SERPAPI_KEY || '';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY
  || process.env.SUPABASE_ANON_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY).');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const COUPON_SEEDS = [
  { store:'Amazon', code:'SUMMER20', description:'20% off electronics', type:'percent', value:20, expiry:'Expires Aug 31', categories:['electronics','headphones','e-reader','phone'], minimum:25, color:'var(--green)', source:'Seeded' },
  { store:'Target', code:'TARGET15', description:'15% off home & kitchen', type:'percent', value:15, expiry:'Expires Jun 15', categories:['kitchen','home','multi-cooker','appliance'], minimum:50, color:'var(--amber)', source:'Seeded' },
  { store:"Levi's", code:'LEVIS10', description:'$10 off orders $50+', type:'amount', value:10, expiry:'Expires Jun 1', categories:['clothing','denim','jeans','apparel'], minimum:50, color:'var(--blue)', source:'Seeded' },
  { store:'Best Buy', code:'BESTBUY25', description:'$25 off tech over $250', type:'amount', value:25, expiry:'Expires Jun 30', categories:['electronics','laptop','headphones','computer'], minimum:250, color:'var(--blue)', source:'Seeded' },
  { store:'Walmart', code:'WALMART10', description:'10% off $75+ order', type:'percent', value:10, expiry:'Expires Jul 31', categories:['electronics','kitchen','home','clothing'], minimum:75, color:'var(--amber)', source:'Seeded' },
  { store:'eBay', code:'EBAY5', description:'5% off any order', type:'percent', value:5, expiry:'Expires Dec 31', categories:['electronics','clothing','home','general'], minimum:0, color:'var(--blue)', source:'Seeded' },
  { store:'Amazon', code:'PRIMEDAY15', description:'15% off Prime Day early access', type:'percent', value:15, expiry:'Expires Jul 17', categories:['electronics','home','kitchen','clothing'], minimum:30, color:'var(--green)', source:'Seeded' },
  { store:'Best Buy', code:'SAVE10BB', description:'10% off $100+ purchase', type:'percent', value:10, expiry:'Expires Aug 1', categories:['electronics','laptop','tv','camera','tablet'], minimum:100, color:'var(--blue)', source:'Seeded' }
];

const CATALOG_ITEMS = [
  ['Toothbrush','Household',5], ['Pillow','Household',25], ['Lamp','Household',30],
  ['Frying Pan','Kitchen',28], ["Chef's Knife",'Kitchen',35], ['Air Fryer','Kitchen',89],
  ['Laptop','Electronics',699], ['Smartphone','Electronics',799], ['Headphones','Electronics',199],
  ['USB Cable','Electronics',10], ['Power Bank','Electronics',35], ['Tablet','Electronics',449],
  ['T-Shirt','Clothing',20], ['Jeans','Clothing',45], ['Sneakers','Clothing',75],
  ['Notebook','Office Supplies',8], ['Pen','Office Supplies',5], ['Stapler','Office Supplies',12],
  ['Coffee','Food & Drink',12], ['Olive Oil','Food & Drink',10], ['Rice','Food & Drink',8],
  ['Hammer','Tools',18], ['Screwdriver','Tools',12], ['Drill','Tools',79],
  ['Garden Hose','Outdoor',30], ['Camping Tent','Outdoor',120], ['Bicycle','Outdoor',350],
  ['Vitamins','Health',15], ['Shampoo','Health',8], ['Thermometer','Health',12],
  ['Book','Entertainment',15], ['Yoga Mat','Entertainment',25], ['Board Game','Entertainment',30]
];

function norm(v) {
  return String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function jsonRes(res, status, data) {
  res.writeHead(status, { 'content-type':'application/json', 'Access-Control-Allow-Origin':'*' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); } });
    req.on('error', reject);
  });
}

function toList(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try { return JSON.parse(value); } catch { return []; }
}

function toCoupon(c) {
  return { ...c, categories: toList(c.categories) };
}

async function sb(query, message = 'Supabase request failed') {
  const { data, error, count } = await query;
  if (error) throw new Error(`${message}: ${error.message}`);
  return { data, count };
}

async function countRows(table) {
  const { count } = await sb(supabase.from(table).select('id', { count:'exact', head:true }), `Counting ${table} failed`);
  return count || 0;
}

async function seedDatabase() {
  if (await countRows('coupons') === 0) {
    await sb(
      supabase.from('coupons').upsert(COUPON_SEEDS, { onConflict:'store,code', ignoreDuplicates:true }),
      'Seeding coupons failed'
    );
    console.log('Seeded default coupons in Supabase.');
  }

  if (await countRows('catalog') === 0) {
    const stores = ['Amazon', 'Walmart', 'Target', 'Best Buy'];
    const mult = { Amazon:1, Walmart:0.95, Target:1.05, 'Best Buy':1.02 };
    const rows = [];
    for (const [name, category, base] of CATALOG_ITEMS) {
      for (const store of stores) {
        const price = Math.round(base * mult[store]);
        rows.push({
          name, category, store, price, original:Math.round(price * 1.2),
          description:`${name} - ${category}`, source:'seeded'
        });
      }
    }
    await sb(supabase.from('catalog').upsert(rows, { onConflict:'name,store', ignoreDuplicates:true }), 'Seeding catalog failed');
    console.log(`Seeded catalog with ${rows.length} Supabase rows.`);
  }
}

function serpFetch(params) {
  return new Promise((resolve, reject) => {
    const url = new URL('https://serpapi.com/search');
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    https.get(url.toString(), res => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

async function upsertCoupon(c) {
  await sb(supabase.from('coupons').upsert(c, { onConflict:'store,code' }), 'Saving coupon failed');
}

async function persistSerpCoupons(serpData, contextStore, contextQuery) {
  const saved = [];
  for (const r of (serpData.shopping_results || [])) {
    const store = r.source || contextStore || '';
    for (const ext of (r.extensions || [])) {
      const m = String(ext).match(/(?:coupon|promo(?:\s*code)?|code)[:\s]+([A-Z0-9_-]{3,20})/i);
      if (!m) continue;
      const code = m[1].toUpperCase();
      await upsertCoupon({
        store, code, description:String(ext).slice(0, 120), type:'unknown', value:0,
        expiry:'', categories:inferCategories(contextQuery, r.title || ''), minimum:0,
        color:'var(--green)', source:'SerpAPI extension'
      });
      saved.push(code);
    }
    if (r.coupon) {
      const code = String(r.coupon).replace(/[^A-Z0-9_-]/gi, '').toUpperCase().slice(0, 20);
      if (!code) continue;
      await upsertCoupon({
        store, code, description:`Coupon for ${r.title || store}`, type:'unknown', value:0,
        expiry:'', categories:inferCategories(contextQuery, r.title || ''), minimum:0,
        color:'var(--green)', source:'SerpAPI coupon field'
      });
      saved.push(code);
    }
  }
  for (const p of (serpData.promotions || [])) {
    const code = String(p.coupon || p.code || '').replace(/[^A-Z0-9_-]/gi, '').toUpperCase().slice(0, 20);
    if (!code) continue;
    await upsertCoupon({
      store:contextStore || p.retailer || '', code,
      description:p.description || p.title || `Promo code ${code}`,
      type:p.type || 'unknown', value:Number(p.value || p.discount || 0),
      expiry:p.expiry || p.ends || '', categories:inferCategories(contextQuery, ''),
      minimum:0, color:'var(--amber)', source:'SerpAPI promotions'
    });
    saved.push(code);
  }
  if (saved.length) console.log(`[coupons] Persisted ${saved.length} from SerpAPI: ${saved.join(', ')}`);
  return saved;
}

function inferCategories(query, title) {
  const text = norm(`${query} ${title}`);
  const map = {
    electronics:/\b(phone|laptop|computer|tablet|tv|camera|headphone|earphone|speaker|watch|kindle|ereader)\b/,
    headphones:/\b(headphone|earphone|earbuds|headset)\b/,
    laptop:/\b(laptop|notebook|macbook|chromebook|computer)\b/,
    phone:/\b(phone|iphone|android|smartphone|galaxy|pixel)\b/,
    kitchen:/\b(instant pot|air fryer|coffee|blender|toaster|cooker|kitchen)\b/,
    clothing:/\b(shirt|jeans|pants|jacket|shoes|apparel|denim|clothing)\b/,
    home:/\b(vacuum|furniture|bedding|lamp|shelf|home|decor)\b/,
    general:/.*/
  };
  return Object.entries(map).filter(([, rx]) => rx.test(text)).map(([k]) => k);
}

async function allRows(table, orderColumn = 'id', ascending = true) {
  const { data } = await sb(supabase.from(table).select('*').order(orderColumn, { ascending }), `Loading ${table} failed`);
  return data || [];
}

async function couponsForItem(item) {
  const rows = (await allRows('coupons')).map(toCoupon);
  return rows.filter(c => {
    if (Number(item.current || 0) < Number(c.minimum || 0)) return false;
    const storeMatch = norm(c.store) === norm(item.store || '') || matchScore(item.store || '', c.store) >= 0.72;
    const itemText = [item.name, item.category, item.description].join(' ');
    const catMatch = c.categories.some(cat =>
      matchScore(cat, itemText) >= 0.55 || matchScore(itemText, cat) >= 0.55
    );
    const nameToStore = matchScore(item.name, c.store) >= 0.60;
    return (storeMatch || nameToStore) && catMatch;
  });
}

function applyBestCoupon(item, pool) {
  if (!pool || !pool.length) return { finalPrice:item.current, discount:0, coupon:null };
  const best = pool
    .map(c => {
      const discount = c.type === 'percent'
        ? Math.min(item.current, item.current * (Number(c.value) / 100))
        : Math.min(item.current, Number(c.value || 0));
      return { coupon:c, discount };
    })
    .sort((a, b) => b.discount - a.discount)[0];
  return { finalPrice:Math.max(0, item.current - best.discount), discount:best.discount, coupon:best.coupon };
}

async function linkCouponsToItem(itemId, matchedCoupons) {
  const rows = matchedCoupons.map(c => ({ item_id:itemId, coupon_id:c.id }));
  if (rows.length) await sb(supabase.from('item_coupons').upsert(rows, { onConflict:'item_id,coupon_id', ignoreDuplicates:true }), 'Linking coupons failed');
}

async function saveSearch(rawQuery, store, resultCount, fuzzyScores = {}) {
  const row = {
    query:rawQuery, raw_query:rawQuery, expanded_query:expandQuery(rawQuery),
    store:store || '', result_count:resultCount, fuzzy_scores:fuzzyScores
  };
  const { data } = await sb(supabase.from('searches').insert(row).select('*').single(), 'Saving search failed');
  return data.id;
}

async function linkSearchToItem(searchId, itemId, role = 'typed') {
  await sb(supabase.from('searches').update({ led_to_item_id:itemId }).eq('id', searchId), 'Updating search failed');
  await sb(
    supabase.from('item_searches').upsert({ item_id:itemId, search_id:searchId, role }, { onConflict:'item_id,search_id' }),
    'Linking search failed'
  );
}

async function persistSearchTrail(trail, itemId) {
  for (const entry of (trail || [])) {
    if (!entry.query || !entry.query.trim()) continue;
    const sid = await saveSearch(entry.query, entry.store || '', entry.resultCount || 0, entry.fuzzyScores || {});
    await linkSearchToItem(sid, itemId, entry.role || 'typed');
  }
}

async function generateAlertsForItem(item, previousPrice) {
  const newAlerts = [];
  const prev = Number(previousPrice);
  const curr = Number(item.current);
  const target = Number(item.target);

  if (prev && curr < prev) {
    const drop = Math.round(prev - curr);
    const pct = Math.round((drop / prev) * 100);
    newAlerts.push({ item_id:item.id, item_name:item.name, type:'price_drop', title:`${item.name} dropped $${drop} (${pct}%)`, subtitle:`From $${prev} to $${curr}`, color:'var(--green)' });
  }
  if (curr <= target && (!prev || prev > target)) {
    newAlerts.push({ item_id:item.id, item_name:item.name, type:'target_hit', title:`${item.name} hit your $${target} target!`, subtitle:`Now $${curr} - ready to buy`, color:'var(--green)' });
  }
  if (prev && curr > prev) {
    const rise = Math.round(curr - prev);
    newAlerts.push({ item_id:item.id, item_name:item.name, type:'price_rise', title:`${item.name} price rose $${rise}`, subtitle:`From $${prev} to $${curr}`, color:'var(--amber)' });
  }

  const matched = await couponsForItem(item);
  const best = applyBestCoupon(item, matched);
  if (best.coupon) {
    newAlerts.push({
      item_id:item.id, item_name:item.name, type:'coupon_match',
      title:`Coupon ${best.coupon.code} matches ${item.name}`,
      subtitle:`${best.coupon.description} - saves ${best.discount > 0 ? '$' + Math.round(best.discount) : 'varies'}`,
      color:'var(--amber)'
    });
  }

  const inserted = [];
  for (const alert of newAlerts) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recent } = await sb(
      supabase.from('alerts').select('id').eq('item_id', alert.item_id).eq('type', alert.type).gte('created_at', since).limit(1),
      'Checking recent alert failed'
    );
    if (recent.length) continue;
    const { data } = await sb(supabase.from('alerts').insert(alert).select('*').single(), 'Saving alert failed');
    inserted.push(data);
  }
  return inserted;
}

function demoOffer(query, store) {
  const q = norm(query);
  const base = q.includes('headphone') ? 249 : q.includes('kindle') ? 99
    : q.includes('jean') ? 45 : q.includes('laptop') ? 649 : q.includes('phone') ? 799 : 79;
  return {
    store:store || 'Demo', price:base, original:Math.round(base * 1.25),
    url:`https://www.google.com/search?q=${encodeURIComponent(query + ' buy')}`,
    source:'Demo (no SERPAPI_KEY)', title:query
  };
}

function parseShoppingResult(r, preferredStore) {
  const price = parseFloat(String(r.extracted_price || r.price || '0').replace(/[^0-9.]/g, ''));
  const original = parseFloat(String(r.extracted_original_price || r.original_price || price * 1.2).replace(/[^0-9.]/g, ''));
  return {
    store:r.source || preferredStore || 'Online',
    price:isFinite(price) && price > 0 ? Math.round(price) : null,
    original:isFinite(original) && original > 0 ? Math.round(original) : Math.round((price || 50) * 1.22),
    url:r.link || r.product_link || `https://www.google.com/search?q=${encodeURIComponent(r.title || '')}`,
    source:'SerpAPI google_shopping',
    title:r.title || '',
    image:r.thumbnail || ''
  };
}

async function persistSerpResultsToCatalog(serpResults, query) {
  const rows = [];
  for (const r of serpResults) {
    const price = parseFloat(String(r.extracted_price || r.price || '0').replace(/[^0-9.]/g, ''));
    const original = parseFloat(String(r.extracted_original_price || r.original_price || '0').replace(/[^0-9.]/g, ''));
    if (!r.title || !isFinite(price) || price <= 0) continue;
    rows.push({
      name:r.title,
      category:inferCategories(query, r.title).find(c => c !== 'general') || 'Product',
      store:r.source || 'Online',
      price:Math.round(price),
      original:isFinite(original) && original > 0 ? Math.round(original) : Math.round(price * 1.2),
      image:r.thumbnail || '',
      description:r.title,
      source:'SerpAPI'
    });
  }
  if (!rows.length) return;
  await sb(supabase.from('catalog').upsert(rows, { onConflict:'name,store', ignoreDuplicates:true }), 'Saving catalog results failed');
  console.log(`[catalog] Persisted ${rows.length} products from SerpAPI search for "${query}"`);
}

async function getApprovedOffers(query, store) {
  if (!SERPAPI_KEY) return [demoOffer(query, store)];
  try {
    const data = await serpFetch({ engine:'google_shopping', q:store ? `${query} ${store}` : query, api_key:SERPAPI_KEY, num:6, gl:'us', hl:'en' });
    await persistSerpCoupons(data, store, query);
    const results = data.shopping_results || [];
    await persistSerpResultsToCatalog(results, query);
    if (!results.length) return [demoOffer(query, store)];
    let filtered = store ? results.filter(r => norm(r.source || '').includes(norm(store))) : results;
    if (!filtered.length) filtered = results;
    const offers = filtered.slice(0, 4).map(r => parseShoppingResult(r, store)).filter(o => o.price !== null);
    return offers.length ? offers : [demoOffer(query, store)];
  } catch (err) {
    console.error('SerpAPI deals error:', err.message);
    return [demoOffer(query, store)];
  }
}

async function searchCatalog(query, store) {
  const q = norm(query);
  const rows = await allRows('catalog', 'created_at', false);
  const scored = rows
    .map(c => ({ ...c, _score:matchScore(q, norm(`${c.name} ${c.category}`)) }))
    .filter(c => c._score >= 0.35)
    .sort((a, b) => b._score - a._score);
  if (!scored.length) return [];

  const topNames = [];
  for (const c of scored) {
    const name = norm(c.name);
    if (!topNames.includes(name)) topNames.push(name);
    if (topNames.length >= 2) break;
  }

  const results = scored.filter(c => topNames.includes(norm(c.name)));
  if (store) {
    results.sort((a, b) => {
      const aMatch = norm(a.store).includes(norm(store)) ? -1 : 0;
      const bMatch = norm(b.store).includes(norm(store)) ? -1 : 0;
      return aMatch - bMatch || b._score - a._score;
    });
  }
  return results.slice(0, 8);
}

async function getSuggestions(query, target, store) {
  const catalogHits = await searchCatalog(query, store);
  if (catalogHits.length >= 1) {
    console.log(`[suggest] Catalog hit for "${query}" - ${catalogHits.length} results`);
    return catalogHits.map(c => ({
      name:c.name, store:c.store, current:c.price, target:Number(target) || Math.round(c.price * 0.85),
      original:c.original, image:c.image || '', category:c.category, description:c.description || c.name,
      specs:[], bestFor:[], watchFor:[], trend:'stable', _fromCatalog:true
    }));
  }

  if (SERPAPI_KEY) {
    try {
      console.log(`[suggest] No catalog match for "${query}" - querying SerpAPI`);
      const data = await serpFetch({ engine:'google_shopping', q:query, api_key:SERPAPI_KEY, num:8, gl:'us', hl:'en' });
      await persistSerpCoupons(data, store, query);
      const results = data.shopping_results || [];
      await persistSerpResultsToCatalog(results, query);
      const suggestions = results.slice(0, 6).map(r => {
        const price = parseFloat(String(r.extracted_price || r.price || '0').replace(/[^0-9.]/g, ''));
        return {
          name:r.title || query, store:r.source || store || 'Online',
          current:isFinite(price) && price > 0 ? Math.round(price) : Number(target) || 79,
          target:Number(target) || Math.round((price || 79) * 0.85),
          original:Math.round((price || 79) * 1.2), image:r.thumbnail || '',
          category:inferCategories(query, r.title || '').find(c => c !== 'general') || 'Product',
          description:r.title || query, specs:[], bestFor:[], watchFor:[], trend:'stable', _fromSerpAPI:true
        };
      });
      if (suggestions.length) return suggestions;
    } catch (err) {
      console.error('SerpAPI suggest error:', err.message);
    }
  }

  return localSuggestions(query, target, store);
}

function localSuggestions(query, target, store) {
  const stores = store ? [store, 'Amazon', 'Best Buy', 'Walmart'].filter((s, i, a) => a.indexOf(s) === i) : ['Amazon', 'Best Buy', 'Walmart', 'eBay'];
  const base = Number(target) > 0 ? Number(target) : 79;
  return stores.slice(0, 4).map((s, i) => ({
    name:query, store:s, current:Math.round(base * [0.92, 0.97, 1, 1.08][i]),
    target:base, original:Math.round(base * 1.22), image:'',
    category:'Requested product', description:`${query} from ${s}`,
    specs:[], bestFor:[], watchFor:[], trend:'stable'
  }));
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (url.pathname === '/api/deals' && req.method === 'GET') {
    const q = url.searchParams.get('q') || '';
    const store = url.searchParams.get('store') || '';
    if (!q.trim()) return jsonRes(res, 400, { error:'Missing q' });
    const allItems = await allRows('items', 'created_at', false);
    const scores = {};
    fuzzyMatchItems(q, allItems).forEach(i => { scores[i.name] = matchScore(q, i.name); });
    const searchId = await saveSearch(q, store, 0, scores);
    const offers = await getApprovedOffers(q, store);
    await sb(supabase.from('searches').update({ result_count:offers.length }).eq('id', searchId), 'Updating search count failed');
    return jsonRes(res, 200, { offers });
  }

  if (url.pathname === '/api/suggest' && req.method === 'GET') {
    const q = url.searchParams.get('q') || '';
    const store = url.searchParams.get('store') || '';
    if (!q.trim()) return jsonRes(res, 400, { error:'Missing q' });
    const allItems = await allRows('items', 'created_at', false);
    const catalogAll = await allRows('catalog', 'created_at', false);
    const scores = {};
    fuzzyMatchItems(q, allItems).forEach(i => { scores[i.name] = matchScore(q, i.name); });
    catalogAll.filter(c => matchScore(norm(q), norm(c.name)) >= 0.35)
      .forEach(c => { scores[c.name] = matchScore(norm(q), norm(c.name)); });
    const searchId = await saveSearch(q, store, 0, scores);
    const suggestions = await getSuggestions(q, url.searchParams.get('target'), store);
    await sb(supabase.from('searches').update({ result_count:suggestions.length }).eq('id', searchId), 'Updating search count failed');
    return jsonRes(res, 200, { suggestions });
  }

  if (url.pathname === '/api/items' && req.method === 'GET') {
    const rows = await allRows('items', 'created_at', false);
    const enriched = [];
    for (const item of rows) {
      const pool = await couponsForItem(item);
      enriched.push({ ...item, coupons:pool, couponResult:applyBestCoupon(item, pool) });
    }
    return jsonRes(res, 200, { items:enriched });
  }

  if (url.pathname === '/api/items' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body.name) return jsonRes(res, 400, { error:'name required' });
    const normName = norm(body.name);
    const normStore = norm(body.store || '');
    const items = await allRows('items', 'created_at', false);
    const existing = items.find(r => norm(r.name) === normName && norm(r.store) === normStore);

    if (existing) {
      await persistSearchTrail(body.searchTrail, existing.id);
      const pool = await couponsForItem(existing);
      await linkCouponsToItem(existing.id, pool);
      return jsonRes(res, 200, {
        item:{ ...existing, coupons:pool, couponResult:applyBestCoupon(existing, pool) },
        deduplicated:true
      });
    }

    const row = {
      name:body.name,
      target:Number(body.target || 0),
      current:Number(body.current || 0),
      original:Number(body.original || 0),
      store:body.store || '',
      trend:body.trend || 'stable',
      image:body.image || '',
      category:body.category || '',
      description:body.description || '',
      deal_url:body.deal_url || '',
      safe_source:body.safe_source || '',
      last_checked:body.last_checked || new Date().toISOString()
    };
    const { data:item } = await sb(supabase.from('items').insert(row).select('*').single(), 'Saving item failed');
    await persistSearchTrail(body.searchTrail, item.id);
    const matchedCoupons = await couponsForItem(item);
    await linkCouponsToItem(item.id, matchedCoupons);
    await generateAlertsForItem(item, null);
    const pool = await couponsForItem(item);
    return jsonRes(res, 201, { item:{ ...item, coupons:pool, couponResult:applyBestCoupon(item, pool) } });
  }

  if (/^\/api\/items\/\d+$/.test(url.pathname) && req.method === 'PUT') {
    const id = Number(url.pathname.split('/').pop());
    const body = await readBody(req);
    const { data:existing } = await sb(supabase.from('items').select('*').eq('id', id).maybeSingle(), 'Loading item failed');
    if (!existing) return jsonRes(res, 404, { error:'Not found' });
    const prevPrice = existing.current;
    const updates = {
      name:body.name ?? existing.name,
      target:Number(body.target ?? existing.target),
      current:Number(body.current ?? existing.current),
      original:Number(body.original ?? existing.original),
      store:body.store ?? existing.store,
      trend:body.trend ?? existing.trend,
      image:body.image ?? existing.image,
      category:body.category ?? existing.category,
      description:body.description ?? existing.description,
      deal_url:body.deal_url ?? existing.deal_url,
      safe_source:body.safe_source ?? existing.safe_source,
      last_checked:body.last_checked ?? existing.last_checked
    };
    const { data:updated } = await sb(supabase.from('items').update(updates).eq('id', id).select('*').single(), 'Updating item failed');
    const matchedCoupons = await couponsForItem(updated);
    await linkCouponsToItem(id, matchedCoupons);
    const newAlerts = await generateAlertsForItem(updated, prevPrice);
    const pool = await couponsForItem(updated);
    return jsonRes(res, 200, { item:{ ...updated, coupons:pool, couponResult:applyBestCoupon(updated, pool) }, alerts:newAlerts });
  }

  if (/^\/api\/items\/\d+$/.test(url.pathname) && req.method === 'DELETE') {
    const id = Number(url.pathname.split('/').pop());
    await sb(supabase.from('items').delete().eq('id', id), 'Deleting item failed');
    await sb(supabase.from('alerts').delete().eq('item_id', id), 'Deleting alerts failed');
    return jsonRes(res, 200, { ok:true });
  }

  if (/^\/api\/items\/\d+\/searches$/.test(url.pathname) && req.method === 'GET') {
    const id = Number(url.pathname.split('/')[3]);
    const { data:links } = await sb(
      supabase.from('item_searches').select('role, searches(*)').eq('item_id', id).order('created_at', { ascending:true }),
      'Loading item searches failed'
    );
    return jsonRes(res, 200, { searches:(links || []).map(r => ({ ...r.searches, role:r.role })) });
  }

  if (url.pathname === '/api/coupons' && req.method === 'GET') {
    const store = url.searchParams.get('store') || '';
    let query = supabase.from('coupons').select('*').order('store').order('value', { ascending:false });
    if (store) query = query.ilike('store', store);
    const { data } = await sb(query, 'Loading coupons failed');
    return jsonRes(res, 200, { coupons:(data || []).map(toCoupon) });
  }

  if (url.pathname === '/api/alerts' && req.method === 'GET') {
    const { data } = await sb(supabase.from('alerts').select('*').order('created_at', { ascending:false }).limit(50), 'Loading alerts failed');
    return jsonRes(res, 200, { alerts:data || [] });
  }

  if (/^\/api\/alerts\/\d+$/.test(url.pathname) && req.method === 'DELETE') {
    await sb(supabase.from('alerts').delete().eq('id', Number(url.pathname.split('/').pop())), 'Deleting alert failed');
    return jsonRes(res, 200, { ok:true });
  }

  if (url.pathname === '/api/search' && req.method === 'GET') {
    const q = url.searchParams.get('q') || '';
    if (!q.trim()) return jsonRes(res, 400, { error:'Missing q' });
    const allItems = await allRows('items', 'created_at', false);
    const allCoupons = (await allRows('coupons')).map(toCoupon);
    const matchedItems = [];
    for (const item of fuzzyMatchItems(q, allItems)) {
      const pool = await couponsForItem(item);
      matchedItems.push({ ...item, coupons:pool, couponResult:applyBestCoupon(item, pool), _score:matchScore(q, `${item.name} ${item.category || ''}`) });
    }
    const catalogHits = (await searchCatalog(q, '')).map(c => ({
      name:c.name, store:c.store, current:c.price, original:c.original,
      target:Math.round(c.price * 0.85), image:c.image || '',
      category:c.category, description:c.description || c.name,
      trend:'stable', _fromCatalog:true, _score:matchScore(q, norm(`${c.name} ${c.category}`))
    }));
    const matchedCoupons = allCoupons.filter(c => queryMatchesCoupon(q, c));
    const scores = {};
    matchedItems.forEach(i => { scores[i.name] = i._score; });
    catalogHits.forEach(i => { scores[i.name] = i._score; });
    await saveSearch(q, '', matchedItems.length + catalogHits.length + matchedCoupons.length, scores);
    return jsonRes(res, 200, { query:q, items:matchedItems, catalogItems:catalogHits, coupons:matchedCoupons });
  }

  if (url.pathname === '/api/catalog' && req.method === 'GET') {
    const q = url.searchParams.get('q') || '';
    const store = url.searchParams.get('store') || '';
    if (q.trim()) {
      const hits = await searchCatalog(q, store);
      return jsonRes(res, 200, { catalog:hits, total:hits.length });
    }
    const rows = await allRows('catalog', 'category', true);
    return jsonRes(res, 200, { catalog:rows, total:rows.length });
  }

  if (url.pathname === '/api/searches' && req.method === 'GET') {
    const { data } = await sb(supabase.from('searches').select('*').order('searched_at', { ascending:false }).limit(100), 'Loading searches failed');
    return jsonRes(res, 200, { searches:data || [] });
  }

  jsonRes(res, 404, { error:'Not found' });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch(err => {
    console.error(err);
    jsonRes(res, 500, { error:err.message });
  });
});

const ready = seedDatabase();

async function handler(req, res) {
  await ready;
  return handle(req, res);
}

module.exports = { handler, handle, ready };

if (require.main === module) {
ready.then(() => {
  server.listen(PORT, () => {
    console.log(`Dealwise backend -> http://localhost:${PORT}`);
    console.log(`Supabase: ${SUPABASE_URL}`);
    SERPAPI_KEY
      ? console.log('SerpAPI key loaded - real results enabled.')
      : console.log('No SERPAPI_KEY - demo fallback active.');
  });
}).catch(err => {
  console.error('Startup failed:', err.message);
  process.exit(1);
});
}
