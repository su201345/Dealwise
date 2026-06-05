const { sendJson, readJsonBody, GROQ_API_KEY, groqGenerate } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).end(); return; }
  try {
    const payload = await readJsonBody(req);
    const name = String(payload.name || "").trim();
    const retailer = String(payload.retailer || "").trim();
    if (!name) { sendJson(res, 400, { error: "Missing product name." }); return; }
    if (!GROQ_API_KEY) { sendJson(res, 503, { error: "Groq API key not configured." }); return; }

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
    try { parsed = JSON.parse(text); }
    catch { const m = text.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : {}; }

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
};
