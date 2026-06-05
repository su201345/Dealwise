const { sendJson, GROQ_API_KEY, groqSuggestions } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "GET") { res.status(405).end(); return; }
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const query = url.searchParams.get("q") || "";
  const target = Number(url.searchParams.get("target") || 0);
  const store = url.searchParams.get("store") || "";
  const pref = url.searchParams.get("pref") || "cheapest";
  const filters = {
    minPrice: Number(url.searchParams.get("min_price") || 0),
    maxPrice: Number(url.searchParams.get("max_price") || 0),
    age: (url.searchParams.get("age") || "").trim(),
    brands: (url.searchParams.get("brands") || "").split(",").map(s => s.trim()).filter(Boolean)
  };

  if (!GROQ_API_KEY) {
    sendJson(res, 503, { error: "Groq API key not configured.", suggestions: [] });
    return;
  }

  try {
    const groqResults = await groqSuggestions(query, target, store, pref, filters);
    sendJson(res, 200, { query, source: "groq", suggestions: groqResults });
  } catch (error) {
    console.error("Groq suggest failed:", error.message);
    sendJson(res, 502, { error: "Match lookup failed.", suggestions: [] });
  }
};
