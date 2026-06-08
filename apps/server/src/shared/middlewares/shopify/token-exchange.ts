import { RequestedTokenType } from "@shopify/shopify-api";
import { createMiddleware } from "hono/factory";
import { getShopifySessionStorage } from "@/app/modules/shopify/session-storage";
import { getShopifyConfigProvider } from "@/infra/provider";
import { badGatewayError } from "@/shared/exceptions";
import type { AppEnv } from "@/types";

export const tokenExchange = createMiddleware<AppEnv>(async (c, next) => {
  const shop = c.var.shopDomain;
  const authHeader = c.req.header("Authorization")!;
  const sessionToken = authHeader.slice(7);
  const config = c.get("runtimeEnv");
  const shopify = await getShopifyConfigProvider(config);
  const sessionStorage = getShopifySessionStorage(c);

  try {
    const sessionId = await shopify.session.getCurrentId({
      isOnline: true,
      rawRequest: c.req.raw,
    });

    const storedSession = sessionId
      ? await sessionStorage.loadSession(sessionId)
      : undefined;

    if (storedSession?.isActive(shopify.config.scopes)) {
      c.set("shopifySession", storedSession);
      c.set("shopifyAccessToken", storedSession.accessToken!);
      await next();
      return;
    }

    const { session } = await shopify.auth.tokenExchange({
      shop,
      sessionToken,
      requestedTokenType: RequestedTokenType.OnlineAccessToken,
    });

    if (!session.accessToken) {
      throw new Error("Token exchange did not return an access token");
    }

    await sessionStorage.storeSession(session);

    c.set("shopifySession", session);
    c.set("shopifyAccessToken", session.accessToken);
  } catch (error) {
    throw badGatewayError("Token exchange failed", {
      details: {
        cause: error,
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }

  await next();
});
