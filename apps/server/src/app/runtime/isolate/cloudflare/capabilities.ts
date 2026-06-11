import { KVSessionStorage } from "@shopify/shopify-app-session-storage-kv";
import { setRuntimeCapability } from "@/app/runtime/capabilities";
import { setupIsolateLogger } from "@/infra/logger/isolate";
import { isCloudflareKVNamespace, requireCloudflareBinding } from "./bindings";
import type { RuntimeAppEnv } from "@/typings";
import type { Context } from "hono";

export function registerCloudflareIsolateRuntimeCapabilities() {
  setRuntimeCapability("runtimeLoggerSetup", setupIsolateLogger);
  setRuntimeCapability(
    "runtimeEnvSourceResolver",
    (c) => c.env as unknown as Record<string, unknown>,
  );
  setRuntimeCapability("shopifySessionStorageFactory", (c) => {
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
}
