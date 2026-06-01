# Safe Dealwise Backend Example

Run locally:

```bash
node server.js
```

Then configure the app:

```js
localStorage.setItem("dealwiseApiBase", "http://localhost:4174");
```

For production, replace the demo fallback with official/approved data sources only. Keep all API secrets on this server.
