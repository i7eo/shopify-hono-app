import { checkProcessDiskAccess } from "@shamt/node-utils/disk";
import { BucketFileDownloadResolver } from "@/app/modules/file/download";
import { NoopFileTaskDispatcher } from "@/app/modules/file/tasks/noop-file-task-dispatcher";
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
import { setupProcessLogger } from "@/infra/logger/process";
import { createQueueProducer, disposeQueueProducer } from "@/infra/queue";
import { runtimeNotSupported } from "@/utils/runtime";
import type { AppEnv } from "@/typings";
import type { Context } from "hono";

const fileTaskDispatcher = new NoopFileTaskDispatcher();

/**
 * Registers Node process implementations for runtime and module capabilities.
 * databaseFactory and bucketFactory also register disposers for cached process
 * resources such as pg pools and bucket adapters.
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
    "queueProducerFactory",
    (c) => getQueueProducer(c),
    disposeQueueProducerCapability,
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
    () => fileTaskDispatcher,
  );
}

/**
 * Creates the runtime database once request runtime env is available.
 * Example: APP_DATABASE_PROVIDER=postgres returns the cached pg.Pool client.
 */
function getDatabase(c: Context<AppEnv>) {
  return createDatabase(c.get("runtimeEnv"));
}

/**
 * Creates the runtime bucket once request runtime env is available.
 * Example: APP_BUCKET_PROVIDER=memory returns the process memory bucket.
 */
function getBucket(c: Context<AppEnv>) {
  return createBucket(c.get("runtimeEnv"));
}

/**
 * Creates the runtime queue producer once request runtime env is available.
 * Example: APP_QUEUE_PROVIDER=pg-boss returns the cached pg-boss producer.
 */
function getQueueProducer(c: Context<AppEnv>) {
  return createQueueProducer(c.get("runtimeEnv"));
}

/**
 * Disposes cached process database infrastructure.
 */
function disposeDatabaseCapability() {
  return disposeDatabase({ APP_RUNTIME: "node" });
}

/**
 * Disposes cached process bucket infrastructure.
 */
function disposeBucketCapability() {
  return disposeBucket({ APP_RUNTIME: "node" });
}

/**
 * Disposes cached process queue infrastructure.
 */
function disposeQueueProducerCapability() {
  return disposeQueueProducer({ APP_RUNTIME: "node" });
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
