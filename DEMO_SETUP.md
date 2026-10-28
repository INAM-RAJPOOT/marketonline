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

## 3. Collections (Theme editor)

On the **Homepage**, assign collections in:

- **Featured collection** → pick your best-selling collection
- **Collection list** blocks → assign 2–3 collections

## 4. Blog (optional)

1. Create a blog (handle: `news`)
2. Add 2–3 sample articles
3. Add **Featured blog** section to homepage and select the blog

## 5. Products

Use Shopify's sample products or import your catalog. Ensure at least one collection has 4+ products for the homepage grid.

## 6. Customer accounts

**Settings → Customer accounts → Classic accounts** (required for login/register templates).

## 7. Markets & languages (optional)

Add a second language in **Settings → Languages** to test French (`fr.json`) and localization selectors.

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
