import { DEFAULT_APP_DATABASE_PROVIDERS } from "@shamt/app-env";
import { BucketFileDownloadResolver } from "@/app/modules/file/download";
import {
  setRuntimeCapability,
  type ModuleHealthDiskCheckResult,
} from "@/app/runtime/capabilities";
import {
  createBucket,
  createBucketDownloadSigner,
  disposeBucket,
} from "@/infra/bucket";
import { createDatabase, disposeDatabase } from "@/infra/database";
import { setupIsolateLogger } from "@/infra/logger/isolate";
import { runtimeNotSupported } from "@/utils/runtime";
import {
  isCloudflareD1Database,
  isCloudflareHyperdrive,
  requireCloudflareBinding,
} from "./bindings";
import type { AppEnv, RuntimeAppEnv } from "@/typings";
import type { Context } from "hono";

/**
 * Registers Cloudflare isolate implementations for runtime and module
 * capabilities. Request-bound D1, Hyperdrive and R2 inputs are validated only
 * when their capability is used.
 */
export function registerCloudflareIsolateRuntimeCapabilities() {
  setRuntimeCapability("runtimeLoggerSetup", setupIsolateLogger);
  setRuntimeCapability(
    "runtimeEnvSourceResolver",
    (c) => c.env as unknown as Record<string, unknown>,
  );
  setRuntimeCapability("moduleHealthProcessDiskChecker", isolateNotSupport);
  setRuntimeCapability(
    "databaseFactory",
    (c) => getDatabase(c),
    disposeDatabaseCapability,
  );
  setRuntimeCapability(
    "bucketFactory",
    (c) => getBucket(c),
    disposeBucketCapability,
  );
  setRuntimeCapability(
    "moduleFileDownloadResolverFactory",
    async (c) =>
      new BucketFileDownloadResolver(
        await getBucket(c),
        await createBucketDownloadSigner(c.get("runtimeEnv")),
      ),
  );
  setRuntimeCapability(
    "moduleFileTaskDispatcherFactory",
    fileModuleNotSupported,
  );
}

/**
 * Creates the runtime database once request runtime env is available.
 *
 * Example:
 * - APP_DATABASE_PROVIDER=d1 requires i7eo_dev_shopify_app_d1.
 * - APP_DATABASE_PROVIDER=postgres requires i7eo_dev_shopify_app_hyperdrive.
 */
function getDatabase(c: Context<AppEnv>) {
  const context = c as Context<RuntimeAppEnv<"cloudflare">>;
  const config = c.get("runtimeEnv");

  if (config.APP_DATABASE_PROVIDER === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
    return createDatabase(config, {
      d1: requireCloudflareBinding(
        context.env.i7eo_dev_shopify_app_d1,
        "i7eo_dev_shopify_app_d1",
        isCloudflareD1Database,
      ),
    });
  }

  return createDatabase(config, {
    hyperdrive: requireCloudflareBinding(
      context.env.i7eo_dev_shopify_app_hyperdrive,
      "i7eo_dev_shopify_app_hyperdrive",
      isCloudflareHyperdrive,
    ),
  });
}

/**
 * Creates the runtime bucket once request runtime env is available.
 * Cloudflare currently supports the r2 provider through the shared
 * S3-compatible bucket implementation.
 */
function getBucket(c: Context<AppEnv>) {
  return createBucket(c.get("runtimeEnv"));
}

/**
 * Disposes isolate database infrastructure when one is cached.
 */
function disposeDatabaseCapability() {
  return disposeDatabase({ APP_RUNTIME: "cloudflare" });
}

/**
 * Disposes isolate bucket infrastructure when one is cached.
 */
function disposeBucketCapability() {
  return disposeBucket({ APP_RUNTIME: "cloudflare" });
}

/**
 * Throws until the Cloudflare file background task dispatcher is backed by
 * Cloudflare Queues or another isolate-safe task transport.
 */
function fileModuleNotSupported(context: Context<AppEnv>): never {
  return runtimeNotSupported({
    mode: "throw",
    runtime: getRuntimeName(context),
    message:
      "File background task dispatcher is not implemented for Cloudflare runtime yet",
  });
}

/**
 * Returns an unsupported health result for isolate capabilities without support.
 */
function isolateNotSupport(
  context: Context<AppEnv>,
): ModuleHealthDiskCheckResult {
  return runtimeNotSupported({
    runtime: getRuntimeName(context),
  });
}

/**
 * Reads the isolate runtime name from Cloudflare env with a stable fallback.
 */
function getRuntimeName(context: Context<AppEnv>) {
  const cloudflareContext = context as Context<RuntimeAppEnv<"cloudflare">>;

  return cloudflareContext.env.APP_RUNTIME ?? "cloudflare";
}
