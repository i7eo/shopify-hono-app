import {
  DEFAULT_APP_DATABASE_PROVIDERS,
  DEFAULT_APP_SCHEDULER_PROVIDERS,
} from "@shamt/app-env";
import { internalServerError } from "@/shared/exceptions";
import type { RuntimeConfig } from "@/infra/env";

export type SchedulerProvider = NonNullable<
  RuntimeConfig["APP_SCHEDULER_PROVIDER"]
>;

export type SchedulerRuntimeStrategy = {
  provider: SchedulerProvider;
  runtime: RuntimeConfig["APP_RUNTIME"];
};

/**
 * Returns the configured scheduler strategy and rejects runtime/provider pairs
 * that cannot be executed by the current infrastructure.
 *
 * Supported matrix:
 * - node + pg-boss
 * - cloudflare + cron-triggers
 */
export function getSchedulerEnvConfig(
  config: RuntimeConfig,
): SchedulerRuntimeStrategy {
  const strategy: SchedulerRuntimeStrategy = {
    provider: getSchedulerProvider(config),
    runtime: config.APP_RUNTIME,
  };

  if (
    strategy.runtime === "node" &&
    strategy.provider !== DEFAULT_APP_SCHEDULER_PROVIDERS.PGBOSS
  ) {
    throw internalServerError(
      "Node runtime only supports the pg-boss scheduler provider",
      {
        details: strategy,
        expose: true,
      },
    );
  }

  if (
    strategy.runtime === "node" &&
    config.APP_DATABASE_PROVIDER !== DEFAULT_APP_DATABASE_PROVIDERS.POSTGRES
  ) {
    throw internalServerError(
      "Node pg-boss scheduler requires the postgres database provider",
      {
        details: {
          databaseProvider: config.APP_DATABASE_PROVIDER,
          ...strategy,
        },
        expose: true,
      },
    );
  }

  if (
    strategy.runtime === "cloudflare" &&
    strategy.provider !== DEFAULT_APP_SCHEDULER_PROVIDERS.CRONTRIGGERS
  ) {
    throw internalServerError(
      "Cloudflare runtime only supports the cron-triggers scheduler provider",
      {
        details: strategy,
        expose: true,
      },
    );
  }

  if (strategy.runtime !== "node" && strategy.runtime !== "cloudflare") {
    throw internalServerError("Runtime does not support scheduler providers", {
      details: strategy,
      expose: true,
    });
  }

  return strategy;
}

function getSchedulerProvider(config: RuntimeConfig): SchedulerProvider {
  if (config.APP_SCHEDULER_PROVIDER) return config.APP_SCHEDULER_PROVIDER;

  return config.APP_RUNTIME === "cloudflare"
    ? DEFAULT_APP_SCHEDULER_PROVIDERS.CRONTRIGGERS
    : DEFAULT_APP_SCHEDULER_PROVIDERS.PGBOSS;
}
