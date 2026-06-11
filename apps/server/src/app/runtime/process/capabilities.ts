import { checkProcessDiskAccess } from "@shamt/node-utils/disk";
import { MemorySessionStorage } from "@shopify/shopify-app-session-storage-memory";
import { setRuntimeCapability } from "@/app/runtime/capabilities";
import { setupProcessLogger } from "@/infra/logger/process";
import { isDev } from "@/utils";

const memorySessionStorage = new MemorySessionStorage();

export function registerProcessRuntimeCapabilities() {
  setRuntimeCapability("runtimeLoggerSetup", setupProcessLogger);
  setRuntimeCapability("processDiskHealthChecker", checkProcessDiskAccess);
  setRuntimeCapability("runtimeEnvSourceResolver", () => process.env);
  setRuntimeCapability("shopifySessionStorageFactory", (c) => {
    const config = c.get("runtimeEnv");

    if (isDev(config.APP_ENV)) {
      return memorySessionStorage;
    }

    throw new Error(
      "Shopify memory session storage is only available when APP_RUNTIME=node and APP_ENV=development",
    );
  });
}
