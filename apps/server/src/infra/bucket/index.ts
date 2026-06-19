import { DEFAULT_APP_BUCKET_PROVIDERS } from "@shamt/app-env";
import { isIsolateRuntime } from "@/utils";
import {
  getBucketEnvConfig,
  getR2BucketConfig,
  type Bucket,
  type BucketDownloadSigner,
} from "./shared";
import type { IsolateBucketOptions } from "./isolate";
import type { RuntimeConfig } from "@/infra/env";

export {
  getBucketEnvConfig,
  getR2BucketConfig,
  type Bucket,
  type BucketDownloadSigner,
  type BucketReadableObject,
  type BucketStoredObject,
} from "./shared";

const ISOLATE_BUCKET_MODULE = "./isolate";
const PROCESS_BUCKET_MODULE = "./process";

/**
 * Creates the runtime-specific bucket implementation through a dynamic import.
 *
 * Example:
 * - node + memory -> process disk-backed memory bucket
 * - node + r2 -> S3-compatible bucket
 * - cloudflare + r2 -> request-bound R2 binding bucket
 * - cloudflare + memory -> not support
 */
export async function createBucket(
  config: RuntimeConfig,
  isolateOptions?: IsolateBucketOptions,
): Promise<Bucket> {
  if (isIsolateRuntime(config.APP_RUNTIME)) {
    const { createIsolateBucket } = await import(ISOLATE_BUCKET_MODULE);
    return createIsolateBucket(config, isolateOptions);
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
  if (isIsolateRuntime(config.APP_RUNTIME)) {
    const { disposeIsolateBucket } = await import(ISOLATE_BUCKET_MODULE);
    await disposeIsolateBucket();
    return;
  }

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

  const { R2SignedUrlDownloadSigner } = await import("./r2-signed-url");

  return new R2SignedUrlDownloadSigner(await getR2BucketConfig(config));
}
