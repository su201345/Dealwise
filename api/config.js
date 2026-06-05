const { sendJson, SUPABASE_URL, SUPABASE_ANON_KEY } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "GET") { res.status(405).end(); return; }
  sendJson(res, 200, { supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY });
};
