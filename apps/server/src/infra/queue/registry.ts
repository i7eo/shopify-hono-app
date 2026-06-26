import type { QueueMessage } from "./shared";
import type { ResourceScope } from "@/app/runtime/resources";
import type { RuntimeConfig } from "@/infra/env";
import type { Logger } from "@/infra/logger";

/**
 * Transport-level context built by the runtime queue adapters. It holds no
 * per-message resource bag; the consumer derives that per message.
 */
export type QueueJobContext = {
  bindings?: Record<string, unknown>;
  logger: Logger;
  runtimeEnv: RuntimeConfig;
};

/**
 * Per-message context passed to job handlers. The consumer attaches a fresh
 * resource bag and disposes it once the handler settles, so any database opened
 * during the job is closed exactly once.
 */
export type QueueJobScopedContext = QueueJobContext & {
  resources: ResourceScope;
};

export type QueueJobHandler<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
> = (payload: TPayload, context: QueueJobScopedContext) => Promise<void>;

export type QueueBatchJobHandler<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
> = (
  messages: Array<QueueMessage<string, TPayload>>,
  context: QueueJobScopedContext,
) => Promise<void>;

export type QueueJobDefinition =
  | {
      handler: QueueJobHandler;
      maxBatchSize?: number;
      mode?: "single";
      name: string;
    }
  | {
      batchHandler: QueueBatchJobHandler;
      maxBatchSize?: number;
      mode: "batch";
      name: string;
    };

const queueJobs = new Map<string, QueueJobDefinition>();

export function registerQueueJob(job: QueueJobDefinition): void {
  if (queueJobs.has(job.name)) {
    throw new Error(`Queue job already registered: ${job.name}`);
  }

  queueJobs.set(job.name, job);
}

export function getQueueJob(name: string): QueueJobDefinition | undefined {
  return queueJobs.get(name);
}

export function listQueueJobs(): QueueJobDefinition[] {
  return [...queueJobs.values()];
}

export function resetQueueJobs(): void {
  queueJobs.clear();
}
