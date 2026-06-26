import { createDatabaseShopifySessionStorage } from "@/app/modules/shopify/session-storage/database";
import { getRuntimeCapability } from "@/app/runtime/capabilities";
import { getShopifyConfigProvider } from "@/infra/provider";
import { badGatewayError, unauthorizedError } from "@/shared/exceptions";
import type { Bucket } from "@/infra/bucket";
import type { Database } from "@/infra/database";
import type { RuntimeConfig } from "@/infra/env";
import type { QueueJobContext } from "@/infra/queue";
import type { SchedulerTaskContext } from "@/infra/scheduler";
import type { Session } from "@shopify/shopify-api";

type ProductExportRuntimeContext = QueueJobContext | SchedulerTaskContext;

/**
 * Creates the bucket adapter used for CSV part and final CSV writes.
 */
export async function createProductExportBucket(
  context: ProductExportRuntimeContext,
): Promise<Bucket> {
  const bucketFactory = getRuntimeCapability("bucketFactory");

  if (!bucketFactory) {
    throw badGatewayError(
      "Runtime capability is not registered: bucketFactory",
      {
        expose: true,
      },
    );
  }

  return await bucketFactory(context);
}

/**
 * Creates a Shopify Admin GraphQL client from the shop's offline session.
 */
export async function createProductExportShopifyClient(
  config: RuntimeConfig,
  database: Database,
  shopDomain: string,
) {
  const shopify = await getShopifyConfigProvider(config);
  const session = await loadOfflineSession(config, database, shopDomain);

  return new shopify.clients.Graphql({ session });
}

export type ProductExportShopifyClientContext = {
  client: ReturnType<typeof createProductExportGraphqlClient>;
  session: Session;
};

/**
 * Creates a Shopify Admin GraphQL client together with the offline session that
 * owns background product-export work.
 */
export async function createProductExportShopifyClientContext(
  config: RuntimeConfig,
  database: Database,
  shopDomain: string,
): Promise<ProductExportShopifyClientContext> {
  const shopify = await getShopifyConfigProvider(config);
  const session = await loadOfflineSession(config, database, shopDomain);

  return {
    client: createProductExportGraphqlClient(shopify, session),
    session,
  };
}

/**
 * Loads an active offline Admin session for background jobs.
 */
async function loadOfflineSession(
  config: RuntimeConfig,
  database: Database,
  shopDomain: string,
): Promise<Session> {
  const shopify = await getShopifyConfigProvider(config);
  const storage = createDatabaseShopifySessionStorage(database);
  const sessions = await storage.findSessionsByShop(shopDomain);
  const session = sessions.find(
    (candidate) => !candidate.isOnline && candidate.accessToken,
  );

  if (!session || !session.isActive(shopify.config.scopes)) {
    throw unauthorizedError("No active offline Shopify Admin session found", {
      details: {
        shopDomain,
      },
    });
  }

  return session;
}

function createProductExportGraphqlClient(
  shopify: Awaited<ReturnType<typeof getShopifyConfigProvider>>,
  session: Session,
) {
  return new shopify.clients.Graphql({ session });
}
