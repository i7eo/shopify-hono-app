import {
  DEFAULT_APP_DATABASE_PROVIDERS,
  DEFAULT_RUNTIMES,
} from "@shamt/app-env";
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
import {
  createQueueConsumer,
  createQueueProducer,
  disposeQueueConsumer,
  disposeQueueProducer,
} from "@/infra/queue";
import { createScheduler, disposeScheduler } from "@/infra/scheduler";
import { runtimeNotSupported } from "@/utils/runtime";
import {
  isCloudflareD1Database,
  isCloudflareHyperdrive,
  isCloudflareQueue,
  isCloudflareR2Bucket,
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
    "queueProducerFactory",
    (c) => getQueueProducer(c),
    disposeQueueProducerCapability,
  );
  setRuntimeCapability(
    "queueConsumerFactory",
    (config) => createQueueConsumer(config),
    disposeQueueConsumerCapability,
  );
  setRuntimeCapability(
    "schedulerFactory",
    (config) => createScheduler(config),
    disposeSchedulerCapability,
  );
  setRuntimeCapability(
    "moduleFileDownloadResolverFactory",
    async (c) =>
      new BucketFileDownloadResolver(
        await getBucket(c),
        await createBucketDownloadSigner(c.get("runtimeEnv")),
      ),
  );
}

/**
 * Creates the runtime database once request runtime env is available.
 *
 * Example:
 * - APP_DATABASE_PROVIDER=d1 requires APP_DATABASE_D1_BINDING.
 * - APP_DATABASE_PROVIDER=postgres requires APP_HYPERDRIVER_BINDING.
 */
function getDatabase(c: Context<AppEnv>) {
  const context = c as Context<RuntimeAppEnv<"cloudflare">>;
  const config = c.get("runtimeEnv");

  if (config.APP_DATABASE_PROVIDER === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
    return createDatabase(config, {
      d1: requireConfiguredCloudflareBinding(
        context.env,
        config.APP_DATABASE_D1_BINDING,
        "APP_DATABASE_D1_BINDING",
        isCloudflareD1Database,
      ),
    });
  }

  return createDatabase(config, {
    hyperdrive: requireConfiguredCloudflareBinding(
      context.env,
      config.APP_HYPERDRIVER_BINDING,
      "APP_HYPERDRIVER_BINDING",
      isCloudflareHyperdrive,
    ),
  });
}

/**
 * Creates the runtime bucket once request runtime env is available.
 * Cloudflare supports the r2 provider through the request-bound R2 binding.
 */
function getBucket(c: Context<AppEnv>) {
  const context = c as Context<RuntimeAppEnv<"cloudflare">>;
  const config = c.get("runtimeEnv");

  return createBucket(config, {
    r2: requireConfiguredCloudflareBinding(
      context.env,
      config.APP_BUCKET_R2_BINDING,
      "APP_BUCKET_R2_BINDING",
      isCloudflareR2Bucket,
    ),
  });
}

/**
 * Creates the runtime queue producer once request runtime env is available.
 * Cloudflare supports the queues provider through the request-bound Queue
 * binding.
 */
function getQueueProducer(c: Context<AppEnv>) {
  const context = c as Context<RuntimeAppEnv<"cloudflare">>;
  const config = c.get("runtimeEnv");

  return createQueueProducer(config, {
    queue: requireConfiguredCloudflareBinding(
      context.env,
      config.APP_QUEUE_BINDING,
      "APP_QUEUE_BINDING",
      isCloudflareQueue,
    ),
  });
}

function requireConfiguredCloudflareBinding<T>(
  env: Record<string, unknown>,
  binding: string | undefined,
  bindingConfigKey: string,
  validate: (value: unknown) => value is T,
): T {
  if (!binding) {
    return requireCloudflareBinding(undefined, bindingConfigKey, validate);
  }

  return requireCloudflareBinding(env[binding], binding, validate);
}

/**
 * Disposes isolate database infrastructure when one is cached.
 */
function disposeDatabaseCapability() {
  return disposeDatabase({ APP_RUNTIME: DEFAULT_RUNTIMES.CLOUDFLARE });
}

/**
 * Disposes isolate bucket infrastructure when one is cached.
 */
function disposeBucketCapability() {
  return disposeBucket({ APP_RUNTIME: DEFAULT_RUNTIMES.CLOUDFLARE });
}

/**
 * Disposes isolate queue infrastructure when one is cached.
 */
function disposeQueueProducerCapability() {
  return disposeQueueProducer({ APP_RUNTIME: DEFAULT_RUNTIMES.CLOUDFLARE });
}

/**
 * Disposes isolate queue consumer infrastructure when one is cached.
 */
function disposeQueueConsumerCapability() {
  return disposeQueueConsumer({ APP_RUNTIME: DEFAULT_RUNTIMES.CLOUDFLARE });
}

/**
 * Disposes isolate scheduler infrastructure when one is cached.
 */
function disposeSchedulerCapability() {
  return disposeScheduler({ APP_RUNTIME: DEFAULT_RUNTIMES.CLOUDFLARE });
}

/**
 * Returns an unsupported health result for isolate capabilities without support.
 */
function isolateNotSupport(c: Context<AppEnv>): ModuleHealthDiskCheckResult {
  return runtimeNotSupported({
    runtime: c.get("runtimeEnv").APP_RUNTIME,
  });
}
