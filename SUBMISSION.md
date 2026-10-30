# Theme submission checklist

Use this before submitting to the Shopify Theme Store or sharing with clients.

## Code quality

- [ ] `shopify theme check` passes with no errors
- [ ] All templates render without Liquid errors
- [ ] `global.js` loads with `defer`
- [ ] No console errors on homepage, product, collection, cart

## Demo store

- [ ] [DEMO_SETUP.md](./DEMO_SETUP.md) checklist completed
- [ ] Homepage sections populated with real collections/products
- [ ] Wishlist page created and linked in navigation
- [ ] Logo uploaded in theme settings
- [ ] Main menu configured

## Accessibility

- [ ] Keyboard navigation tested (Tab, Escape, arrows on carousel)
- [ ] Screen reader spot-check (VoiceOver or NVDA)
- [ ] Color contrast verified on primary buttons and text
- [ ] Focus visible on all interactive elements

## Documentation

- [ ] README.md updated
- [ ] CHANGELOG.md current
- [ ] `theme_info` author and support URLs set
- [ ] Demo store URL documented for reviewers

## Assets (Theme Store)

- [ ] Theme preview image (1200×800)
- [ ] 3–5 desktop screenshots
- [ ] Mobile screenshots
- [ ] Promo video (optional)

## Legal

- [ ] LICENSE.md included
- [ ] No copyrighted demo images without license
- [ ] Third-party app integrations documented (Judge.me, checkout app)
- [ ] No country or language dropdown on the storefront; regions come from Shopify Markets
- [ ] App embeds load, and an app block can be added on the product page and the reviews section

## Performance

- [ ] Lighthouse run on homepage and product page
- [ ] Images use lazy loading and appropriate sizes
- [ ] No render-blocking scripts (except `content_for_header`)
