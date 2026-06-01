import { createMiddleware } from "hono/factory";
import { SessionStore } from "../lib/session-store";
import type { AppEnv } from "../types";

const SHOP_DOMAIN_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

/**
 * Middleware that checks if the app has been installed for the given shop.
 *
 * If Shopify sends an `id_token` query param (managed install / session token
 * flow), the app is already installed — skip the offline token check and serve
 * the app shell. App Bridge + token exchange will handle authentication.
 *
 * Otherwise, falls back to checking for an offline access token in KV. If
 * not installed, redirects to the OAuth flow using a JavaScript redirect
 * to break out of the Shopify admin iframe.
 */
export const ensureInstalled = createMiddleware<AppEnv>(async (c, next) => {
  const shop = c.req.query("shop");

  if (!shop || !SHOP_DOMAIN_RE.test(shop)) {
    return c.json({ error: "Missing or invalid shop parameter" }, 400);
  }

  // If Shopify provides an id_token, the app is already installed —
  // App Bridge will handle authentication via session tokens.
  const idToken = c.req.query("id_token");
  if (idToken) {
    await next();
    return;
  }

  const store = new SessionStore(c.env.sofary);
  const session = await store.getOfflineSession(shop);

  if (session) {
    await next();
    return;
  }

  // No offline token — redirect to OAuth, breaking out of the iframe
  const authUrl = `${c.env.SHOPIFY_APP_URL}/auth?shop=${encodeURIComponent(shop)}`;

  return c.html(`<!DOCTYPE html>
<html>
<head>
  <script>
    if (window.top === window.self) {
      window.location.href = ${JSON.stringify(authUrl)};
    } else {
      window.top.location.href = ${JSON.stringify(authUrl)};
    }
  </script>
</head>
<body>Redirecting...</body>
</html>`);
});
