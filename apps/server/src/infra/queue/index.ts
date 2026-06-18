import { isIsolateRuntime } from "@/utils";
import type { IsolateQueueOptions } from "./isolate";
import type { QueueConsumer, QueueProducer } from "./shared";
import type { RuntimeConfig } from "@/infra/env";

const ISOLATE_QUEUE_MODULE = "./isolate";
const PROCESS_QUEUE_MODULE = "./process";

/**
 * Creates the runtime-specific queue producer through a dynamic import.
 *
 * Example:
 * - node + pg-boss -> Postgres-backed queue producer
 * - cloudflare + queues -> request-bound Cloudflare Queue binding producer
 */
export async function createQueueProducer(
  config: RuntimeConfig,
  isolateOptions?: IsolateQueueOptions,
): Promise<QueueProducer> {
  if (isIsolateRuntime(config.APP_RUNTIME)) {
    const { createIsolateQueueProducer } = await import(ISOLATE_QUEUE_MODULE);
    return createIsolateQueueProducer(config, isolateOptions);
  }

  const { getProcessQueueProducer } = await import(PROCESS_QUEUE_MODULE);
  return getProcessQueueProducer(config);
}

/**
 * Disposes cached runtime queue producers when the implementation keeps any.
 * Isolate queue producers are request-bound today, so their disposer is a no-op.
 */
export async function disposeQueueProducer(
  config: Pick<RuntimeConfig, "APP_RUNTIME">,
): Promise<void> {
  if (isIsolateRuntime(config.APP_RUNTIME)) {
    const { disposeIsolateQueueProducer } = await import(ISOLATE_QUEUE_MODULE);
    await disposeIsolateQueueProducer();
    return;
  }

  const { disposeProcessQueueProducer } = await import(PROCESS_QUEUE_MODULE);
  await disposeProcessQueueProducer();
}

/**
 * Creates the runtime-specific queue consumer through a dynamic import.
 *
 * Example:
 * - node + pg-boss -> polling consumer over Postgres-backed queues
 * - cloudflare + queues -> Cloudflare Queue batch consumer
 */
export async function createQueueConsumer(
  config: RuntimeConfig,
): Promise<QueueConsumer> {
  if (isIsolateRuntime(config.APP_RUNTIME)) {
    const { createIsolateQueueConsumer } = await import(ISOLATE_QUEUE_MODULE);
    return createIsolateQueueConsumer(config);
  }

  const { createProcessQueueConsumer } = await import(PROCESS_QUEUE_MODULE);
  return createProcessQueueConsumer(config);
}

/**
 * Disposes cached runtime queue consumers when the implementation keeps any.
 * Isolate queue consumers are event-scoped today, so their disposer is a no-op.
 */
export async function disposeQueueConsumer(
  config: Pick<RuntimeConfig, "APP_RUNTIME">,
): Promise<void> {
  if (isIsolateRuntime(config.APP_RUNTIME)) {
    const { disposeIsolateQueueConsumer } = await import(ISOLATE_QUEUE_MODULE);
    await disposeIsolateQueueConsumer();
    return;
  }

  const { stopProcessQueueConsumer } = await import(PROCESS_QUEUE_MODULE);
  await stopProcessQueueConsumer();
}

export { registerQueueJob } from "./registry";
export type {
  QueueJobContext,
  QueueJobDefinition,
  QueueJobHandler,
} from "./registry";
export type {
  QueueConsumer,
  QueueEnqueueOptions,
  QueueMessage,
  QueueProducer,
} from "./shared";
