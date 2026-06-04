const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");

// Minimal .env loader (no dependency): populate process.env from a local .env file.
function loadEnv() {
  try {
    const raw = fsSync.readFileSync(path.join(__dirname, ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // No .env file is fine; we fall back to built-in suggestions.
  }
}
loadEnv();

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

const productImages = {
  sony: "https://www.sony.com/image/1faff1a8d2f9b518cb2ef53f2c1d5af3?fmt=png-alpha&wid=960",
  instantPot: "https://commons.wikimedia.org/wiki/Special:FilePath/Instant%20Pot%20%2849907000991%29.jpg?width=900",
  kindle: "https://commons.wikimedia.org/wiki/Special:FilePath/2023%20Amazon%20Kindle%20Paperwhite%20%283%29.jpg?width=900",
  levis: "https://commons.wikimedia.org/wiki/Special:FilePath/Levis%20501%20rear%20detail.jpg?width=900",
  laptopA: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&auto=format&fit=crop&q=80",
  laptopB: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80",
  laptopC: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&auto=format&fit=crop&q=80",
  laptopD: "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=800&auto=format&fit=crop&q=80",
  phone: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&auto=format&fit=crop&q=80",
  headphonesBudget: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80",
  kitchenBudget: "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=800&auto=format&fit=crop&q=80",
  clothingBudget: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80",
  shoppingBudget: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&auto=format&fit=crop&q=80"
};

const budgetCatalog = {
  laptop: [
    { name: "Acer Aspire 5 Slim", store: "Amazon", target: 420, current: 349, original: 499, image: productImages.laptopA, category: "Budget laptop", description: "A practical Windows laptop option for school, browsing, documents, and everyday work.", specs: ["15-inch class display", "Everyday productivity", "Lower-cost Windows option"], bestFor: ["Students", "Basic work", "Budget replacement"], watchFor: ["Confirm RAM and storage before buying", "Check processor generation"] },
    { name: "Lenovo IdeaPad Slim 3", store: "Best Buy", target: 450, current: 379, original: 529, image: productImages.laptopB, category: "Budget laptop", description: "A value-focused laptop line often discounted for everyday home and school use.", specs: ["Portable chassis", "Everyday keyboard", "Frequent sale pricing"], bestFor: ["Home office", "School", "Streaming"], watchFor: ["Avoid low-memory configurations", "Check display brightness"] },
    { name: "ASUS Vivobook 15", store: "Walmart", target: 430, current: 399, original: 549, image: productImages.laptopC, category: "Budget laptop", description: "A common budget-friendly notebook family with a large screen and mainstream specs.", specs: ["15-inch class display", "Windows laptop", "Often available under $450"], bestFor: ["Large-screen browsing", "Documents", "Video calls"], watchFor: ["Compare CPU and RAM between listings"] },
    { name: "Refurbished MacBook Air M1", store: "eBay", target: 650, current: 579, original: 799, image: productImages.laptopD, category: "Budget Mac option", description: "A lower-cost way to stay in the Mac ecosystem if you are comfortable buying refurbished.", specs: ["Apple silicon", "Lightweight body", "Long battery life"], bestFor: ["Mac users", "Battery life", "Portable work"], watchFor: ["Verify battery health", "Buy from a reputable refurbisher"] }
  ],
  headphones: [
    { name: "Anker Soundcore Life Q30", store: "Amazon", target: 70, current: 59, original: 89, image: productImages.headphonesBudget, category: "Budget noise-canceling headphones", description: "A popular low-cost ANC headphone option with strong battery life.", specs: ["Active noise cancellation", "Long battery life", "App EQ"], bestFor: ["Commutes", "Budget ANC", "Work calls"], watchFor: ["Build quality is not premium"] },
    { name: "Sony WH-CH720N", store: "Best Buy", target: 100, current: 88, original: 149, image: productImages.sony, category: "Value noise-canceling headphones", description: "Sony's lighter, lower-cost ANC model below the flagship XM line.", specs: ["Noise canceling", "Lightweight", "Bluetooth"], bestFor: ["Sony sound on a budget", "Travel"], watchFor: ["ANC is weaker than XM models"] },
    { name: "JBL Tune 760NC", store: "Walmart", target: 85, current: 69, original: 129, image: productImages.headphonesBudget, category: "Budget headphones", description: "An affordable over-ear option often found on sale.", specs: ["Wireless", "Noise canceling", "Foldable"], bestFor: ["Bass-forward sound", "Sale buyers"], watchFor: ["Comfort varies by head size"] },
    { name: "Skullcandy Hesh ANC", store: "Target", target: 95, current: 79, original: 134, image: productImages.headphonesBudget, category: "Budget ANC headphones", description: "A lower-priced ANC headphone with simple controls and broad retail availability.", specs: ["ANC", "Wireless", "Over-ear design"], bestFor: ["Casual listening", "Gift buying"], watchFor: ["Check return policy for comfort"] }
  ],
  kitchen: [
    { name: "Instant Pot Duo 6-Quart", store: "Target", target: 70, current: 69, original: 99, image: productImages.instantPot, category: "Budget multi-cooker", description: "The classic pressure cooker size and feature set for most households.", specs: ["6-quart", "Pressure cook", "Slow cook"], bestFor: ["Meal prep", "Rice and beans"], watchFor: ["Confirm exact size"] },
    { name: "Crock-Pot Express 6-Quart", store: "Walmart", target: 65, current: 59, original: 89, image: productImages.kitchenBudget, category: "Budget pressure cooker", description: "A low-cost multi-cooker alternative for basic pressure cooking.", specs: ["6-quart", "One-pot meals", "Simple controls"], bestFor: ["Budget kitchens", "Batch cooking"], watchFor: ["Accessory ecosystem is smaller"] },
    { name: "Hamilton Beach Multi-Cooker", store: "Amazon", target: 60, current: 54, original: 79, image: productImages.kitchenBudget, category: "Budget multi-cooker", description: "A value cooker for simple weeknight meals.", specs: ["Multiple presets", "Compact footprint", "Lower price"], bestFor: ["Small kitchens", "Simple meals"], watchFor: ["Fewer premium features"] },
    { name: "Ninja Foodi PossibleCooker", store: "Best Buy", target: 100, current: 89, original: 129, image: productImages.kitchenBudget, category: "Value cooker", description: "A slightly higher-budget option with flexible cooking modes.", specs: ["Multi-function cooking", "Family-size pot", "Oven-safe pot on some models"], bestFor: ["Family meals", "Flexible cooking"], watchFor: ["Check model-specific features"] }
  ],
  clothing: [
    { name: "Levi's 505 Regular Jeans", store: "Amazon", target: 45, current: 39, original: 69, image: productImages.levis, category: "Budget denim", description: "A lower-cost Levi's alternative with a regular straight fit.", specs: ["Regular fit", "Straight leg", "Classic denim"], bestFor: ["Everyday denim", "Value Levi's"], watchFor: ["Wash affects sizing"] },
    { name: "Wrangler Authentics Regular Fit", store: "Walmart", target: 32, current: 26, original: 39, image: productImages.clothingBudget, category: "Budget jeans", description: "A very affordable everyday denim option.", specs: ["Regular fit", "Five-pocket styling", "Workwear value"], bestFor: ["Lowest price", "Casual wear"], watchFor: ["Fabric feel varies"] },
    { name: "Amazon Essentials Slim-Fit Jeans", store: "Amazon", target: 35, current: 29, original: 42, image: productImages.clothingBudget, category: "Budget jeans", description: "A simple house-brand denim option for basic outfits.", specs: ["Slim fit", "Stretch denim", "Low price"], bestFor: ["Basic wardrobe", "Budget replacement"], watchFor: ["Check reviews for sizing"] },
    { name: "Target Goodfellow Jeans", store: "Target", target: 36, current: 30, original: 40, image: productImages.clothingBudget, category: "Budget denim", description: "A clean, inexpensive denim option often available in-store.", specs: ["Modern fits", "Accessible pricing", "Easy returns"], bestFor: ["Try-on convenience", "Budget basics"], watchFor: ["Inventory varies by store"] }
  ],
  default: [
    { name: "Budget-friendly starter option", store: "Amazon", target: 80, current: 59, original: 99, image: productImages.shoppingBudget, category: "Budget pick", description: "The lowest-cost option Dealwise found for comparison shopping.", specs: ["Low price", "Basic feature set", "Good first comparison"], bestFor: ["Saving money", "Trying the category"], watchFor: ["Verify exact specs and seller"] },
    { name: "Best value midrange option", store: "Target", target: 120, current: 89, original: 139, image: productImages.shoppingBudget, category: "Value pick", description: "A balanced option with better expected quality than the cheapest listing.", specs: ["Midrange price", "Better feature mix", "Broad availability"], bestFor: ["Most buyers", "Balanced value"], watchFor: ["Compare warranty and returns"] },
    { name: "Open-box deal option", store: "Best Buy", target: 150, current: 109, original: 179, image: productImages.shoppingBudget, category: "Open-box value", description: "A budget option to consider if open-box condition is acceptable.", specs: ["Discounted condition", "Return-window dependent", "Potential high value"], bestFor: ["Deal hunters", "Flexible buyers"], watchFor: ["Inspect condition and warranty"] },
    { name: "Refurbished budget option", store: "eBay", target: 140, current: 99, original: 169, image: productImages.shoppingBudget, category: "Refurbished pick", description: "A lower-price option where seller ratings matter more.", specs: ["Refurbished", "Lower price", "Seller-dependent"], bestFor: ["Maximum savings", "Non-urgent purchases"], watchFor: ["Only buy from highly rated sellers"] }
  ]
};

budgetCatalog.phone = [
  { name: "Requested phone offer", store: "Amazon", target: 900, current: 829, original: 999, image: productImages.phone, category: "Phone offer", description: "A store offer for the exact phone you searched.", specs: ["Smartphone", "Store offer", "Compare final checkout price"], bestFor: ["Phone deal tracking"], watchFor: ["Confirm storage, carrier lock, condition, and return policy"] }
];

const reviewKnowledge = {
  "sony wh 1000xm5 headphones": {
    summary: "Review consensus is very strong: reviewers consistently praise noise canceling, sound quality, comfort, and battery life.",
    ratings: [
      "Tom's Guide: 4.5/5, praising flagship performance and features.",
      "What Hi-Fi?: 5/5, highlighting sound quality and ANC.",
      "Digital Trends: Editors' Choice, calling them still among the best overall headphones.",
      "RTINGS: detailed lab-tested review with strong overall performance, especially for commute/travel use."
    ],
    complaints: [
      "They do not fold like older Sony models.",
      "No aptX support.",
      "Some users find long-session heat or fit less ideal.",
      "ANC expectations vary in some user reviews."
    ]
  }
};

const productCatalog = [
  {
    name: "Sony WH-1000XM5 Headphones",
    store: "Amazon",
    target: 280,
    current: 279,
    original: 349,
    trend: "dropping",
    image: productImages.sony,
    category: "Wireless noise-canceling headphones",
    description: "Premium over-ear Bluetooth headphones known for strong active noise cancellation, long battery life, multipoint pairing, and lightweight comfort.",
    specs: ["Active noise cancellation", "Up to 30 hours battery life", "Bluetooth multipoint", "USB-C quick charge", "Touch controls"],
    bestFor: ["Travel", "Open offices", "Long listening sessions"],
    watchFor: ["No folding hinges", "Often discounted during major retail events"],
    searchTerms: ["sony wh-1000xm5 headphones", "xm5 noise cancelling headphones"]
  },
  {
    name: "Instant Pot Duo 7-in-1",
    store: "Target",
    target: 70,
    current: 89,
    original: 99,
    trend: "dropping",
    image: productImages.instantPot,
    category: "Multi-cooker",
    description: "A versatile electric pressure cooker that also handles slow cooking, rice, steaming, sauteing, yogurt, and warming.",
    specs: ["7 cooking modes", "Stainless steel inner pot", "Programmable presets", "6-quart size is common"],
    bestFor: ["Batch cooking", "Rice and beans", "Weeknight meal prep"],
    watchFor: ["Check capacity before buying", "Duo Plus and Pro models add upgraded controls"],
    searchTerms: ["instant pot duo 7 in 1", "instant pot duo pressure cooker"]
  },
  {
    name: "Kindle Paperwhite",
    store: "Amazon",
    target: 100,
    current: 109,
    original: 139,
    trend: "stable",
    image: productImages.kindle,
    category: "E-reader",
    description: "A waterproof Kindle with a glare-free display, adjustable warm light, and weeks of battery life for reading books and documents.",
    specs: ["Waterproof design", "Adjustable warm light", "USB-C charging", "High-resolution glare-free display"],
    bestFor: ["Travel reading", "Night reading", "Library ebooks"],
    watchFor: ["Ad-supported models cost less", "Storage needs depend on comics/audiobooks"],
    searchTerms: ["kindle paperwhite", "amazon kindle paperwhite"]
  },
  {
    name: "Levi's 501 Jeans",
    store: "Levi's",
    target: 55,
    current: 48,
    original: 79,
    trend: "low",
    image: productImages.levis,
    category: "Straight-leg denim",
    description: "Classic button-fly straight jeans with a regular fit through the thigh and a timeless five-pocket look.",
    specs: ["Button fly", "Straight leg", "Cotton denim", "Classic five-pocket styling"],
    bestFor: ["Everyday casual outfits", "Durable basics", "Vintage-inspired denim"],
    watchFor: ["Wash affects fit and feel", "Check inseam and shrink guidance"],
    searchTerms: ["levis 501 jeans", "levi 501 original fit"]
  }
];

const learnedFacts = new Map();

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-cache"
  });
  res.end(payload);
}

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreProduct(query, product) {
  const q = normalize(query);
  const haystack = normalize([
    product.name,
    product.store,
    product.category,
    product.description,
    ...(product.searchTerms || [])
  ].join(" "));
  if (!q) return 0;
  if (haystack.includes(q)) return 100;
  return q.split(" ").reduce((score, word) => score + (word.length > 2 && haystack.includes(word) ? 12 : 0), 0);
}

function findProducts(query, extraProducts = []) {
  return [...productCatalog, ...extraProducts]
    .map(product => ({ ...product, score: scoreProduct(query, product) }))
    .filter(product => product.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

function inferBudgetCategory(query) {
  const q = normalize(query);
  if (/\b(macbook|laptop|notebook|computer|chromebook|windows|pc)\b/.test(q)) return "laptop";
  if (/\b(iphone|phone|smartphone|android|pixel|galaxy|mobile)\b/.test(q)) return "phone";
  if (/\b(headphone|earbud|speaker|audio|anc|sony|bose)\b/.test(q)) return "headphones";
  if (/\b(pot|cooker|air fryer|blender|kitchen|pan)\b/.test(q)) return "kitchen";
  if (/\b(jeans|shirt|shoes|sneaker|jacket|clothing|pants)\b/.test(q)) return "clothing";
  return "default";
}

const offerStores = ["Amazon", "Best Buy", "Walmart", "eBay"];

function typedProductOption(query, target = 0, store = "", offerIndex = 0) {
  const category = inferBudgetCategory(query);
  const fallback = budgetCatalog[category][0] || budgetCatalog.default[0];
  const base = Number(target) > 0 ? Number(target) : fallback.current;
  const multipliers = [0.92, 0.97, 1, 1.08];
  const price = Math.max(1, Math.round(base * multipliers[offerIndex]));
  const offerStore = store || offerStores[offerIndex] || "Any store";
  return {
    name: query,
    store: offerStore,
    target: base,
    current: price,
    original: Math.round(price * 1.22),
    trend: "stable",
    image: fallback.image,
    imageSource: "Google-style category image",
    category: `${category === "laptop" ? "Requested laptop" : "Requested product"} offer`,
    description: `${query} offer from ${offerStore}. Dealwise keeps the product fixed and compares stores by final price.`,
    specs: [],
    bestFor: ["Tracking the exact item you requested"],
    watchFor: ["Confirm the exact model, seller, condition, and return policy before buying"],
    sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(`${query} ${offerStore} price reviews`)}`
  };
}

function storeOffersForQuery(query, target = 0, preferredStore = "") {
  const stores = preferredStore
    ? [preferredStore, ...offerStores.filter(store => normalize(store) !== normalize(preferredStore))]
    : offerStores;
  return stores.slice(0, 4)
    .map((store, index) => typedProductOption(query, target, store, index))
    .sort((a, b) => a.current - b.current);
}

async function googleImageLookup(query) {
  const url = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "accept-language": "en-US,en;q=0.9"
      }
    });
    if (!response.ok) return "";
    const html = await response.text();
    const direct = [...html.matchAll(/https?:\\\/\\\/[^"'\\\s<>]+?\.(?:jpg|jpeg|png|webp)/gi)]
      .map(match => match[0].replaceAll("\\/", "/"))
      .find(src => !src.includes("google") && !src.includes("gstatic"));
    return direct || "";
  } catch {
    return "";
  }
}

async function budgetSuggestions(query) {
  const category = inferBudgetCategory(query);
  const base = budgetCatalog[category].map((item, index) => ({
    ...item,
    sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(`${item.name} product price`)}`,
    imageSource: "curated web image",
    current: item.current + index * 0
  }));

  const hydrated = [];
  for (const item of base.slice(0, 4)) {
    const googleImage = await googleImageLookup(`${item.name} product image`);
    hydrated.push({
      ...item,
      image: googleImage || item.image,
      imageSource: googleImage ? "Google Images" : item.imageSource
    });
  }

  return hydrated.sort((a, b) => a.current - b.current).slice(0, 4);
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function googleLookup(query) {
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 DealwiseBot/1.0",
        "accept-language": "en-US,en;q=0.9"
      }
    });
    if (!response.ok) return { sourceUrl: url, results: [] };
    const html = await response.text();
    const titles = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)]
      .map(match => stripTags(match[1]))
      .filter(Boolean);
    const snippets = [...html.matchAll(/<div[^>]*class="[^"]*(?:VwiC3b|BNeawe)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)]
      .map(match => stripTags(match[1]))
      .filter(text => text.length > 35);
    const results = titles.slice(0, 5).map((title, index) => ({
      title,
      snippet: snippets[index] || ""
    }));
    return { sourceUrl: url, results };
  } catch {
    return { sourceUrl: url, results: [] };
  }
}

function productSummary(product) {
  const facts = learnedFacts.get(product.name) || [];
  return {
    name: product.name,
    store: product.store || "No store preference",
    target: product.target,
    current: product.current,
    original: product.original,
    trend: product.trend || "stable",
    image: product.image || "",
    category: product.category || "Tracked product",
    description: product.description || "A tracked item in your Dealwise watchlist.",
    specs: product.specs || [],
    bestFor: product.bestFor || [],
    watchFor: product.watchFor || [],
    learnedFacts: facts
  };
}

// Build a relevant product photo URL from a name/keywords using Bing's public
// thumbnail endpoint, which returns an actual image matching the query.
function productImageUrl(keywords) {
  const q = String(keywords || "product").trim().slice(0, 80);
  return `https://tse.mm.bing.net/th?q=${encodeURIComponent(q)}&w=400&h=400&c=7`;
}

function geminiGenerate(prompt) {
  return new Promise((resolve, reject) => {
    if (!GEMINI_API_KEY) {
      reject(new Error("No GEMINI_API_KEY configured"));
      return;
    }
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, responseMimeType: "application/json" }
    });
    const options = {
      method: "POST",
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) }
    };
    const request = https.request(options, response => {
      let data = "";
      response.on("data", chunk => { data += chunk; });
      response.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Gemini HTTP ${response.statusCode}: ${data.slice(0, 200)}`));
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const text = parsed?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "";
          resolve(text);
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
    request.setTimeout(12000, () => request.destroy(new Error("Gemini request timed out")));
    request.write(body);
    request.end();
  });
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

function buildSuggestionPrompt(query, target, store, pref) {
  // "store" here is a fulfillment preference: In-store / Out-of-store / Delivery / Pick up.
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

  return `You are a shopping assistant for a price-tracking app. A shopper typed this item to track: "${query}".
${storeLine}
${prefLine}

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
  "bestFor": ["short phrase", "short phrase"],
  "watchFor": ["short caution", "short caution"]
}
Do not include any text outside the JSON.`;
}

function parseSuggestionItems(text) {
  // Accept either { suggestions: [...] } or a bare [...] array, with optional surrounding prose.
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

function normalizeSuggestions(items, query, target, store) {
  return items.slice(0, 4).map(item => {
    const current = Math.max(1, Math.round(Number(item.current) || target || 100));
    const original = Math.max(current, Math.round(Number(item.original) || Math.round(current * 1.2)));
    const name = String(item.name || query).slice(0, 90);
    return {
      name,
      store: store || String(item.store || ""),
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
}

async function geminiSuggestions(query, target, store, pref = "cheapest") {
  const text = await geminiGenerate(buildSuggestionPrompt(query, target, store, pref));
  return normalizeSuggestions(parseSuggestionItems(text), query, target, store);
}

async function groqSuggestions(query, target, store, pref = "cheapest") {
  const text = await groqGenerate(buildSuggestionPrompt(query, target, store, pref));
  return normalizeSuggestions(parseSuggestionItems(text), query, target, store);
}

async function handleSuggest(req, res, url) {
  const query = url.searchParams.get("q") || "";
  const target = Number(url.searchParams.get("target") || 0);
  const store = url.searchParams.get("store") || "";
  const pref = url.searchParams.get("pref") || "cheapest";
  const matches = findProducts(query);
  const offers = storeOffersForQuery(query, target, store);

  if (matches.length) {
    sendJson(res, 200, {
      query,
      source: "store-offers",
      suggestions: offers
    });
    return;
  }

  if (GEMINI_API_KEY) {
    try {
      const geminiResults = await geminiSuggestions(query, target, store, pref);
      if (geminiResults.length) {
        sendJson(res, 200, {
          query,
          source: "gemini",
          suggestions: geminiResults
        });
        return;
      }
    } catch (error) {
      console.error("Gemini suggest failed, falling back:", error.message);
    }
  }

  if (GROQ_API_KEY) {
    try {
      const groqResults = await groqSuggestions(query, target, store, pref);
      if (groqResults.length) {
        sendJson(res, 200, {
          query,
          source: "groq",
          suggestions: groqResults
        });
        return;
      }
    } catch (error) {
      console.error("Groq suggest failed, falling back:", error.message);
    }
  }

  const lookup = await googleLookup(`${query} product`);
  const googleSuggestions = lookup.results.slice(0, 4).map((result, index) => ({
    name: result.title.replace(/\s*-\s*.*$/, "").slice(0, 80),
    store: "",
    target: 100 + index * 25,
    current: 115 + index * 25,
    original: 139 + index * 30,
    trend: "stable",
    category: "Google result",
    description: result.snippet || "Suggested from a Google product lookup. Check the store page before buying.",
    specs: [],
    bestFor: [],
    watchFor: ["Verify the exact model, seller, return policy, and current price before purchase."],
    sourceUrl: lookup.sourceUrl
  })).filter(item => item.name);

  const suggestions = offers.map((offer, index) => ({
    ...offer,
    description: googleSuggestions[index]?.description || offer.description,
    sourceUrl: googleSuggestions[index]?.sourceUrl || offer.sourceUrl
  }));

  sendJson(res, 200, {
    query,
    source: googleSuggestions.length ? "google-budget" : "budget-fallback",
    googleUrl: lookup.sourceUrl,
    suggestions
  });
}

function classifyQuestion(question) {
  const q = normalize(question);
  if (/\b(specs?|features?|battery|size|dimensions?|waterproof|noise|material|fit)\b/.test(q)) return "specs";
  if (/\b(buy|worth|deal|good price|pull trigger|purchase)\b/.test(q)) return "buy";
  if (/\b(wait|when|time|timing|sale|black friday|prime day|drop)\b/.test(q)) return "timing";
  if (/\b(coupon|code|promo|discount)\b/.test(q)) return "coupon";
  if (/\b(reviews?|ratings?|complaints?|people say|users say)\b/.test(q)) return "review";
  if (/\b(compare|versus| vs |alternative|instead|better)\b/.test(` ${q} `)) return "compare";
  if (/\b(store|where|seller|amazon|target|best buy|walmart|ebay)\b/.test(q)) return "store";
  if (/\b(risks?|problems?|issues?|watch|fake|return)\b/.test(q)) return "risk";
  return "general";
}

function compactList(values, fallback) {
  return Array.isArray(values) && values.length ? values.slice(0, 3).join(", ") : fallback;
}

function reviewAnswer(product, lead, googleUrl) {
  const known = reviewKnowledge[normalize(product.name)];
  if (known) {
    return `${lead} ${known.summary} Ratings I found saved for this product: ${known.ratings.join(" ")} Common things to watch: ${known.complaints.join(" ")} Google review search: ${googleUrl}`;
  }
  return `${lead} For ${product.name}, review research should focus on repeated complaints, seller condition, and whether the exact model matches the listing. If reviews mention returns or build issues often, skip it even if the price looks good.`;
}

function answerFromProduct(question, product, context = {}) {
  const intent = classifyQuestion(question);
  const variants = [
    "Here is the practical read:",
    "Short version:",
    "My take:",
    "For this item:"
  ];
  const lead = variants[(context.turn || 0) % variants.length];
  const savings = Math.max(product.original - product.current, 0);
  const aboveTarget = Math.max(product.current - product.target, 0);
  const status = product.current <= product.target
    ? "at or below target"
    : product.current <= product.target * 1.15
      ? "close to target"
      : "still above target";
  const facts = learnedFacts.get(product.name) || [];
  const learned = facts.length ? ` I have also saved ${facts.length} extra note${facts.length === 1 ? "" : "s"} for it.` : "";

  if (intent === "specs") {
    return `${lead} ${product.name} is a ${product.category || "tracked product"}. Key details: ${compactList(product.specs, product.description || "no extra specs saved yet")}. Best fit: ${compactList(product.bestFor, "general shopping comparison")}.${learned}`;
  }

  if (intent === "buy") {
    const verdict = product.current <= product.target
      ? `I would treat this as buy-ready: ${money(product.current)} is within your ${money(product.target)} target.`
      : `I would wait: ${money(product.current)} is ${money(aboveTarget)} above your ${money(product.target)} target.`;
    return `${lead} ${verdict} You are saving ${money(savings)} versus the original ${money(product.original)} price. Check seller reliability and returns before checkout.`;
  }

  if (intent === "timing") {
    const action = product.trend === "low" || product.current <= product.target
      ? "This is already in a strong buy window."
      : product.trend === "dropping"
        ? "The trend is moving down, so waiting a little longer could pay off."
        : "The price looks stable, so set the target and watch for a coupon or seasonal sale.";
    return `${lead} ${product.name} is ${status} at ${money(product.current)}. ${action} Your target is ${money(product.target)}.`;
  }

  if (intent === "coupon") {
    return `${lead} Try a store-specific coupon first, then compare the final checkout price against ${money(product.target)}. If the code brings ${product.name} to ${money(product.target)} or lower, it becomes a buy-now candidate.`;
  }

  if (intent === "review") {
    return reviewAnswer(product, lead, context.googleUrl || `https://www.google.com/search?q=${encodeURIComponent(`${product.name} reviews rating`)}`);
  }

  if (intent === "compare") {
    return `${lead} Compare ${product.name} on three things: current price (${money(product.current)}), must-have features (${compactList(product.specs, "core specs")}), and return policy. If an alternative misses a must-have feature, it needs to be meaningfully cheaper than ${money(product.target)} to be worth switching.`;
  }

  if (intent === "store") {
    return `${lead} It is tracked at ${product.store || "no preferred store"}. Search multiple sellers, but keep the target at ${money(product.target)} so a cheaper listing does not trick you into buying a worse model.`;
  }

  if (intent === "risk") {
    return `${lead} Watch for: ${compactList(product.watchFor, "seller reputation, exact model number, and return window")}. I would verify those before trusting any unusually low price.`;
  }

  return `${lead} ${product.name} is currently ${money(product.current)} against a ${money(product.target)} target. ${product.description || "It is saved in your watchlist."} The useful next check is whether the exact model and seller match what you intended.`;
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (error) { reject(error); }
    });
    req.on("error", reject);
  });
}

async function handleDealbot(req, res) {
  try {
    const payload = await readJsonBody(req);
    const question = String(payload.question || "").trim();
    if (!question) {
      sendJson(res, 400, { error: "Ask Dealbot a question." });
      return;
    }
    const watchlist = Array.isArray(payload.watchlist) ? payload.watchlist : [];
    const activeProductName = String(payload.activeProductName || "").trim();

    // Build a compact watchlist context for the LLM.
    const watchlistContext = watchlist.length
      ? watchlist.map((item, idx) => {
          const detail = item.details || {};
          const parts = [
            `${idx + 1}. id=${item.id}`,
            `name="${item.name}"`,
            item.retailer ? `retailer=${item.retailer}` : null,
            item.store ? `fulfillment=${item.store}` : null,
            `current=$${item.current}`,
            `target=$${item.target}`,
            `original=$${item.original}`,
            item.trend ? `trend=${item.trend}` : null,
            detail.description ? `desc="${String(detail.description).slice(0, 200)}"` : null,
            detail.review_summary ? `reviews="${String(detail.review_summary).slice(0, 240)}"` : null,
            Array.isArray(detail.pros) && detail.pros.length ? `pros=${detail.pros.slice(0, 4).join("; ")}` : null,
            Array.isArray(detail.cons) && detail.cons.length ? `cons=${detail.cons.slice(0, 4).join("; ")}` : null
          ].filter(Boolean);
          return parts.join(" | ");
        }).join("\n")
      : "(The user's watchlist is empty.)";

    const systemPrompt = `You are Dealbot, a shopping assistant inside a price-tracking web app called Dealwise.
The user's tracked items (with their cached details where available) are listed below. Each line is one item.

${watchlistContext}

Rules:
- If the question references an item that fuzzy-matches one of these by name, brand, or category (e.g. "hoop" -> "Spalding Mini Hoop"), answer about THAT item using its details and prices.
- ${activeProductName ? `The user currently has "${activeProductName}" open. Prefer that unless the question clearly refers to a different tracked item.` : "No item is currently open."}
- If no item matches, say so briefly and offer to track one.
- Be concise (1-3 short paragraphs). Reference real prices/targets from the list when relevant.
- Reply with ONLY this JSON shape, no prose outside it:
{
  "answer": "your reply text",
  "matchedItemId": "<id from the list above, or null if none>"
}`;

    let answer = "";
    let matchedItemId = null;

    if (GROQ_API_KEY) {
      try {
        const raw = await groqGenerate(systemPrompt + "\n\nUser question: " + question);
        const parsed = JSON.parse(raw);
        answer = String(parsed.answer || "").trim();
        matchedItemId = parsed.matchedItemId || null;
      } catch (error) {
        console.error("Dealbot Groq call failed:", error.message);
      }
    }

    if (!answer) {
      answer = "Dealbot is unavailable right now. Try again in a moment.";
    }

    sendJson(res, 200, { answer, matchedItemId });
  } catch (error) {
    sendJson(res, 400, { error: "Dealbot could not read that question." });
  }
}

async function handleProductDetails(req, res) {
  try {
    const payload = await readJsonBody(req);
    const name = String(payload.name || "").trim();
    const retailer = String(payload.retailer || "").trim();
    if (!name) {
      sendJson(res, 400, { error: "Missing product name." });
      return;
    }
    if (!GROQ_API_KEY) {
      sendJson(res, 503, { error: "Groq API key not configured." });
      return;
    }

    const prompt = `You are a shopping research assistant. Write a structured product profile for: "${name}"${retailer ? ` sold at ${retailer}` : ""}.

Respond with ONLY this JSON shape, no prose outside it:
{
  "description": "2-3 sentence overview of what the product is and who it's for",
  "specs": ["short spec or feature", "another", "another", "up to 6"],
  "pros": ["short pro phrase", "another", "up to 4"],
  "cons": ["short con phrase", "another", "up to 4"],
  "review_summary": "1-2 sentence synthesis of typical reviewer sentiment",
  "rating_estimate": "e.g. 4.3/5 average across major retailers, or 'mixed', or 'no reliable data'"
}
Be honest about uncertainty. If the product is obscure or you don't have reliable info, say so in the relevant fields rather than inventing specs.`;

    const text = await groqGenerate(prompt);
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    const details = {
      description: String(parsed.description || "").slice(0, 800),
      specs: Array.isArray(parsed.specs) ? parsed.specs.slice(0, 6).map(s => String(s).slice(0, 120)) : [],
      pros: Array.isArray(parsed.pros) ? parsed.pros.slice(0, 4).map(s => String(s).slice(0, 120)) : [],
      cons: Array.isArray(parsed.cons) ? parsed.cons.slice(0, 4).map(s => String(s).slice(0, 120)) : [],
      review_summary: String(parsed.review_summary || "").slice(0, 600),
      rating_estimate: String(parsed.rating_estimate || "").slice(0, 80),
      generated_at: new Date().toISOString()
    };

    sendJson(res, 200, { details });
  } catch (error) {
    console.error("product-details failed:", error.message);
    sendJson(res, 500, { error: "Could not fetch product details." });
  }
}

async function serveStatic(req, res, url) {
  const pathname = decodeURIComponent(url.pathname === "/" ? "/dealwise.html" : url.pathname);
  const filePath = path.normalize(path.join(ROOT, pathname));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    const finalPath = stat.isDirectory() ? path.join(filePath, "index.html") : filePath;
    const data = await fs.readFile(finalPath);
    const ext = path.extname(finalPath);
    const types = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png"
    };
    res.writeHead(200, { "content-type": types[ext] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (req.method === "GET" && url.pathname === "/api/config") {
    sendJson(res, 200, { supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY });
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/suggest") {
    await handleSuggest(req, res, url);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/product-details") {
    await handleProductDetails(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/dealbot") {
    await handleDealbot(req, res);
    return;
  }
  await serveStatic(req, res, url);
});

server.listen(PORT, () => {
  console.log(`Dealwise backend running at http://localhost:${PORT}/dealwise.html`);
});
