import { Hono } from "hono";
import type { AppEnv } from "../types";
import { ensureInstalled } from "../middleware/ensure-installed";

export const appRoutes = new Hono<AppEnv>();

// All app frame routes require the shop to be installed
appRoutes.use("/*", ensureInstalled);

// ---------------------------------------------------------------------------
// Serve the embedded app HTML shell
// ---------------------------------------------------------------------------

appRoutes.get("/", (c) => c.html(renderAppShell(c.env.SHOPIFY_APP_KEY)));
appRoutes.get("/*", (c) => c.html(renderAppShell(c.env.SHOPIFY_APP_KEY)));

// ---------------------------------------------------------------------------
// HTML template — App Bridge auto-configures from the meta tag
// ---------------------------------------------------------------------------

export function renderAppShell(apiKey: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="shopify-api-key" content="${apiKey}" />
  <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
  <script src="https://cdn.shopify.com/shopifycloud/polaris.js"></script>
  <title>My Shopify App</title>
</head>
<body>
  <s-page heading="My Shopify App" inline-size="base">
    <s-section heading="Shop Info">
      <div id="shop-info">
        <s-spinner size="base" accessibility-label="Loading shop info"></s-spinner>
      </div>
    </s-section>

    <s-section heading="Products">
      <div id="products-container">
        <s-spinner size="base" accessibility-label="Loading products"></s-spinner>
      </div>
    </s-section>
  </s-page>

  <script>
    // App Bridge auto-initializes from the meta tag above.
    // It intercepts fetch() calls to our backend and automatically
    // adds the Authorization: Bearer <session_token> header.

    async function loadShopInfo() {
      const container = document.getElementById('shop-info');
      try {
        const res = await fetch('/api/shop');
        if (!res.ok) throw new Error('Failed to load shop info');
        const data = await res.json();
        const shop = data.data?.shop;
        if (shop) {
          container.innerHTML =
            '<s-text type="strong">' + escapeHtml(shop.name) + '</s-text>' +
            '<s-text color="subdued"> (' + escapeHtml(shop.myshopifyDomain) + ')</s-text>';
        }
      } catch (err) {
        container.innerHTML = '<s-banner tone="critical">' + escapeHtml(err.message) + '</s-banner>';
      }
    }

    async function loadProducts() {
      const container = document.getElementById('products-container');
      try {
        const res = await fetch('/api/products');
        if (!res.ok) throw new Error('Failed to load products');
        const data = await res.json();
        const products = data.data?.products?.edges || [];

        if (products.length === 0) {
          container.innerHTML = '<s-text color="subdued">No products found.</s-text>';
          return;
        }

        container.innerHTML = '<s-unordered-list>' +
          products.map(function(edge) {
            return '<s-list-item>' + escapeHtml(edge.node.title) + '</s-list-item>';
          }).join('') +
          '</s-unordered-list>';
      } catch (err) {
        container.innerHTML = '<s-banner tone="critical">' + escapeHtml(err.message) + '</s-banner>';
      }
    }

    function escapeHtml(str) {
      var div = document.createElement('div');
      div.appendChild(document.createTextNode(str));
      return div.innerHTML;
    }

    // Load data once App Bridge is ready
    loadShopInfo();
    loadProducts();
  </script>
</body>
</html>`;
}
