import { DEFAULT_ENVS } from "@shamt/app-env";
import { env } from "@/app/runtime/process/env";

export function requirePostgresUrl() {
  if (!env.APP_DATABASE_URL) {
    throw new Error(
      "APP_DATABASE_URL is required for PostgreSQL database tooling",
    );
  }

  return {
    url: env.APP_DATABASE_URL,
  };
}

export function requirePostgresSeedUrl() {
  requireSeedAllowed("PostgreSQL");

  return requirePostgresUrl().url;
}

export function requireD1SeedTarget() {
  requireSeedAllowed("D1");

  if (!env.APP_DATABASE_D1_BINDING) {
    throw new Error("APP_DATABASE_D1_BINDING is required for D1 seed");
  }

  return {
    binding: env.APP_DATABASE_D1_BINDING,
    remote: process.env.D1_SEED_LOCAL !== "true",
    wranglerEnv: process.env.D1_WRANGLER_ENV ?? env.APP_ENV,
  };
}

function requireSeedAllowed(target: string) {
  if (
    env.APP_ENV === DEFAULT_ENVS.PRODUCTION &&
    process.env.CONFIRM_PROD_SEED !== "true"
  ) {
    throw new Error(
      `Production ${target} seed requires CONFIRM_PROD_SEED=true`,
    );
  }
}
