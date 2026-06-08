import { getShopifyClientProvider, type ShopifyClient } from "@/infra/provider";
import {
  refreshShopifyOnlineSession,
  setShopifySessionContext,
} from "./session";
import type { AppEnv } from "@/types";
import type { Context } from "hono";

export async function runWithShopifyAdminClient<T>(
  c: Context<AppEnv>,
  operation: (client: ShopifyClient) => Promise<T>,
): Promise<T> {
  const client = await getShopifyClientProvider(c);

  try {
    return await operation(client);
  } catch (error) {
    if (!isShopifyUnauthorizedResponse(error)) {
      throw error;
    }

    c.get("runtimeLogger").warn(
      `Shopify Admin API returned 401 for ${c.var.shopDomain}; refreshing online session and retrying once`,
    );

    setShopifySessionContext(c, await refreshShopifyOnlineSession(c));
    return operation(await getShopifyClientProvider(c));
  }
}

function isShopifyUnauthorizedResponse(error: unknown): boolean {
  const response = (
    error as { response?: { code?: unknown; status?: unknown } }
  )?.response;

  return response?.code === 401 || response?.status === 401;
}
