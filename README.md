# MarketOnline

A modern Shopify Online Store 2.0 theme with conversion-focused features, customer accounts, and accessibility built in.

## Features

- **Cart drawer** with notes, gift wrap, and cross-sell upsells
- **Quick add** and **quick view** on collection cards
- **Predictive search**
- **Sticky header** and **sticky add-to-cart**
- **Mega menu** with in-menu promos
- **Collection filters**, swatches, sidebar navigation, and infinite scroll
- **Product gallery** with high-resolution images, video, zoom, and hover rollover
- **Product details:** stock counter, volume pricing, pre-order, size chart, tabs, back-in-stock alerts
- **Recently viewed** and complementary products
- **Wishlist** and product reviews
- **Customer accounts** with account menu and Sign in with Shop
- **Shopify Markets:** currency and language follow the visitor’s region. There is no country or language dropdown.
- **Shopify apps:** app embeds run storewide. App blocks can be added on the product page and in the product reviews section.
- **Storefront locales:** English, French, Italian, German, and Spanish, plus right-to-left layout
- **Promotions:** countdown, promo tiles, promo popup, press mentions, lookbook hotspots, before/after slider
- **Quick order list** and customizable contact form
- **Age verifier**, back to top, and motion that respects reduced-motion settings

## Requirements

- Shopify CLI 3.x+
- A Shopify store (development store recommended)

## Quick start

```bash
cd marketonline
shopify theme dev
```

If you have multiple stores, add `--store=your-store.myshopify.com`.

Open the preview URL or press `e` in the terminal to open the theme editor for the **dev theme**.

**New to this repo?** Read [../GETTING_STARTED.md](../GETTING_STARTED.md) first — it explains how the theme and checkout app fit together.

## Demo store

See [DEMO_SETUP.md](./DEMO_SETUP.md) for the full checklist (menus, wishlist page, collections, blog).

Automate pages and navigation:

```bash
./scripts/setup-demo-store.sh
```

## Checkout extensions

Trust badges and gift message extensions live in `../my-checkout-app/`. See that folder's README.

## Development

```bash
shopify theme check    # Lint
shopify theme push     # Upload to store
shopify theme pull     # Download editor changes
```

CI runs Theme Check on push (`.github/workflows/ci.yml`).

## Accessibility

- Skip-to-content link
- Keyboard support for modals, mobile menu, and hero carousel
- Focus trap and focus return on overlays
- `aria-live` regions for search, filters, and carousel
- `prefers-reduced-motion` support

## Theme structure

```
assets/       CSS and JavaScript
config/       Theme settings
layout/       theme.liquid
locales/      en, fr, it, de, es
sections/     Page sections
snippets/     Reusable Liquid partials
templates/    JSON templates
```

## Version

See [CHANGELOG.md](./CHANGELOG.md). Current version: **1.2.0**.

## License

MIT — see [LICENSE.md](./LICENSE.md).
