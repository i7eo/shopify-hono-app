import { serializeValue } from "@shamt/utils";
import { createMiddleware } from "hono/factory";
import { SessionStore } from "@/infra/cloudflare/kv";
import { badGatewayError } from "@/shared/exceptions";
import type { AppEnv, ShopifyTokenExchangeResponse } from "@/types";

export const tokenExchange = createMiddleware<AppEnv>(async (c, next) => {
  const shop = c.var.shopDomain;
  const userId = c.var.shopifyUserId;
  const store = new SessionStore(c.env.sofary);

  const cached = await store.getOnlineSession(shop, userId);
  if (cached) {
    c.set("shopifyAccessToken", cached.accessToken);
    await next();
    return;
  }

  const authHeader = c.req.header("Authorization")!;
  const sessionToken = authHeader.slice(7);

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: sessionToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
      requested_token_type:
        "urn:shopify:params:oauth:token-type:online-access-token",
      client_id: c.env.SHOPIFY_APP_KEY,
      client_secret: c.env.SHOPIFY_APP_SECRET,
    }).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw badGatewayError("Token exchange failed", {
      details: {
        status: response.status,
        body: errorText,
      },
    });
  }

  const data = (await response.json()) as ShopifyTokenExchangeResponse;
  // eslint-disable-next-line no-console
  console.log(
    "Token exchange response:",
    serializeValue({
      scope: data.scope,
      associatedUserScope: data.associated_user_scope,
      expiresIn: data.expires_in,
      hasAssociatedUser: Boolean(data.associated_user),
      tokenPrefix: data.access_token?.slice(0, 6),
      tokenLength: data.access_token?.length,
    }),
  );

  const expiresIn = data.expires_in ?? 3600;
  const ttl = Math.max(expiresIn - 60, 30);
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  await store.setOnlineSession(
    shop,
    userId,
    {
      shop,
      accessToken: data.access_token,
      scope: data.associated_user_scope ?? "",
      installedAt: new Date().toISOString(),
      expiresAt,
      userId: data.associated_user ? String(data.associated_user.id) : userId,
    },
    ttl,
  );

  c.set("shopifyAccessToken", data.access_token);

  await next();
});
