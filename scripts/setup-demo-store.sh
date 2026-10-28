#!/usr/bin/env bash
# Automates DEMO_SETUP.md steps that require Shopify Admin API access.
# Prerequisites: Shopify CLI logged in (`shopify auth login`).
set -euo pipefail

STORE="${SHOPIFY_STORE:-my-theme-icz6tajh.myshopify.com}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARSE_JSON="node $SCRIPT_DIR/lib/parse-store-json.mjs"

echo "==> Store: $STORE"
echo "==> Checking store auth..."
if ! shopify store execute -s "$STORE" -j --query 'query { shop { name } }' 2>/dev/null | $PARSE_JSON >/dev/null; then
  echo ""
  echo "No stored auth for this store. Run once (browser login required):"
  echo ""
  echo "  shopify store auth --store $STORE --scopes read_content,write_content,read_online_store_navigation,write_online_store_navigation"
  echo ""
  exit 1
fi

store_query() {
  shopify store execute -s "$STORE" -j --query "$1" 2>/dev/null | $PARSE_JSON
}

store_query_file() {
  shopify store execute -s "$STORE" -j --query-file "$1" 2>/dev/null | $PARSE_JSON
}

run_mutation() {
  local file="$1"
  local vars="${2:-}"
  if [[ -n "$vars" ]]; then
    shopify store execute -s "$STORE" --allow-mutations --query-file "$file" --variables "$vars"
  else
    shopify store execute -s "$STORE" --allow-mutations --query-file "$file"
  fi
}

EXISTING_PAGES="$(store_query_file "$SCRIPT_DIR/query-pages.graphql")"

ensure_page() {
  local handle="$1"
  local mutation_file="$2"
  local exists
  exists="$(echo "$EXISTING_PAGES" | node -e "
    const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
    const found = (d.pages?.nodes ?? []).some((p) => p.handle === process.argv[1]);
    process.stdout.write(found ? 'yes' : 'no');
  " "$handle")"
  if [[ "$exists" == "yes" ]]; then
    echo "    ✓ Page '$handle' already exists — skipped"
    return 0
  fi
  echo "    → Creating page '$handle'..."
  local result
  result="$(run_mutation "$mutation_file" 2>&1)"
  if echo "$result" | grep -qE 'Handle has already been taken|"page":\s*\{'; then
    echo "    ✓ Page '$handle' ready"
    return 0
  fi
  if echo "$result" | grep -q '"userErrors": \[\]'; then
    echo "    ✓ Page '$handle' created"
    return 0
  fi
  echo "$result"
  echo "    ✗ Failed to create page '$handle'"
  return 1
}

echo "==> Ensuring Wishlist and About pages..."
ensure_page "wishlist" "$SCRIPT_DIR/mutations/page-wishlist.graphql"
ensure_page "about" "$SCRIPT_DIR/mutations/page-about.graphql"

echo "==> Updating Main menu (main-menu)..."
MENU_ID="$(store_query_file "$SCRIPT_DIR/query-main-menu.graphql" | node -e "
  const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
  const nodes = d.menus?.nodes ?? [];
  const menu = nodes.find((m) => m.handle === 'main-menu');
  if (!menu) {
    console.error('main-menu not found. Available menus: ' + nodes.map((m) => m.handle).join(', '));
    process.exit(1);
  }
  process.stdout.write(menu.id);
")"

run_mutation "$SCRIPT_DIR/mutations/menu.graphql" "{\"menuId\":\"$MENU_ID\"}" >/dev/null
echo "    ✓ Main menu updated (Home, Catalog, Wishlist, About)"

echo ""
echo "Done. Next steps:"
echo "  1. cd marketonline && shopify theme push -l --allow-live -n   # sync theme files (wishlist_page setting)"
echo "  2. Theme editor: confirm Featured collection + collections on homepage"
echo "  3. Settings → Customer accounts → Classic accounts"
echo "  4. Checkout app: see ../my-checkout-app/README.md"
echo "  5. Storefront password (dev): TEST"
