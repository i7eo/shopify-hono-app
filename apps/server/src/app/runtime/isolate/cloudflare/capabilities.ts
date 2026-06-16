import { KVSessionStorage } from "@shopify/shopify-app-session-storage-kv";
import { BucketFileDownloadResolver } from "@/app/modules/file/download";
import {
  setRuntimeCapability,
  type ModuleHealthDiskCheckResult,
} from "@/app/runtime/capabilities";
import { createBucket, createBucketDownloadSigner } from "@/infra/bucket";
import { createDatabase } from "@/infra/database";
import { setupIsolateLogger } from "@/infra/logger/isolate";
import { runtimeNotSupported } from "@/utils/runtime";
import { isCloudflareKVNamespace, requireCloudflareBinding } from "./bindings";
import type { AppEnv, RuntimeAppEnv } from "@/typings";
import type { Context } from "hono";

/**
 * Registers Cloudflare isolate implementations for runtime and module capabilities.
 */
export function registerCloudflareIsolateRuntimeCapabilities() {
  setRuntimeCapability("runtimeLoggerSetup", setupIsolateLogger);
  setRuntimeCapability(
    "runtimeEnvSourceResolver",
    (c) => c.env as unknown as Record<string, unknown>,
  );
  setRuntimeCapability("moduleHealthProcessDiskChecker", isolateNotSupport);
  setRuntimeCapability("moduleShopifySessionStorageFactory", (c) => {
    // KV is request-bound in Workers, so assert it here instead of during
    // process.env bootstrap config parsing.
    const context = c as Context<RuntimeAppEnv<"cloudflare">>;
    const namespace = requireCloudflareBinding(
      context.env.sofary,
      "sofary",
      isCloudflareKVNamespace,
    );

    return new KVSessionStorage(namespace);
  });
  setRuntimeCapability("databaseFactory", (c) => getDatabase(c));
  setRuntimeCapability("bucketFactory", (c) => getBucket(c));
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
 */
function getDatabase(c: Context<AppEnv>) {
  return createDatabase(c.get("runtimeEnv"));
}

/**
 * Creates the runtime bucket once request runtime env is available.
 */
function getBucket(c: Context<AppEnv>) {
  return createBucket(c.get("runtimeEnv"));
}

/**
 * Throws the first-phase placeholder error for file capabilities not yet
 * implemented in the active isolate runtime.
 */
function fileModuleNotSupported(context: Context<AppEnv>): never {
  return runtimeNotSupported({
    mode: "throw",
    runtime: getRuntimeName(context),
    message: "File module is not implemented for Cloudflare runtime yet",
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
