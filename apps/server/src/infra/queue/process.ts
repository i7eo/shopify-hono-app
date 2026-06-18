import { getDatabaseUrl } from "@/infra/database/shared";
import { consumeQueueBatch } from "./consumer";
import { listQueueJobs, type QueueJobContext } from "./registry";
import {
  getQueueEnvConfig,
  getQueueJobName,
  type QueueEnqueueOptions,
  type QueueMessage,
  type QueueProducer,
  type QueueRuntimeStrategy,
} from "./shared";
import type { RuntimeConfig } from "@/infra/env";
import type { JobWithMetadata, PgBoss, SendOptions } from "pg-boss";

let processQueueProducer: Promise<QueueProducer> | undefined;
let processQueueCacheKey: string | undefined;
let processQueueBoss: Promise<PgBoss> | undefined;
let processQueueBossCacheKey: string | undefined;
let processQueueConsumer: ProcessQueueConsumerController | undefined;

/**
 * Reuses the selected process queue producer across Node requests.
 */
export function getProcessQueueProducer(
  config: RuntimeConfig,
): Promise<QueueProducer> {
  const cacheKey = getProcessQueueCacheKey(config);

  if (!processQueueProducer || processQueueCacheKey !== cacheKey) {
    processQueueProducer = createProcessQueueProducer(config);
    processQueueCacheKey = cacheKey;
  }

  return processQueueProducer;
}

/**
 * Creates the Node pg-boss queue producer.
 */
export async function createProcessQueueProducer(
  config: RuntimeConfig,
): Promise<QueueProducer> {
  const strategy = getQueueEnvConfig(config);
  const boss = await getProcessQueueBoss(config);

  return new PgBossQueueProducer(boss, strategy);
}

/**
 * Closes the cached process queue producer and clears its runtime cache.
 */
export async function disposeProcessQueueProducer(): Promise<void> {
  const producer = await processQueueProducer;
  processQueueProducer = undefined;
  processQueueCacheKey = undefined;
  processQueueBoss = undefined;
  processQueueBossCacheKey = undefined;

  if (producer instanceof PgBossQueueProducer) {
    await producer.dispose();
  }
}

export class PgBossQueueProducer implements QueueProducer {
  constructor(
    private readonly boss: PgBoss,
    private readonly strategy: QueueRuntimeStrategy,
  ) {}

  async enqueue(
    message: QueueMessage,
    options: QueueEnqueueOptions = {},
  ): Promise<void> {
    await this.boss.send(
      getQueueJobName(this.strategy, message.name),
      message,
      mapPgBossOptions(options),
    );
  }

  async enqueueBatch(
    messages: QueueMessage[],
    options: QueueEnqueueOptions = {},
  ): Promise<void> {
    if (messages.length === 0) return;

    await Promise.all(
      messages.map((message) => this.enqueue(message, options)),
    );
  }

  async dispose(): Promise<void> {
    await this.boss.stop();
  }
}

export type ProcessQueueConsumerController = {
  start: () => void;
  stop: () => Promise<void>;
};

/**
 * Starts pg-boss polling consumers for all registered queue jobs.
 */
export async function createProcessQueueConsumer(
  config: RuntimeConfig,
  context: QueueJobContext,
): Promise<ProcessQueueConsumerController> {
  const jobs = listQueueJobs();

  if (jobs.length === 0) {
    return {
      start() {},
      stop: () => Promise.resolve(),
    };
  }

  const strategy = getQueueEnvConfig(config);
  const boss = await getProcessQueueBoss(config);
  const consumers = jobs.map((job) =>
    createProcessQueueJobConsumer({
      boss,
      context,
      queueName: getQueueJobName(strategy, job.name),
      maxBatchSize:
        job.maxBatchSize ?? config.APP_QUEUE_CONSUMER_MAX_BATCH_SIZE,
    }),
  );

  return {
    start() {
      for (const consumer of consumers) {
        consumer.start();
      }
    },
    async stop() {
      await Promise.all(consumers.map((consumer) => consumer.stop()));
    },
  };
}

export async function startProcessQueueConsumer(
  config: RuntimeConfig,
  context: QueueJobContext,
): Promise<void> {
  if (processQueueConsumer) return;

  processQueueConsumer = await createProcessQueueConsumer(config, context);
  processQueueConsumer.start();
}

export async function stopProcessQueueConsumer(): Promise<void> {
  const consumer = processQueueConsumer;
  processQueueConsumer = undefined;

  await consumer?.stop();
}

function createProcessQueueJobConsumer(input: {
  boss: PgBoss;
  context: QueueJobContext;
  maxBatchSize: number;
  queueName: string;
}): ProcessQueueConsumerController {
  let running = false;
  let loop: Promise<void> | undefined;

  async function consumeLoop() {
    while (running) {
      const jobs = await input.boss.fetch<QueueMessage>(input.queueName, {
        batchSize: input.maxBatchSize,
        includeMetadata: true,
      });

      if (jobs.length === 0) {
        await sleep(1000);
        continue;
      }

      await consumeProcessJobs(
        input.boss,
        input.queueName,
        jobs,
        input.context,
      );
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      loop = consumeLoop();
    },
    async stop() {
      running = false;
      await loop;
    },
  };
}

async function consumeProcessJobs(
  boss: PgBoss,
  queueName: string,
  jobs: Array<JobWithMetadata<QueueMessage>>,
  context: QueueJobContext,
): Promise<void> {
  const result = await consumeQueueBatch(
    {
      messages: jobs.map((job) => ({
        attempts: job.retryCount + 1,
        body: job.data,
        id: job.id,
      })),
    },
    context,
  );

  await Promise.all(
    result.results.map((messageResult) => {
      if (messageResult.action === "ack") {
        return boss.complete(queueName, messageResult.id);
      }

      return boss.fail(queueName, messageResult.id, {
        error:
          messageResult.error instanceof Error
            ? messageResult.error.message
            : String(messageResult.error),
      });
    }),
  );
}

function getProcessQueueBoss(config: RuntimeConfig): Promise<PgBoss> {
  const cacheKey = getProcessQueueCacheKey(config);

  if (!processQueueBoss || processQueueBossCacheKey !== cacheKey) {
    processQueueBoss = createProcessQueueBoss(config);
    processQueueBossCacheKey = cacheKey;
  }

  return processQueueBoss;
}

async function createProcessQueueBoss(config: RuntimeConfig): Promise<PgBoss> {
  getQueueEnvConfig(config);

  const { PgBoss } = await import("pg-boss");
  const boss = new PgBoss({
    connectionString: getDatabaseUrl(config),
  });

  await boss.start();
  return boss;
}

function mapPgBossOptions(options: QueueEnqueueOptions): SendOptions {
  return {
    retryLimit: options.maxAttempts,
    singletonKey: options.idempotencyKey,
    startAfter:
      options.delaySeconds === undefined
        ? undefined
        : new Date(Date.now() + options.delaySeconds * 1000),
  };
}

function getProcessQueueCacheKey(config: RuntimeConfig): string {
  const strategy = getQueueEnvConfig(config);
  return JSON.stringify({
    databaseUrl: getDatabaseUrl(config),
    queueName: strategy.name,
    provider: strategy.provider,
    runtime: strategy.runtime,
  });
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
