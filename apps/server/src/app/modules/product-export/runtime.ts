import { DEFAULT_APP_DATABASE_PROVIDERS } from "@shamt/app-env";
import { createDatabaseShopifySessionStorage } from "@/app/modules/shopify/session-storage/database";
import { createBucket, type Bucket } from "@/infra/bucket";
import { createDatabase, type Database } from "@/infra/database";
import { getShopifyConfigProvider } from "@/infra/provider";
import { unauthorizedError } from "@/shared/exceptions";
import { isCloudflareRuntime } from "./utils";
import type { RuntimeConfig } from "@/infra/env";
import type { QueueJobContext } from "@/infra/queue";
import type { SchedulerTaskContext } from "@/infra/scheduler";
import type { Session } from "@shopify/shopify-api";

type ProductExportRuntimeContext = QueueJobContext | SchedulerTaskContext;

/**
 * Creates the database adapter needed by product-export jobs.
 *
 * Cloudflare jobs receive bindings through queue/scheduler context; Node jobs
 * can use the configured process database directly.
 */
export async function createProductExportDatabase(
  context: ProductExportRuntimeContext,
): Promise<Database> {
  const config = context.runtimeEnv;

  if (!isCloudflareRuntime(config)) {
    return await createDatabase(config);
  }

  if (config.APP_DATABASE_PROVIDER === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
    return await createDatabase(config, {
      d1: context.bindings?.[config.APP_DATABASE_D1_BINDING ?? ""] as
        | D1Database
        | undefined,
    });
  }

  return await createDatabase(config, {
    hyperdrive: context.bindings?.[config.APP_HYPERDRIVER_BINDING ?? ""] as
      | Hyperdrive
      | undefined,
  });
}

/**
 * Creates the bucket adapter used for CSV part and final CSV writes.
 */
export async function createProductExportBucket(
  context: ProductExportRuntimeContext,
): Promise<Bucket> {
  const config = context.runtimeEnv;

  if (!isCloudflareRuntime(config)) {
    return await createBucket(config);
  }

  return await createBucket(config, {
    r2: context.bindings?.[config.APP_BUCKET_R2_BINDING ?? ""] as
      | R2Bucket
      | undefined,
  });
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
