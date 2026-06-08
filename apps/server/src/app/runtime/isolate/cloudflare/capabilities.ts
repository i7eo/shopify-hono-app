import { KVSessionStorage } from "@shopify/shopify-app-session-storage-kv";
import { setRuntimeCapability } from "@/app/runtime/capabilities";
import { setupIsolateLogger } from "@/infra/logger/isolate";

export function registerCloudflareIsolateRuntimeCapabilities() {
  setRuntimeCapability("runtimeLoggerSetup", setupIsolateLogger);
  setRuntimeCapability(
    "runtimeEnvSourceResolver",
    (c) => c.env as unknown as Record<string, unknown>,
  );
  setRuntimeCapability(
    "shopifySessionStorageFactory",
    (c) => new KVSessionStorage(c.env.sofary),
  );
}
