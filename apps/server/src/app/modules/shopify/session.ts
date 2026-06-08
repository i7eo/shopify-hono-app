import { RequestedTokenType, type Session } from "@shopify/shopify-api";
import { getShopifyConfigProvider } from "@/infra/provider";
import { getShopifySessionStorage } from "./session-storage";
import type { AppEnv } from "@/types";
import type { Context } from "hono";

export async function loadActiveShopifyOnlineSession(
  c: Context<AppEnv>,
): Promise<Session | undefined> {
  const config = c.get("runtimeEnv");
  const shopify = await getShopifyConfigProvider(config);
  const sessionStorage = getShopifySessionStorage(c);
  const sessionId = await shopify.session.getCurrentId({
    isOnline: true,
    rawRequest: c.req.raw,
  });

  const storedSession = sessionId
    ? await sessionStorage.loadSession(sessionId)
    : undefined;

  if (storedSession?.isActive(shopify.config.scopes)) {
    return storedSession;
  }

  return undefined;
}

export async function exchangeShopifyOnlineSession(
  c: Context<AppEnv>,
): Promise<Session> {
  const authHeader = c.req.header("Authorization");
  const sessionToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;

  if (!sessionToken) {
    throw new Error("Missing or malformed Authorization header");
  }

  const config = c.get("runtimeEnv");
  const shopify = await getShopifyConfigProvider(config);
  const { session } = await shopify.auth.tokenExchange({
    shop: c.var.shopDomain,
    sessionToken,
    requestedTokenType: RequestedTokenType.OnlineAccessToken,
  });

  if (!session.accessToken) {
    throw new Error("Token exchange did not return an access token");
  }

  await getShopifySessionStorage(c).storeSession(session);

  return session;
}

export async function refreshShopifyOnlineSession(
  c: Context<AppEnv>,
): Promise<Session> {
  await deleteCurrentShopifyOnlineSession(c);
  return exchangeShopifyOnlineSession(c);
}

export function setShopifySessionContext(c: Context<AppEnv>, session: Session) {
  if (!session.accessToken) {
    throw new Error("Shopify session does not have an access token");
  }

  c.set("shopifySession", session);
  c.set("shopifyAccessToken", session.accessToken);
}

async function deleteCurrentShopifyOnlineSession(c: Context<AppEnv>) {
  const sessionStorage = getShopifySessionStorage(c);
  const sessionIds = new Set<string>();

  if (c.var.shopifySession?.id) {
    sessionIds.add(c.var.shopifySession.id);
  }

  const config = c.get("runtimeEnv");
  const shopify = await getShopifyConfigProvider(config);
  const sessionId = await shopify.session.getCurrentId({
    isOnline: true,
    rawRequest: c.req.raw,
  });

  if (sessionId) {
    sessionIds.add(sessionId);
  }

  await Promise.all(
    Array.from(sessionIds, (id) => sessionStorage.deleteSession(id)),
  );
}
