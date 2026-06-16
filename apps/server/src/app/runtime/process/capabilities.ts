import { checkProcessDiskAccess } from "@shamt/node-utils/disk";
import { MemorySessionStorage } from "@shopify/shopify-app-session-storage-memory";
import { MemoryBucketFileDownloadResolver } from "@/app/modules/file/download";
import { createDatabaseFilesStoreFromPromise } from "@/app/modules/file/stores/database-files-store";
import { NoopFileTaskDispatcher } from "@/app/modules/file/tasks/noop-file-task-dispatcher";
import { HonoFileMultipartUploadParser } from "@/app/modules/file/upload/hono-file-multipart-upload-parser";
import {
  setRuntimeCapability,
  type ModuleHealthDiskCheckResult,
} from "@/app/runtime/capabilities";
import { createBucket } from "@/infra/bucket";
import { createDatabase } from "@/infra/database";
import { setupProcessLogger } from "@/infra/logger/process";
import { isDev } from "@/utils";
import { runtimeNotSupported } from "@/utils/runtime";
import type { AppEnv } from "@/typings";
import type { Context } from "hono";

const memorySessionStorage = new MemorySessionStorage();
const fileTaskDispatcher = new NoopFileTaskDispatcher();
const fileMultipartUploadParser = new HonoFileMultipartUploadParser();

/**
 * Registers Node process implementations for runtime and module capabilities.
 */
export function registerProcessRuntimeCapabilities() {
  setRuntimeCapability("runtimeLoggerSetup", setupProcessLogger);
  setRuntimeCapability("runtimeEnvSourceResolver", () => process.env);
  setRuntimeCapability("moduleHealthProcessDiskChecker", async (c) => {
    const path = await checkProcessDiskAccess();

    return {
      status: "ok",
      runtime: c.get("runtimeEnv").APP_RUNTIME,
      path,
    };
  });
  setRuntimeCapability("moduleShopifySessionStorageFactory", (c) => {
    const config = c.get("runtimeEnv");

    if (isDev(config.APP_ENV)) {
      return memorySessionStorage;
    }

    throw new Error(
      "Shopify memory session storage is only available when APP_RUNTIME=node and APP_ENV=development",
    );
  });
  setRuntimeCapability("moduleFileFilesStoreFactory", (c) =>
    createDatabaseFilesStoreFromPromise(createDatabase(c.get("runtimeEnv"))),
  );
  setRuntimeCapability("moduleFileBucketFactory", (c) => getFileBucket(c));
  setRuntimeCapability(
    "moduleFileDownloadResolverFactory",
    async (c) => new MemoryBucketFileDownloadResolver(await getFileBucket(c)),
  );
  setRuntimeCapability(
    "moduleFileMultipartUploadParserFactory",
    () => fileMultipartUploadParser,
  );
  setRuntimeCapability(
    "moduleFileTaskDispatcherFactory",
    () => fileTaskDispatcher,
  );
}

/**
 * Lazily creates the process-memory file bucket once runtime env is available.
 */
function getFileBucket(c: Context<AppEnv>) {
  return createBucket(c.get("runtimeEnv"));
}

/**
 * Returns an unsupported health result for process capabilities without support.
 */
export function processNotSupport(
  c: Context<AppEnv>,
): ModuleHealthDiskCheckResult {
  return runtimeNotSupported({
    runtime: c.get("runtimeEnv").APP_RUNTIME,
  });
}
