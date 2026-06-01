# Dealwise Xcode App

Open `Dealwise.xcodeproj` in Xcode and run it on an iPhone simulator or device.

## What changed in this version

This version adds a **safe deal engine** to the Dealwise app:

- Refreshes every tracked item.
- Matches coupons to the products in the cart/watchlist.
- Calculates the cheapest safe cart total after matching coupon discounts.
- Shows which coupon applies to each item.
- Opens a safe web search/merchant lookup for the product.
- Avoids illegal or unsafe scraping behavior.

## Safe sourcing rule

Dealwise should only use sources you are allowed to use:

- Official merchant APIs.
- Affiliate/product advertising APIs.
- Merchant-approved product feeds.
- Coupon provider APIs or approved coupon feeds.
- Public pages only when their terms allow automated access.

Do not add code that bypasses logins, captchas, checkout protections, paywalls, rate limits, or website terms. Do not scrape private cart or account pages.

## Optional live backend

The app runs without a backend by using demo fallback data. For real prices/coupons, create your own API and set this in the app's WebView console or add it to the JavaScript config:

```js
localStorage.setItem("dealwiseApiBase", "https://your-domain.com");
```

Your backend should expose:

```txt
GET /api/deals?q=<product name>&store=<store>
```

Expected JSON shape:

```json
{
  "offers": [
    {
      "store": "Amazon",
      "price": 249.99,
      "original": 349.99,
      "url": "https://...",
      "source": "Amazon Product Advertising API"
    }
  ]
}
```

Important: keep API keys and merchant credentials on your backend, never inside the iOS app.

## Files

- `Dealwise/dealwise.html` – the app UI and safe deal engine.
- `Dealwise/DealwiseWebView.swift` – SwiftUI wrapper that loads the bundled HTML.
- `OriginalStarter/` – original starter files for reference.
