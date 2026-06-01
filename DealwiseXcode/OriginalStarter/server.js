const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;

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

const offerStores = ["Amazon", "Best Buy", "Walmart", "eBay", "Target", "Newegg", "B&H", "Costco", "Apple Store"];

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
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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

async function handleSuggest(req, res, url) {
  const query = url.searchParams.get("q") || "";
  const target = Number(url.searchParams.get("target") || 0);
  const store = url.searchParams.get("store") || "";
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

  const lookup = await googleLookup(`${query} product`);
  const googleSuggestions = await Promise.all(lookup.results.slice(0, 4).map(async (result, index) => {
    const name = result.title.replace(/\s*-\s*.*$/, "").slice(0, 80);
    const img = await googleImageLookup(`${name} product image`);
    return {
      name,
      store: "",
      target: 100 + index * 25,
      current: 115 + index * 25,
      original: 139 + index * 30,
      trend: "stable",
      category: "Web result",
      description: result.snippet || "Suggested from a web lookup. Check the store page before buying.",
      specs: [],
      bestFor: [],
      watchFor: ["Verify the exact model, seller, return policy, and current price before purchase."],
      sourceUrl: lookup.sourceUrl,
      image: img
    };
  }));

  const finalSuggestions = googleSuggestions.filter(item => item.name).map((googleItem, index) => {
    const offer = offers[index] || {
      ...typedProductOption(query, target, store, index),
      description: googleItem.description,
      sourceUrl: googleItem.sourceUrl,
      image: googleItem.image
    };
    return { ...offer, description: googleItem.description, sourceUrl: googleItem.sourceUrl, image: googleItem.image };
  });

  sendJson(res, 200, {
    query,
    source: googleSuggestions.length ? "google-budget" : "budget-fallback",
    googleUrl: lookup.sourceUrl,
    suggestions: finalSuggestions.length ? finalSuggestions : offers
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
  return `${lead} I can research reviews for ${product.name}, but I do not have a verified rating saved yet. I opened the Google review query for this exact product: ${googleUrl}. Check for repeated complaints, star ratings from known review sites, and whether reviewers are discussing the same model/store condition.`;
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

async function handleDealbot(req, res) {
  let body = "";
  req.on("data", chunk => {
    body += chunk;
    if (body.length > 1_000_000) req.destroy();
  });
  req.on("end", async () => {
    try {
      const payload = JSON.parse(body || "{}");
      const question = String(payload.question || "").trim();
      const products = Array.isArray(payload.products) ? payload.products : [];
      const activeProductName = payload.activeProductName || "";
      const turn = Number(payload.turn || 0);
      const product = products.find(item => normalize(item.name) === normalize(activeProductName)) ||
        findProducts(activeProductName, products)[0] ||
        (activeProductName ? null : products[0]) ||
        productCatalog[0];
      if (!product) {
        sendJson(res, 400, { error: "Open or select a product before asking Dealbot." });
        return;
      }
      const intent = classifyQuestion(question);
      const lookupQuery = `${product.name} ${intent === "review" ? "reviews ratings complaints" : question}`.trim();
      const lookup = await googleLookup(lookupQuery);
      const webFact = lookup.results[0]?.snippet || lookup.results[0]?.title || "";
      const baseAnswer = answerFromProduct(question, product, { turn, googleUrl: lookup.sourceUrl });
      const learned = webFact
        ? `Web note: ${webFact}`
        : "No clean live snippet came back, so I answered from the saved product database.";
      const fact = {
        text: webFact || baseAnswer,
        source: webFact ? "Google lookup" : "Dealwise database",
        savedAt: new Date().toISOString()
      };
      const currentFacts = learnedFacts.get(product.name) || [];
      learnedFacts.set(product.name, [...currentFacts, fact].slice(-8));

      sendJson(res, 200, {
        answer: `${baseAnswer} ${learned}`,
        productName: product.name,
        learnedFact: fact,
        googleUrl: lookup.sourceUrl
      });
    } catch (error) {
      sendJson(res, 400, { error: "Dealbot could not read that question." });
    }
  });
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
      ".json": "application/json; charset=utf-8"
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
  if (req.method === "GET" && url.pathname === "/api/suggest") {
    await handleSuggest(req, res, url);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/deals") {
    const q = url.searchParams.get("q") || "";
    const store = url.searchParams.get("store") || "";
    if (!q.trim()) {
      sendJson(res, 400, { error: "Missing q" });
      return;
    }
    const offers = await getApprovedOffers(q, store);
    sendJson(res, 200, { offers });
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
