import { DEFAULT_APP_BUCKET_PROVIDERS } from "@shamt/app-env";
import { internalServerError, payloadTooLargeError } from "@/shared/exceptions";
import { S3CompatibleBucket } from "./s3-compatible";
import { getBucketEnvConfig, getR2BucketConfig, type Bucket } from "./shared";
import type { RuntimeConfig } from "@/infra/env";

/**
 * Creates the isolate bucket implementation for the configured provider.
 */
export function createIsolateBucket(config: RuntimeConfig): Bucket {
  const strategy = getBucketEnvConfig(config);

  if (strategy.provider === DEFAULT_APP_BUCKET_PROVIDERS.R2) {
    return new S3CompatibleBucket(
      getR2BucketConfig(config),
      createLimitedWebUploadBody,
    );
  }

  throw internalServerError(
    "Isolate runtime does not support bucket provider",
    {
      details: strategy,
      expose: true,
    },
  );
}

/**
 * Passes a Web stream through a byte-counting TransformStream for isolates.
 */
function createLimitedWebUploadBody(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
): {
  getByteLength: () => number;
  value: ReadableStream<Uint8Array>;
} {
  let byteLength = 0;

  return {
    getByteLength: () => byteLength,
    value: stream.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          byteLength += chunk.byteLength;

          if (byteLength > maxBytes) {
            throw payloadTooLargeError("Upload request body overflow maxsize", {
              details: {
                maxSize: maxBytes,
              },
            });
          }

          controller.enqueue(chunk);
        },
      }),
    ),
  };
}
