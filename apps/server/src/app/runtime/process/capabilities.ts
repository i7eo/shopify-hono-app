import { checkProcessDiskAccess } from "@unimolecule/utils/node";
import { BucketFileDownloadResolver } from "@/app/modules/file/download";
import {
  setRuntimeCapability,
  type ModuleHealthDiskCheckResult,
} from "@/app/runtime/capabilities";
import { createBucketDownloadSigner } from "@/infra/bucket";
import { disposeProcessBucket, getProcessBucket } from "@/infra/bucket/process";
import {
  disposeProcessDatabase,
  getProcessDatabase,
} from "@/infra/database/process";
import { setupProcessLogger } from "@/infra/logger/process";
import {
  createProcessQueueConsumer,
  disposeProcessQueueProducer,
  getProcessQueueProducer,
  stopProcessQueueConsumer,
} from "@/infra/queue/process";
import {
  createProcessScheduler,
  disposeProcessScheduler,
} from "@/infra/scheduler/process";
import { runtimeNotSupported } from "@/utils/runtime";
import type { AppEnv } from "@/typings";
import type { Context } from "hono";

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
    (context) => getProcessDatabase(context.runtimeEnv),
    disposeDatabaseCapability,
  );
  setRuntimeCapability(
    "bucketFactory",
    (context) => getProcessBucket(context.runtimeEnv),
    disposeBucketCapability,
  );
  setRuntimeCapability(
    "queueProducerFactory",
    (context) => getProcessQueueProducer(context.runtimeEnv),
    disposeQueueProducerCapability,
  );
  setRuntimeCapability(
    "queueConsumerFactory",
    (config) => createProcessQueueConsumer(config),
    disposeQueueConsumerCapability,
  );
  setRuntimeCapability(
    "schedulerFactory",
    (config) => createProcessScheduler(config),
    disposeSchedulerCapability,
  );
  setRuntimeCapability(
    "moduleFileDownloadResolverFactory",
    async (context) =>
      new BucketFileDownloadResolver(
        await getProcessBucket(context.runtimeEnv),
        await createBucketDownloadSigner(context.runtimeEnv),
      ),
  );
}

/**
 * Disposes cached process database infrastructure.
 */
function disposeDatabaseCapability() {
  return disposeProcessDatabase();
}

/**
 * Disposes cached process bucket infrastructure.
 */
function disposeBucketCapability() {
  disposeProcessBucket();
}

/**
 * Disposes cached process queue infrastructure.
 */
function disposeQueueProducerCapability() {
  return disposeProcessQueueProducer();
}

/**
 * Disposes cached process queue consumer infrastructure.
 */
function disposeQueueConsumerCapability() {
  return stopProcessQueueConsumer();
}

/**
 * Disposes cached process scheduler infrastructure.
 */
function disposeSchedulerCapability() {
  return disposeProcessScheduler();
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
