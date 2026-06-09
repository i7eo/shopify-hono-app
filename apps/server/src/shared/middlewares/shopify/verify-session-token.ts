import { createMiddleware } from "hono/factory";
import { getShopifyConfigProvider } from "@/infra/provider";
import { unauthorizedError } from "@/shared/exceptions";
import type { AppEnv } from "@/types";

export const verifySessionToken = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw unauthorizedError("Missing or malformed Authorization header");
  }

  const token = authHeader.slice(7);

  const config = c.get("runtimeEnv");
  const shopify = await getShopifyConfigProvider(config);

  try {
    const claims = await shopify.session.decodeSessionToken(token);
    const shopDomain = new URL(claims.dest).hostname;

    c.set("shopifySessionToken", claims);
    c.set("shopDomain", shopDomain);
    c.set("shopifyUserId", claims.sub);
  } catch (error) {
    throw unauthorizedError("Invalid session token", {
      details: {
        cause: error,
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }

  await next();
});
