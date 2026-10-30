# Demo store setup

Follow this checklist after installing **MarketOnline** on a development or demo store.

> **Plain English:** This file is an Admin checklist — menus, pages, and homepage content. It does not use the terminal except for the final theme push. For a guided overview of the whole repo, see [../GETTING_STARTED.md](../GETTING_STARTED.md).

## Quick automate (pages + menu)

One-time auth (browser login):

```bash
shopify store auth --store YOUR-STORE.myshopify.com \
  --scopes read_content,write_content,read_online_store_navigation,write_online_store_navigation
```

Then:

```bash
cd marketonline
./scripts/setup-demo-store.sh
shopify theme push -l --allow-live -n
```

The script creates Wishlist/About pages and updates **Main menu**. You still need the manual steps below for collections, accounts, and checkout.

## 1. Navigation

1. **Online Store → Navigation**
2. Create or edit **Main menu** (`main-menu`) with:
   - Home → `/`
   - Catalog → `/collections/all`
   - Wishlist → `/pages/wishlist` (after step 2)
   - About → `/pages/about` (optional)

Or run `./scripts/setup-demo-store.sh` to set these links automatically.

## 2. Pages

| Page | Template | Handle |
|------|----------|--------|
| Wishlist | `wishlist` | `wishlist` |
| About | `page` | `about` |

**Theme settings → Wishlist → Wishlist page:** select the Wishlist page.

## 3. Homepage (Theme editor)

The homepage is already stacked as a beauty landing page. Assign collections and images in:

- **Hero** — two slides
- **The birthday edit** — featured collection (`women-accessories`)
- **Shop by concern** — three promo tiles
- **Care that fits in a few steps** — image with text
- **Trust badges**
- **The everyday edit** — featured collection (`hydrogen`)
- **Kind words** — testimonials
- **Follow along** — promo tiles
- **Newsletter**

Countdown, press, before/after, and lookbook sections are in the theme. Add them from the theme editor if you want them on the homepage.

## 4. Blog (optional)

1. Create a blog (handle: `news`)
2. Add 2–3 sample articles
3. Add **Featured blog** section to homepage and select the blog

## 5. Products

Use Shopify's sample products or import your catalog. Ensure at least one collection has 4+ products for the homepage grid.

## 6. Customer accounts

**Settings → Customer accounts → Classic accounts** (required for login/register templates).

## 7. Markets & languages

The theme does not show a country or language dropdown. Shopify chooses the market from the visitor’s location.

1. **Settings → Markets** — add each region, with its currency and default language.
2. **Settings → Languages** — publish the languages you sell in. The theme includes English, French, Italian, German, and Spanish.
3. Leave automatic market detection on so each visitor sees that region’s prices and language.

The country field on the account address form is the shipping address. It is not a storefront region switcher.

## 8. Reviews (optional)

Install [Judge.me](https://apps.shopify.com/judgeme), then set **Theme settings → Product reviews → Reviews provider → Judge.me**.

## 9. Checkout extensions (optional)

See `../my-checkout-app/README.md` for trust badges and gift message at checkout.

## 10. Publish

```bash
cd marketonline
shopify theme push
```

Assign as live theme or share the preview URL with reviewers.
