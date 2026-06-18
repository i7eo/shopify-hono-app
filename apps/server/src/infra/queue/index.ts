import { isIsolateRuntime } from "@/utils";
import type { IsolateQueueOptions } from "./isolate";
import type { QueueProducer } from "./shared";
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
  if (isIsolateRuntime(config.APP_RUNTIME)) return;

  const { disposeProcessQueueProducer } = await import(PROCESS_QUEUE_MODULE);
  await disposeProcessQueueProducer();
}

export { consumeQueueBatch } from "./consumer";
export {
  CloudflareQueueProducer,
  consumeCloudflareQueueBatch,
} from "./isolate";
export { startProcessQueueConsumer, stopProcessQueueConsumer } from "./process";
export {
  getQueueJob,
  listQueueJobs,
  registerQueueJob,
  resetQueueJobs,
} from "./registry";
export * from "./shared";
export type { IsolateQueueOptions } from "./isolate";
export type {
  QueueJobContext,
  QueueJobDefinition,
  QueueJobHandler,
} from "./registry";
