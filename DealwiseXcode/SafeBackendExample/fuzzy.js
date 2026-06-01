// fuzzy.js — fuzzy / phonetic item matching for Dealwise
// Handles misspellings, abbreviations, partial words, synonyms

const natural = require('natural');
const JaroWinklerDistance = natural.JaroWinklerDistance;
const SoundEx = natural.SoundEx;
const soundex = new SoundEx();
const tokenizer = new natural.WordTokenizer();

// ─── Synonym / alias map ───────────────────────────────────────────────────
// Keys are canonical terms; values are alternate spellings / nicknames
const SYNONYMS = {
  headphones: ['headphone','headset','earphone','earphones','earbud','earbuds','cans','headband','wh1000','xm5','xm4','xm3','sony wh','noise cancel','anc'],
  sony:       ['sny','sonny','soony','snoy','ony'],
  airpods:    ['airpod','air pod','air pods','earpod','earpods','applepods'],
  kindle:     ['e-reader','ereader','e reader','e-book','ebook','paperwhite','kobo'],
  laptop:     ['notebook','macbook','chromebook','pc','computer','ultrabook','thinkpad','ideapad','vivobook','aspire'],
  phone:      ['smartphone','mobile','iphone','android','galaxy','pixel','oneplus','moto'],
  jeans:      ['jean','denim','pants','trousers','levis','levi','501','levi\'s'],
  'instant pot': ['instantpot','instant-pot','pressure cooker','multicooker','multi cooker','instapot','instapots'],
  airfryer:   ['air fryer','air-fryer','fryer','airfry'],
  tv:         ['television','smart tv','oled','qled','4k tv','monitor'],
  watch:      ['smartwatch','smart watch','apple watch','galaxy watch','fitbit','garmin'],
  vacuum:     ['roomba','dyson','hoover','sweeper','robot vacuum'],
  speaker:    ['bluetooth speaker','sonos','bose','echo','alexa','homepod'],
  camera:     ['dslr','mirrorless','gopro','webcam','camcorder'],
  tablet:     ['ipad','android tablet','surface','fire tablet'],
};

// Build reverse lookup: alias → canonical
const aliasToCanonical = {};
for (const [canonical, aliases] of Object.entries(SYNONYMS)) {
  aliasToCanonical[canonical] = canonical; // canonical maps to itself
  for (const alias of aliases) {
    aliasToCanonical[alias.toLowerCase()] = canonical;
  }
}

function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Expand a query string: replace known aliases with canonical terms
function expandQuery(query) {
  const q = norm(query);
  const words = q.split(/\s+/);
  const expanded = new Set(words);
  // single-word aliases
  for (const w of words) {
    if (aliasToCanonical[w]) expanded.add(aliasToCanonical[w]);
  }
  // multi-word aliases (up to 3 words)
  for (let len = 2; len <= 3; len++) {
    for (let i = 0; i <= words.length - len; i++) {
      const phrase = words.slice(i, i + len).join(' ');
      if (aliasToCanonical[phrase]) expanded.add(aliasToCanonical[phrase]);
    }
  }
  return Array.from(expanded).join(' ');
}

// Soundex codes for a string
function soundexTokens(s) {
  return tokenizer.tokenize(norm(s)).map(w => soundex.process(w));
}

// Score how well `query` matches `candidate` (0–1, higher = better)
function matchScore(query, candidate) {
  const q = norm(expandQuery(query));
  const c = norm(expandQuery(candidate));

  if (c.includes(q) || q.includes(c)) return 1.0;         // exact substring

  const qWords = q.split(/\s+/);
  const cWords = c.split(/\s+/);

  // Token-level Jaro-Winkler: best match for each query word against any candidate word
  let tokenScore = 0;
  for (const qw of qWords) {
    let best = 0;
    for (const cw of cWords) {
      const jw = JaroWinklerDistance(qw, cw, { ignoreCase: true });
      if (jw > best) best = jw;
    }
    tokenScore += best;
  }
  tokenScore /= qWords.length;

  // Soundex phonetic match bonus
  const qSdx = soundexTokens(q);
  const cSdx = soundexTokens(c);
  let phoneticBonus = 0;
  for (const qs of qSdx) {
    if (cSdx.includes(qs)) phoneticBonus += 0.12;
  }

  return Math.min(1, tokenScore + phoneticBonus);
}

// ─── Public API ────────────────────────────────────────────────────────────

// Return DB items sorted by fuzzy score, only those above threshold
function fuzzyMatchItems(query, items, threshold = 0.55) {
  return items
    .map(item => ({
      item,
      score: matchScore(query, item.name + ' ' + (item.category || '') + ' ' + (item.description || ''))
    }))
    .filter(r => r.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .map(r => r.item);
}

// Does query fuzzy-match this item? (for coupon & alert resolution)
function queryMatchesItem(query, item) {
  const score = matchScore(
    query,
    item.name + ' ' + (item.category || '') + ' ' + (item.description || '')
  );
  return score >= 0.55;
}

// Does query fuzzy-match this coupon's categories / store?
function queryMatchesCoupon(query, coupon) {
  const cats = Array.isArray(coupon.categories) ? coupon.categories : [];
  const storeScore = matchScore(query, coupon.store);
  const catScore   = cats.length
    ? Math.max(...cats.map(c => matchScore(query, c)))
    : 0;
  return storeScore >= 0.72 || catScore >= 0.60;
}

// Given a free-text query, find all matching coupons from the DB coupon list
function couponsForQuery(query, allCoupons) {
  return allCoupons.filter(c => queryMatchesCoupon(query, c));
}

// Given a free-text query, find and apply the best coupon from DB, return savings info
function bestCouponForQuery(query, allCoupons, price) {
  const matched = couponsForQuery(query, allCoupons);
  if (!matched.length) return null;
  return matched
    .map(c => {
      const discount = c.type === 'percent'
        ? Math.min(price, price * (Number(c.value) / 100))
        : Math.min(price, Number(c.value));
      return { coupon: c, discount, finalPrice: Math.max(0, price - discount) };
    })
    .filter(r => price === 0 || r.discount > 0 || Number(c?.minimum || 0) === 0)
    .sort((a, b) => b.discount - a.discount)[0] || null;
}

module.exports = { fuzzyMatchItems, queryMatchesItem, queryMatchesCoupon, couponsForQuery, bestCouponForQuery, matchScore, expandQuery };
