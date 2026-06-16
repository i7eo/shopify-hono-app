import { KVSessionStorage } from "@shopify/shopify-app-session-storage-kv";
import { createDatabaseFilesStoreFromPromise } from "@/app/modules/file/stores/database-files-store";
import {
  setRuntimeCapability,
  type ModuleHealthDiskCheckResult,
} from "@/app/runtime/capabilities";
import { createBucket } from "@/infra/bucket";
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
  setRuntimeCapability("moduleFileFilesStoreFactory", (c) =>
    createDatabaseFilesStoreFromPromise(createCloudflareDatabase(c)),
  );
  setRuntimeCapability("moduleFileBucketFactory", (c) =>
    createBucket(c.get("runtimeEnv")),
  );
  setRuntimeCapability(
    "moduleFileDownloadResolverFactory",
    fileModuleNotSupported,
  );
  setRuntimeCapability(
    "moduleFileTaskDispatcherFactory",
    fileModuleNotSupported,
  );
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

/**
 * Creates the Cloudflare database with request-bound platform bindings.
 */
function createCloudflareDatabase(context: Context<AppEnv>) {
  const cloudflareContext = context as Context<RuntimeAppEnv<"cloudflare">>;

  return createDatabase(context.get("runtimeEnv"), {
    d1: cloudflareContext.env.i7eo_dev_shopify_app_d1,
    hyperdrive: cloudflareContext.env.i7eo_dev_shopify_app_hyperdrive,
  });
}
