import { createMiddleware } from "hono/factory";
import { SessionStore } from "../../../infra/cloudflare/kv";
import type { AppEnv } from "../../../types";

const SHOP_DOMAIN_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

export const ensureInstalled = createMiddleware<AppEnv>(async (c, next) => {
  const shop = c.req.query("shop");

  if (!shop || !SHOP_DOMAIN_RE.test(shop)) {
    return c.json({ error: "Missing or invalid shop parameter" }, 400);
  }

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
