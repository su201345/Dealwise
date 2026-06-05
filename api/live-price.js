const { sendJson, readJsonBody, fetchHtml, extractPrice } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).end(); return; }
  try {
    const payload = await readJsonBody(req);
    const productUrl = String(payload.productUrl || "").trim();
    if (!productUrl) { sendJson(res, 400, { error: "Missing productUrl." }); return; }
    let parsed;
    try { parsed = new URL(productUrl); }
    catch { sendJson(res, 400, { error: "Invalid URL." }); return; }
    const html = await fetchHtml(productUrl);
    const price = extractPrice(html, parsed.hostname);
    if (price == null) { sendJson(res, 200, { price: null, source: "scrape-miss" }); return; }
    sendJson(res, 200, { price, source: "scrape" });
  } catch (error) {
    console.error("live-price failed:", error.message);
    sendJson(res, 200, { price: null, source: "scrape-error", error: error.message });
  }
};
