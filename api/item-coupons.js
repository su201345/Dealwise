const { sendJson, readJsonBody, GROQ_API_KEY, groqGenerate } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).end(); return; }
  try {
    const payload = await readJsonBody(req);
    const name = String(payload.name || "").trim();
    const retailer = String(payload.retailer || "").trim();
    const category = String(payload.category || "").trim();
    if (!name) { sendJson(res, 400, { error: "Missing product name." }); return; }
    if (!GROQ_API_KEY) { sendJson(res, 503, { error: "Groq API key not configured." }); return; }

    const prompt = `You are a coupon-research assistant. Find currently plausible promo or discount codes that could apply when buying this product:

Product: "${name}"${retailer ? `\nRetailer: ${retailer}` : ""}${category ? `\nCategory: ${category}` : ""}

Be conservative — only suggest codes you have reasonable confidence are real or are common evergreen offers (e.g. brand newsletter signup, student discount, app-only promo, manufacturer promotion). NEVER invent fake-looking random codes. If you don't know of any real applicable coupons, return an empty array.

Respond with ONLY this JSON shape, no prose outside it:
{
  "coupons": [
    {
      "code": "the code the user types at checkout, e.g. SAVE10 or 'No code needed'",
      "description": "one short sentence about what it does and any restrictions",
      "store": "retailer or brand the code is for",
      "expires_on": "approximate expiry text like 'Dec 31, 2026' or 'Ongoing' or 'Unknown'"
    }
  ]
}

Return 0 to 3 coupons. Quality over quantity. If unsure, return { "coupons": [] }.`;

    const text = await groqGenerate(prompt);
    let parsed;
    try { parsed = JSON.parse(text); }
    catch { const m = text.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : { coupons: [] }; }

    const coupons = Array.isArray(parsed.coupons) ? parsed.coupons.slice(0, 3).map(c => ({
      code: String(c.code || "").slice(0, 40),
      description: String(c.description || "").slice(0, 200),
      store: String(c.store || retailer || "").slice(0, 60),
      expires_on: String(c.expires_on || "Unknown").slice(0, 40)
    })).filter(c => c.code) : [];

    sendJson(res, 200, { coupons });
  } catch (error) {
    console.error("item-coupons failed:", error.message);
    sendJson(res, 500, { error: "Could not fetch coupons." });
  }
};
