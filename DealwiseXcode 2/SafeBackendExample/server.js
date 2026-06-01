// Safe Dealwise backend example.
// This is intentionally a template. Add only official/approved APIs here.
// Never put merchant API keys in the iOS app.

const http = require('node:http');
const { URL } = require('node:url');

const PORT = Number(process.env.PORT || 4174);

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function demoOffer(query, store) {
  const q = normalize(query);
  const base = q.includes('headphone') ? 249 : q.includes('kindle') ? 99 : q.includes('jean') ? 45 : 79;
  return {
    store: store || 'Approved merchant feed',
    price: base,
    original: Math.round(base * 1.25),
    url: `https://www.google.com/search?q=${encodeURIComponent(`${query} ${store || ''} official price coupon`)}`,
    source: 'Demo backend fallback - replace with official merchant or coupon APIs'
  };
}

async function getApprovedOffers(query, store) {
  // TODO examples:
  // 1. Call eBay Browse API from this backend using OAuth.
  // 2. Call Amazon Product Advertising API with signed backend requests.
  // 3. Import merchant-approved affiliate CSV/JSON feeds.
  // 4. Call a coupon provider API where your license permits display/use.
  // Return normalized offers only from legal sources.
  return [demoOffer(query, store)];
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');

  if (url.pathname === '/api/deals') {
    const q = url.searchParams.get('q') || '';
    const store = url.searchParams.get('store') || '';
    if (!q.trim()) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing q' }));
      return;
    }
    const offers = await getApprovedOffers(q, store);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ offers }));
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`Safe Dealwise backend example running at http://localhost:${PORT}`);
});
