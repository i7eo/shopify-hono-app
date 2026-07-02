import { BucketFileDownloadResolver } from "@/app/modules/file/download";
import { setRuntimeCapability } from "@/app/runtime/capabilities";
import { createBucketDownloadSigner } from "@/infra/bucket";
import {
  createIsolateBucket,
  disposeIsolateBucket,
} from "@/infra/bucket/isolate";
import {
  createIsolateDatabase,
  disposeIsolateDatabase,
} from "@/infra/database/isolate";
import { setupIsolateLogger } from "@/infra/logger/isolate";
import {
  createIsolateQueueConsumer,
  createIsolateQueueProducer,
  disposeIsolateQueueConsumer,
  disposeIsolateQueueProducer,
} from "@/infra/queue/isolate";
import {
  createIsolateScheduler,
  disposeIsolateScheduler,
} from "@/infra/scheduler/isolate";
import { runtimeNotSupported } from "@/utils/runtime";
import {
  isCloudflareD1Database,
  isCloudflareQueue,
  isCloudflareR2Bucket,
  requireCloudflareBinding,
} from "./bindings";
import type { AppEnv, RuntimeAppEnv } from "@/typings";
import type { Context } from "hono";

/**
 * Registers Cloudflare isolate implementations for runtime and module
 * capabilities. Request-bound D1 and R2 inputs are validated only when their
 * capability is used.
 */
export function registerCloudflareIsolateRuntimeCapabilities() {
  setRuntimeCapability("runtimeLoggerSetup", setupIsolateLogger);
  setRuntimeCapability(
    "runtimeEnvSourceResolver",
    (c) => c.env as unknown as Record<string, unknown>,
  );
  setRuntimeCapability("moduleHealthDiskChecker", isolateNotSupport);
  setRuntimeCapability("moduleHealthMemoryChecker", isolateNotSupport);
  setRuntimeCapability(
    "databaseFactory",
    (context) => getDatabase(context),
    disposeDatabaseCapability,
  );
  setRuntimeCapability(
    "bucketFactory",
    (context) =>
      createIsolateBucket(context.runtimeEnv, {
        r2: requireConfiguredCloudflareBinding(
          context.bindings ?? {},
          context.runtimeEnv.APP_BUCKET_R2_BINDING,
          "APP_BUCKET_R2_BINDING",
          isCloudflareR2Bucket,
        ),
      }),
    disposeBucketCapability,
  );
  setRuntimeCapability(
    "queueProducerFactory",
    (context) => getQueueProducer(context),
    disposeQueueProducerCapability,
  );
  setRuntimeCapability(
    "queueConsumerFactory",
    (config) => createIsolateQueueConsumer(config),
    disposeQueueConsumerCapability,
  );
  setRuntimeCapability(
    "schedulerFactory",
    (config) => createIsolateScheduler(config),
    disposeSchedulerCapability,
  );
  setRuntimeCapability(
    "moduleFileDownloadResolverFactory",
    async (context) =>
      new BucketFileDownloadResolver(
        await createIsolateBucket(context.runtimeEnv, {
          r2: requireConfiguredCloudflareBinding(
            context.bindings ?? {},
            context.runtimeEnv.APP_BUCKET_R2_BINDING,
            "APP_BUCKET_R2_BINDING",
            isCloudflareR2Bucket,
          ),
        }),
        await createBucketDownloadSigner(context.runtimeEnv),
      ),
  );
}

/**
 * Creates the runtime database once request runtime env is available.
 */
function getDatabase(context: {
  bindings?: Record<string, unknown>;
  runtimeEnv: RuntimeAppEnv<"cloudflare">["Variables"]["runtimeEnv"];
}) {
  const config = context.runtimeEnv;

  return createIsolateDatabase(config, {
    d1: requireConfiguredCloudflareBinding(
      context.bindings ?? {},
      config.APP_DATABASE_D1_BINDING,
      "APP_DATABASE_D1_BINDING",
      isCloudflareD1Database,
    ),
  });
}

/**
 * Creates the runtime bucket once request runtime env is available.
 * Cloudflare supports the r2 provider through the request-bound R2 binding.
 */
function getQueueProducer(context: {
  bindings?: Record<string, unknown>;
  runtimeEnv: RuntimeAppEnv<"cloudflare">["Variables"]["runtimeEnv"];
}) {
  const config = context.runtimeEnv;

  return createIsolateQueueProducer(config, {
    queue: requireConfiguredCloudflareBinding(
      context.bindings ?? {},
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
  return disposeIsolateDatabase();
}

/**
 * Disposes isolate bucket infrastructure when one is cached.
 */
function disposeBucketCapability() {
  return disposeIsolateBucket();
}

/**
 * Disposes isolate queue infrastructure when one is cached.
 */
function disposeQueueProducerCapability() {
  return disposeIsolateQueueProducer();
}

/**
 * Disposes isolate queue consumer infrastructure when one is cached.
 */
function disposeQueueConsumerCapability() {
  return disposeIsolateQueueConsumer();
}

/**
 * Disposes isolate scheduler infrastructure when one is cached.
 */
function disposeSchedulerCapability() {
  return disposeIsolateScheduler();
}

/**
 * Returns an unsupported health result for isolate capabilities without support.
 */
function isolateNotSupport(c: Context<AppEnv>) {
  return runtimeNotSupported({
    runtime: c.get("runtimeEnv").APP_RUNTIME,
  });
}
