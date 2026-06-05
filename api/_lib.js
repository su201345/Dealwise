// Shared helpers for the Vercel serverless API routes.
// All functions here are pure / stateless so they can be safely imported
// by any /api/*.js handler.

const https = require("node:https");

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

function sendJson(res, status, body) {
  res.status(status).setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-cache");
  res.send(JSON.stringify(body));
}

function readJsonBody(req) {
  // Vercel parses JSON bodies automatically when `content-type: application/json`
  // is set — req.body will already be the parsed object. Fall back to manual
  // parsing for raw streams (just in case).
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string") {
    try { return Promise.resolve(JSON.parse(req.body)); } catch { return Promise.resolve({}); }
  }
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) { reject(new Error("Body too large")); req.destroy(); }
    });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (error) { reject(error); }
    });
    req.on("error", reject);
  });
}

function productImageUrl(keywords) {
  const q = String(keywords || "product").trim().slice(0, 80);
  return `https://tse.mm.bing.net/th?q=${encodeURIComponent(q)}&w=400&h=400&c=7`;
}

function verifyUrl(rawUrl, { method = "HEAD", redirects = 3 } = {}) {
  return new Promise(resolve => {
    let parsed;
    try { parsed = new URL(rawUrl); } catch { return resolve(false); }
    if (!/^https?:$/.test(parsed.protocol)) return resolve(false);
    const lib = parsed.protocol === "https:" ? https : require("node:http");
    const req = lib.request({
      method,
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        accept: "text/html,*/*"
      }
    }, response => {
      const code = response.statusCode || 0;
      response.resume();
      if (code >= 300 && code < 400 && response.headers.location && redirects > 0) {
        const next = new URL(response.headers.location, parsed).toString();
        resolve(verifyUrl(next, { method, redirects: redirects - 1 }));
        return;
      }
      if (method === "HEAD" && (code === 405 || code === 403)) {
        resolve(verifyUrl(rawUrl, { method: "GET", redirects }));
        return;
      }
      resolve(code >= 200 && code < 400);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(4000, () => { req.destroy(); resolve(false); });
    req.end();
  });
}

function retailerSearchUrl(retailer, name, store) {
  const q = encodeURIComponent(name);
  const fulfill = (store || "").trim().toLowerCase();
  switch ((retailer || "").trim().toLowerCase()) {
    case "amazon":
      return `https://www.amazon.com/s?k=${q}`;
    case "best buy":
    case "bestbuy": {
      let base = `https://www.bestbuy.com/site/searchpage.jsp?st=${q}`;
      if (fulfill === "pick up" || fulfill === "pickup" || fulfill === "in-store") base += "&qp=availability_facet%3DAvailability~Store%20Pickup";
      return base;
    }
    case "walmart": {
      let base = `https://www.walmart.com/search?q=${q}`;
      if (fulfill === "pick up" || fulfill === "pickup") base += "&facet=fulfillment_method_in_store%3APickup";
      else if (fulfill === "delivery") base += "&facet=fulfillment_method_in_store%3ADelivery";
      else if (fulfill === "in-store") base += "&facet=fulfillment_method_in_store%3AIn-store";
      return base;
    }
    case "target": {
      let base = `https://www.target.com/s?searchTerm=${q}`;
      if (fulfill === "pick up" || fulfill === "pickup" || fulfill === "in-store") base += "&facetedValue=5y9p3";
      else if (fulfill === "delivery") base += "&facetedValue=5y9p2";
      return base;
    }
    case "ebay":
      return `https://www.ebay.com/sch/i.html?_nkw=${q}`;
    case "costco":
      return `https://www.costco.com/CatalogSearch?keyword=${q}`;
    default:
      return `https://www.google.com/search?q=${q}`;
  }
}

function groqGenerate(prompt) {
  return new Promise((resolve, reject) => {
    if (!GROQ_API_KEY) {
      reject(new Error("No GROQ_API_KEY configured"));
      return;
    }
    const body = JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a shopping assistant. Reply with only valid JSON matching the user's requested schema." },
        { role: "user", content: prompt }
      ]
    });
    const options = {
      method: "POST",
      hostname: "api.groq.com",
      path: "/openai/v1/chat/completions",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
        authorization: `Bearer ${GROQ_API_KEY}`
      }
    };
    const request = https.request(options, response => {
      let data = "";
      response.on("data", chunk => { data += chunk; });
      response.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Groq HTTP ${response.statusCode}: ${data.slice(0, 200)}`));
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const text = parsed?.choices?.[0]?.message?.content || "";
          resolve(text);
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
    request.setTimeout(12000, () => request.destroy(new Error("Groq request timed out")));
    request.write(body);
    request.end();
  });
}

function buildSuggestionPrompt(query, target, store, pref, filters = {}) {
  let storeLine;
  switch ((store || "").toLowerCase()) {
    case "in-store":
      storeLine = "The shopper wants to buy in-store, so favor products widely stocked at physical retail chains (Target, Best Buy, Walmart, Costco).";
      break;
    case "delivery":
      storeLine = "The shopper wants delivery, so favor products eligible for fast home delivery from major online retailers (Amazon Prime, Walmart, Target delivery).";
      break;
    case "pick up":
    case "pickup":
      storeLine = "The shopper wants in-store pickup, so favor products available for same-day or next-day pickup at chains like Best Buy, Target, Walmart, Home Depot.";
      break;
    default:
      storeLine = "The shopper has no fulfillment preference.";
  }

  let prefLine;
  if (pref === "quality") {
    prefLine = `The shopper prioritizes QUALITY over price: suggest higher-end, well-reviewed, premium models from reputable brands, even if they cost more. Order them from highest quality to lowest.`;
  } else if (pref === "custom" && target > 0) {
    prefLine = `The shopper set a target price of about $${target}. Suggest products whose "current" price is near or below $${target} where realistic, and order them cheapest first.`;
  } else {
    prefLine = `The shopper prioritizes the CHEAPEST good options: suggest budget-friendly, value-for-money products with the lowest realistic prices. Order them cheapest first.`;
  }

  const filterLines = [];
  if (filters.minPrice > 0) filterLines.push(`- The "current" price must be at least $${filters.minPrice}.`);
  if (filters.maxPrice > 0) filterLines.push(`- The "current" price must be at most $${filters.maxPrice}.`);
  if (filters.age) filterLines.push(`- Item condition preference: ${filters.age}. Prefer products explicitly available in that condition.`);
  if (filters.brands && filters.brands.length) filterLines.push(`- Only suggest items from these brands: ${filters.brands.join(", ")}.`);
  const filterBlock = filterLines.length ? `\nHARD FILTERS (do not violate):\n${filterLines.join("\n")}\n` : "";

  return `You are a shopping assistant for a price-tracking app. A shopper typed this item to track: "${query}".
${storeLine}
${prefLine}
${filterBlock}
Return EXACTLY 4 realistic possible product matches a shopper might want to track for that query, across major US retailers (Amazon, Best Buy, Walmart, Target, eBay). Use real, plausible product/model names — not generic placeholders.

Respond ONLY with a JSON object of the form { "suggestions": [ ...4 items... ] } where each item is shaped exactly like:
{
  "name": "specific product name",
  "store": "one of Amazon, Best Buy, Walmart, Target, eBay",
  "current": <integer current price in USD>,
  "original": <integer list/original price in USD, >= current>,
  "category": "short product category label",
  "description": "one sentence about the product",
  "imageKeywords": "2-5 word search phrase that best finds a photo of this exact product, e.g. brand + model",
  "productUrl": "REQUIRED: a URL that takes the shopper directly to this product on the chosen retailer. Strongly prefer the retailer's own search URL because direct product IDs are often outdated — that way the link cannot 404. Format: https://www.amazon.com/s?k=<product+name>, https://www.walmart.com/search?q=<product+name>, https://www.target.com/s?searchTerm=<product+name>, https://www.bestbuy.com/site/searchpage.jsp?st=<product+name>, https://www.ebay.com/sch/i.html?_nkw=<product+name>. Only use a direct /dp/, /ip/, /p/, /site/...p, or /itm/ URL if you are highly confident the exact product ID is current. NEVER return a Google Shopping URL.",
  "bestFor": ["short phrase", "short phrase"],
  "watchFor": ["short caution", "short caution"]
}
Do not include any text outside the JSON.`;
}

function parseSuggestionItems(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const arr = text.match(/\[[\s\S]*\]/);
    const obj = text.match(/\{[\s\S]*\}/);
    if (arr) parsed = JSON.parse(arr[0]);
    else if (obj) parsed = JSON.parse(obj[0]);
    else throw new Error("LLM returned no JSON");
  }
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.suggestions)) return parsed.suggestions;
  throw new Error("LLM JSON had no suggestions array");
}

async function normalizeSuggestions(items, query, target, store) {
  const built = items.slice(0, 4).map(item => {
    const current = Math.max(1, Math.round(Number(item.current) || target || 100));
    const original = Math.max(current, Math.round(Number(item.original) || Math.round(current * 1.2)));
    const name = String(item.name || query).slice(0, 90);
    let productUrl = "";
    try {
      const candidate = String(item.productUrl || "").trim();
      if (candidate && /^https?:\/\//i.test(candidate)) {
        const u = new URL(candidate);
        const host = u.hostname.toLowerCase();
        const isSearchEngine = host.endsWith("google.com") || host.endsWith("bing.com") || host.endsWith("duckduckgo.com");
        if (u.hostname && u.hostname.includes(".") && !isSearchEngine) productUrl = u.toString();
      }
    } catch (_) {}
    return {
      name,
      store: String(item.store || ""),
      productUrl,
      target: target > 0 ? target : current,
      current,
      original,
      trend: "stable",
      image: productImageUrl(item.imageKeywords || name),
      category: String(item.category || "Suggested product"),
      description: String(item.description || `${query} match suggested by Dealwise.`),
      specs: Array.isArray(item.specs) ? item.specs.slice(0, 6).map(String) : [],
      bestFor: Array.isArray(item.bestFor) ? item.bestFor.slice(0, 4).map(String) : [],
      watchFor: Array.isArray(item.watchFor)
        ? item.watchFor.slice(0, 4).map(String)
        : ["Confirm the exact model, seller, condition, and return policy before buying"],
      learnedFacts: []
    };
  }).filter(item => item.name);

  await Promise.all(built.map(async item => {
    const retailer = item.store;
    const fallback = retailerSearchUrl(retailer, item.name, store);
    if (!item.productUrl) { item.productUrl = fallback; return; }
    const ok = await verifyUrl(item.productUrl);
    if (!ok) item.productUrl = fallback;
  }));

  return built;
}

async function groqSuggestions(query, target, store, pref = "cheapest", filters = {}) {
  const text = await groqGenerate(buildSuggestionPrompt(query, target, store, pref, filters));
  return await normalizeSuggestions(parseSuggestionItems(text), query, target, store);
}

function fetchHtml(rawUrl, redirects = 5) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(rawUrl); } catch { return reject(new Error("bad url")); }
    if (!/^https?:$/.test(parsed.protocol)) return reject(new Error("non-http"));
    const lib = parsed.protocol === "https:" ? https : require("node:http");
    const req = lib.request({
      method: "GET",
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9"
      }
    }, response => {
      const code = response.statusCode || 0;
      if (code >= 300 && code < 400 && response.headers.location && redirects > 0) {
        const next = new URL(response.headers.location, parsed).toString();
        response.resume();
        resolve(fetchHtml(next, redirects - 1));
        return;
      }
      if (code >= 400) { response.resume(); reject(new Error(`HTTP ${code}`)); return; }
      let body = "";
      response.setEncoding("utf8");
      response.on("data", chunk => {
        body += chunk;
        if (body.length > 800_000) { req.destroy(); resolve(body); }
      });
      response.on("end", () => resolve(body));
    });
    req.on("error", reject);
    req.setTimeout(7000, () => { req.destroy(new Error("timeout")); });
    req.end();
  });
}

function extractPrice(html, hostname) {
  if (!html) return null;
  const ldMatches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of ldMatches) {
    const inner = block.replace(/<script[^>]*>|<\/script>/gi, "");
    try {
      const data = JSON.parse(inner.trim());
      const candidates = Array.isArray(data) ? data : [data];
      for (const c of candidates) {
        const offers = c && c.offers;
        if (!offers) continue;
        const offer = Array.isArray(offers) ? offers[0] : offers;
        const price = Number((offer && offer.price) || (offer && offer.lowPrice) || (offer && offer.highPrice));
        if (price > 0 && price < 100_000) return price;
      }
    } catch (_) {}
  }
  const og = html.match(/<meta\s+property=["']product:price:amount["']\s+content=["']([\d.]+)["']/i);
  if (og) { const v = Number(og[1]); if (v > 0) return v; }
  let m;
  if (/amazon\./i.test(hostname)) {
    m = html.match(/"priceAmount"\s*:\s*"?([\d.]+)/) || html.match(/<span class="a-offscreen">\s*\$([\d,]+\.\d{2})/);
  } else if (/walmart\./i.test(hostname)) {
    m = html.match(/"price"\s*:\s*([\d.]+)/);
  } else if (/target\./i.test(hostname)) {
    m = html.match(/"current_retail"\s*:\s*([\d.]+)/);
  } else if (/bestbuy\./i.test(hostname)) {
    m = html.match(/"customerPrice"\s*:\s*([\d.]+)/);
  } else if (/ebay\./i.test(hostname)) {
    m = html.match(/"price"\s*:\s*"?\$?([\d.]+)/);
  }
  if (m) {
    const v = Number(String(m[1]).replace(/,/g, ""));
    if (v > 0 && v < 100_000) return v;
  }
  return null;
}

module.exports = {
  GROQ_API_KEY,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  sendJson,
  readJsonBody,
  productImageUrl,
  retailerSearchUrl,
  groqGenerate,
  groqSuggestions,
  fetchHtml,
  extractPrice
};
