import { isIsolateRuntime } from "@/utils";
import type { Bucket } from "./shared";
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
