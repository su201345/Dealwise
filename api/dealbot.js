const {
  sendJson, readJsonBody, GROQ_API_KEY, groqGenerate,
  productImageUrl, retailerSearchUrl
} = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).end(); return; }
  try {
    const payload = await readJsonBody(req);
    const question = String(payload.question || "").trim();
    if (!question) { sendJson(res, 400, { error: "Ask Dealbot a question." }); return; }
    const watchlist = Array.isArray(payload.watchlist) ? payload.watchlist : [];
    const activeProductName = String(payload.activeProductName || "").trim();

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

You can do two things:

A) ANSWER A QUESTION about a tracked item.
- If the question references an item that fuzzy-matches one of these by name, brand, or category (e.g. "hoop" -> "Spalding Mini Hoop"), answer about THAT item using its details and prices.
- ${activeProductName ? `The user currently has "${activeProductName}" open. Prefer that unless the question clearly refers to a different tracked item.` : "No item is currently open."}
- If no item matches, say so briefly and offer to track one.

B) BUILD A SETUP / SHOPPING LIST.
- If the user asks you to build, assemble, or recommend a SETUP, KIT, LIST, or multiple items for a goal (e.g. "build me a gaming setup under $1500", "what do I need for a home gym", "cheapest desk setup"), return a "setup" array.
- Each setup entry is one product to track. Honor any budget and preferences (cheapest, best quality, specific brands). Use real, plausible product/model names and realistic US prices. The total of all "current" prices should respect the stated budget if any.
- Pick a sensible NUMBER of items for the goal (typically 3-8).

Be concise (1-3 short paragraphs of "answer" text). Reference real prices/targets when relevant.
Reply with ONLY this JSON shape, no prose outside it:
{
  "answer": "your reply text (for a setup, summarize what you put together and the total)",
  "matchedItemId": "<id from the list above, or null if none>",
  "setup": [
    {
      "name": "specific product name",
      "store": "one of Amazon, Best Buy, Walmart, Target, eBay",
      "current": <integer current price in USD>,
      "original": <integer list price >= current>,
      "category": "short category label",
      "description": "one sentence"
    }
  ]
}
If the user is NOT asking for a setup/list, return "setup": [].`;

    let answer = "";
    let matchedItemId = null;
    let setup = [];

    if (GROQ_API_KEY) {
      try {
        const raw = await groqGenerate(systemPrompt + "\n\nUser question: " + question);
        const parsed = JSON.parse(raw);
        answer = String(parsed.answer || "").trim();
        matchedItemId = parsed.matchedItemId || null;
        if (Array.isArray(parsed.setup)) {
          setup = parsed.setup.slice(0, 10).map(s => {
            const current = Math.max(1, Math.round(Number(s.current) || 50));
            const original = Math.max(current, Math.round(Number(s.original) || Math.round(current * 1.2)));
            const name = String(s.name || "").slice(0, 90);
            const retailer = String(s.store || "");
            return {
              name,
              store: retailer,
              retailer,
              current,
              original,
              target: current,
              category: String(s.category || "Setup item").slice(0, 60),
              description: String(s.description || "").slice(0, 240),
              image: productImageUrl(s.imageKeywords || name),
              productUrl: retailerSearchUrl(retailer, name, "")
            };
          }).filter(s => s.name);
        }
      } catch (error) {
        console.error("Dealbot Groq call failed:", error.message);
      }
    }

    if (!answer) answer = "Dealbot is unavailable right now. Try again in a moment.";

    sendJson(res, 200, { answer, matchedItemId, setup });
  } catch (error) {
    sendJson(res, 400, { error: "Dealbot could not read that question." });
  }
};
