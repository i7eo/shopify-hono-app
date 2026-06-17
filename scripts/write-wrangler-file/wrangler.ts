import {
  DEFAULT_APP_BUCKET_PROVIDERS,
  DEFAULT_APP_DATABASE_PROVIDERS,
  DEFAULT_RUNTIMES,
} from "@shamt/app-env";
import { throwError } from "../utils";
import { getCloudflareAppName, type WranglerFileConfig } from "./constants";

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
  const appName = getCloudflareAppName(config.APP_ENV);
  const bucketProvider = getBucketProvider(config);
  const databaseProvider = getDatabaseProvider(config);
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

function requireConfigValue(value: string | undefined, key: string) {
  if (value) return value;

  throwError("write-wrangler-file", `${key} is required`);
}
