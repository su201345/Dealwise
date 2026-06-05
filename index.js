// Vercel auto-detects this project as Node because the project's framework
// preset was locked when it first saw server.js at the root. Vercel then
// requires an "entrypoint" file (app.js, index.js, server.js, etc.) at the
// root or its build fails with "No entrypoint found".
//
// Real routing lives in /api/*.js. This file exists only to satisfy the
// entrypoint check. It's never invoked at runtime -- Vercel's static-asset
// serving for index.html and /api/ functions handles everything.

module.exports = (req, res) => {
  res.status(404).send("Not found");
};
