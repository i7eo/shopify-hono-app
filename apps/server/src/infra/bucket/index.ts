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
 * Creates the runtime-specific bucket implementation.
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
