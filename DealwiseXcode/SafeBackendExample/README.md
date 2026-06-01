# Safe Dealwise Backend Example

This backend stores Dealwise data in Supabase. The local `.env` is already
pointed at the restored Supabase project:

```text
https://tvkirkpvpnocgrngvgad.supabase.co
```

Run locally for development:

```bash
npm install
node server.js
```

The checked-in Xcode app now defaults to the hosted Supabase Edge Function:

```js
localStorage.setItem("dealwiseApiBase", "https://tvkirkpvpnocgrngvgad.supabase.co/functions/v1/dealwise-api");
```

For production, replace the demo fallback with official/approved data sources only. Keep all API secrets on this server.

The hosted backend lives at:

```text
https://tvkirkpvpnocgrngvgad.supabase.co/functions/v1/dealwise-api
```
