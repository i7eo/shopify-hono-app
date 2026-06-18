import {
  DEFAULT_APP_BUCKET_PROVIDERS,
  DEFAULT_APP_DATABASE_PROVIDERS,
  DEFAULT_APP_QUEUE_PROVIDERS,
  DEFAULT_APP_SCHEDULER_PROVIDERS,
  DEFAULT_RUNTIMES,
} from "@shamt/app-env";
import { throwError } from "../utils";
import type { WranglerFileConfig } from "./constants";

interface WranglerConfig {
  main: string;
  compatibility_date: string;
  compatibility_flags: string[];
  observability: {
    enabled: boolean;
  };
  env: Record<string, WranglerEnvironmentConfig>;
}

interface WranglerEnvironmentConfig {
  name: string;
  r2_buckets?: R2BucketBinding[];
  d1_databases?: D1DatabaseBinding[];
  hyperdrive?: HyperdriveBinding[];
  queues?: QueueConfig;
  triggers?: TriggerConfig;
}

interface R2BucketBinding {
  binding: string;
  bucket_name: string;
}

interface D1DatabaseBinding {
  binding: string;
  database_name: string;
  database_id: string;
  migrations_dir: string;
}

interface HyperdriveBinding {
  binding: string;
  id: string;
  localConnectionString?: string;
}

interface QueueConfig {
  producers: QueueProducerBinding[];
  consumers: QueueConsumerBinding[];
}

interface QueueProducerBinding {
  binding: string;
  queue: string;
}

interface QueueConsumerBinding {
  dead_letter_queue: string;
  max_batch_size: number;
  max_retries: number;
  queue: string;
}

interface TriggerConfig {
  crons: string[];
}

/**
 * Render a Wrangler config for the active APP_ENV only.
 */
export function renderWranglerConfig(
  config: WranglerFileConfig,
): WranglerConfig {
  const envName = config.APP_ENV;
  const environment = renderWranglerEnvironment(config);

  return {
    main: "src/app/runtime/isolate/cloudflare/index.ts",
    compatibility_date: "2026-06-05",
    compatibility_flags: ["nodejs_compat"],
    observability: {
      enabled: true,
    },
    env: {
      [envName]: environment,
    },
  };
}

function renderWranglerEnvironment(
  config: WranglerFileConfig,
): WranglerEnvironmentConfig {
  const appName = config.APP_CLOUDFLARE_WORKER_NAME;
  const bucketProvider = getBucketProvider(config);
  const databaseProvider = getDatabaseProvider(config);
  const queueProvider = getQueueProvider(config);
  const schedulerProvider = getSchedulerProvider(config);
  const environment: WranglerEnvironmentConfig = {
    name: appName,
  };

  if (bucketProvider === DEFAULT_APP_BUCKET_PROVIDERS.R2) {
    environment.r2_buckets = [getR2BucketBinding(config)];
  }

  if (
    config.APP_RUNTIME === DEFAULT_RUNTIMES.CLOUDFLARE &&
    databaseProvider === DEFAULT_APP_DATABASE_PROVIDERS.D1
  ) {
    environment.d1_databases = [getD1DatabaseBinding(config)];
  }

  if (
    config.APP_RUNTIME === DEFAULT_RUNTIMES.CLOUDFLARE &&
    databaseProvider === DEFAULT_APP_DATABASE_PROVIDERS.POSTGRES
  ) {
    environment.hyperdrive = [getHyperdriveBinding(config)];
  }

  if (config.APP_RUNTIME === DEFAULT_RUNTIMES.CLOUDFLARE) {
    if (queueProvider === DEFAULT_APP_QUEUE_PROVIDERS.QUEUES) {
      environment.queues = getQueueConfig(config);
    }

    if (schedulerProvider === DEFAULT_APP_SCHEDULER_PROVIDERS.CRONTRIGGERS) {
      environment.triggers = getTriggerConfig(config);
    }
  }

  validateQueueProvider(config, queueProvider);
  validateSchedulerProvider(config, schedulerProvider);

  return environment;
}

function getBucketProvider(config: WranglerFileConfig) {
  if (config.APP_BUCKET_PROVIDER) return config.APP_BUCKET_PROVIDER;

  return config.APP_RUNTIME === DEFAULT_RUNTIMES.CLOUDFLARE
    ? DEFAULT_APP_BUCKET_PROVIDERS.R2
    : DEFAULT_APP_BUCKET_PROVIDERS.MEMORY;
}

function getDatabaseProvider(config: WranglerFileConfig) {
  return (
    config.APP_DATABASE_PROVIDER ?? DEFAULT_APP_DATABASE_PROVIDERS.POSTGRES
  );
}

function getQueueProvider(config: WranglerFileConfig) {
  if (config.APP_QUEUE_PROVIDER) return config.APP_QUEUE_PROVIDER;

  return config.APP_RUNTIME === DEFAULT_RUNTIMES.CLOUDFLARE
    ? DEFAULT_APP_QUEUE_PROVIDERS.QUEUES
    : DEFAULT_APP_QUEUE_PROVIDERS.PGBOSS;
}

function getSchedulerProvider(config: WranglerFileConfig) {
  if (config.APP_SCHEDULER_PROVIDER) return config.APP_SCHEDULER_PROVIDER;

  return config.APP_RUNTIME === DEFAULT_RUNTIMES.CLOUDFLARE
    ? DEFAULT_APP_SCHEDULER_PROVIDERS.CRONTRIGGERS
    : DEFAULT_APP_SCHEDULER_PROVIDERS.PGBOSS;
}

function getR2BucketBinding(config: WranglerFileConfig): R2BucketBinding {
  return {
    binding: requireConfigValue(
      config.APP_BUCKET_R2_BINDING,
      "APP_BUCKET_R2_BINDING",
    ),
    bucket_name: requireConfigValue(
      config.APP_BUCKET_R2_NAME,
      "APP_BUCKET_R2_NAME",
    ),
  };
}

function getD1DatabaseBinding(config: WranglerFileConfig): D1DatabaseBinding {
  return {
    binding: requireConfigValue(
      config.APP_DATABASE_D1_BINDING,
      "APP_DATABASE_D1_BINDING",
    ),
    database_name: requireConfigValue(
      config.APP_DATABASE_D1_NAME,
      "APP_DATABASE_D1_NAME",
    ),
    database_id: requireConfigValue(
      config.APP_DATABASE_D1_ID,
      "APP_DATABASE_D1_ID",
    ),
    migrations_dir: "drizzle.d1",
  };
}

function getHyperdriveBinding(config: WranglerFileConfig): HyperdriveBinding {
  return {
    binding: requireConfigValue(
      config.APP_HYPERDRIVER_BINDING,
      "APP_HYPERDRIVER_BINDING",
    ),
    id: requireConfigValue(config.APP_HYPERDRIVER_ID, "APP_HYPERDRIVER_ID"),
  };
}

function getQueueConfig(config: WranglerFileConfig): QueueConfig {
  const queue = requireConfigValue(config.APP_QUEUE_NAME, "APP_QUEUE_NAME");

  return {
    producers: [
      {
        binding: requireConfigValue(
          config.APP_QUEUE_BINDING,
          "APP_QUEUE_BINDING",
        ),
        queue,
      },
    ],
    consumers: [
      {
        dead_letter_queue: `${queue}-dlq`,
        max_batch_size: config.APP_QUEUE_CONSUMER_MAX_BATCH_SIZE,
        max_retries: config.APP_QUEUE_CONSUMER_MAX_RETRIES,
        queue,
      },
    ],
  };
}

function getTriggerConfig(config: WranglerFileConfig): TriggerConfig {
  return {
    crons: [
      requireConfigValue(
        config.APP_SCHEDULER_CRON_VALUE,
        "APP_SCHEDULER_CRON_VALUE",
      ),
    ],
  };
}

function validateQueueProvider(
  config: WranglerFileConfig,
  queueProvider: WranglerFileConfig["APP_QUEUE_PROVIDER"],
) {
  if (
    config.APP_RUNTIME === DEFAULT_RUNTIMES.NODE &&
    queueProvider !== DEFAULT_APP_QUEUE_PROVIDERS.PGBOSS
  ) {
    throwError(
      "write-wrangler-file",
      "Node runtime only supports pg-boss queue",
    );
  }

  if (
    config.APP_RUNTIME === DEFAULT_RUNTIMES.CLOUDFLARE &&
    queueProvider !== DEFAULT_APP_QUEUE_PROVIDERS.QUEUES
  ) {
    throwError(
      "write-wrangler-file",
      "Cloudflare runtime only supports queues queue",
    );
  }
}

function validateSchedulerProvider(
  config: WranglerFileConfig,
  schedulerProvider: WranglerFileConfig["APP_SCHEDULER_PROVIDER"],
) {
  if (
    config.APP_RUNTIME === DEFAULT_RUNTIMES.NODE &&
    schedulerProvider !== DEFAULT_APP_SCHEDULER_PROVIDERS.PGBOSS
  ) {
    throwError(
      "write-wrangler-file",
      "Node runtime only supports pg-boss scheduler",
    );
  }

  if (
    config.APP_RUNTIME === DEFAULT_RUNTIMES.CLOUDFLARE &&
    schedulerProvider !== DEFAULT_APP_SCHEDULER_PROVIDERS.CRONTRIGGERS
  ) {
    throwError(
      "write-wrangler-file",
      "Cloudflare runtime only supports cron-triggers scheduler",
    );
  }
}

function requireConfigValue(value: string | undefined, key: string) {
  if (value) return value;

  throwError("write-wrangler-file", `${key} is required`);
}
