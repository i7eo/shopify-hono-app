import { DEFAULT_APP_BUCKET_PROVIDERS } from "@shamt/app-env";
import { isIsolateRuntime } from "@/utils";
import {
  getBucketEnvConfig,
  getR2BucketConfig,
  type Bucket,
  type BucketDownloadSigner,
} from "./shared";
import type { RuntimeConfig } from "@/infra/env";

export * from "./shared";

const ISOLATE_BUCKET_MODULE = "./isolate";
const PROCESS_BUCKET_MODULE = "./process";

/**
 * Creates the runtime-specific bucket implementation through a dynamic import.
 *
 * Example:
 * - node + memory -> process disk-backed memory bucket
 * - node/cloudflare + r2 -> shared S3-compatible bucket
 */
export async function createBucket(config: RuntimeConfig): Promise<Bucket> {
  if (isIsolateRuntime(config.APP_RUNTIME)) {
    const { createIsolateBucket } = await import(ISOLATE_BUCKET_MODULE);
    return createIsolateBucket(config);
  }

  const { getProcessBucket } = await import(PROCESS_BUCKET_MODULE);
  return getProcessBucket(config);
}

/**
 * Disposes cached runtime bucket adapters when the implementation keeps any.
 * Isolate buckets are request-bound today, so their disposer is a no-op.
 */
export async function disposeBucket(
  config: Pick<RuntimeConfig, "APP_RUNTIME">,
): Promise<void> {
  if (isIsolateRuntime(config.APP_RUNTIME)) return;

  const { disposeProcessBucket } = await import(PROCESS_BUCKET_MODULE);
  disposeProcessBucket();
}

/**
 * Creates the configured bucket download signer when the provider supports
 * signed download URLs.
 */
export async function createBucketDownloadSigner(
  config: RuntimeConfig,
): Promise<BucketDownloadSigner | undefined> {
  const strategy = getBucketEnvConfig(config);

  if (strategy.provider !== DEFAULT_APP_BUCKET_PROVIDERS.R2) {
    return undefined;
  }

  const { S3CompatibleBucketDownloadSigner } = await import("./s3-compatible");

  return new S3CompatibleBucketDownloadSigner(getR2BucketConfig(config));
}
