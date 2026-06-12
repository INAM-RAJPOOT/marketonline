# Meridian

A modern Shopify Online Store 2.0 theme with conversion-focused features, customer accounts, and accessibility built in.

## Features

- **Cart drawer** with AJAX add-to-cart and upsells
- **Quick add** on collection cards
- **Search modal** with predictive search
- **Sticky add-to-cart** on product pages
- **Mega menu** with optional promo blocks
- **AJAX collection filters**
- **Product media gallery** with zoom
- **Wishlist** (localStorage)
- **Product reviews** (Shopify metafields, Judge.me, or app blocks)
- **Customer accounts** (Classic accounts)
- **Localization** (country + language selectors)
- **Marketing sections:** hero carousel, FAQ, testimonials, featured blog, logo list, and more

## Requirements

- Shopify CLI 3.x+
- A Shopify store (development store recommended)

## Quick start

```bash
cd meridian
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
locales/      en.default.json, fr.json
sections/     Page sections
snippets/     Reusable Liquid partials
templates/    JSON templates
```

## Version

See [CHANGELOG.md](./CHANGELOG.md). Current version: **1.1.1**.

## License

MIT — see [LICENSE.md](./LICENSE.md).
