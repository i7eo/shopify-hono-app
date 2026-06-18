import { DEFAULT_APP_BUCKET_PROVIDERS } from "@shamt/app-env";
import { internalServerError, payloadTooLargeError } from "@/shared/exceptions";
import {
  getBucketEnvConfig,
  type Bucket,
  type BucketDeleteInput,
  type BucketOpenInput,
  type BucketPutInput,
  type BucketReadableObject,
  type BucketStoredObject,
} from "./shared";
import type { RuntimeConfig } from "@/infra/env";

export type IsolateBucketOptions = {
  r2?: R2Bucket;
};

/**
 * Creates the isolate bucket implementation for the configured provider.
 *
 * Example: Cloudflare + r2 uses the request-bound R2 binding instead of the
 * S3-compatible API to avoid an extra network hop inside Workers.
 */
export function createIsolateBucket(
  config: RuntimeConfig,
  options: IsolateBucketOptions = {},
): Bucket {
  const strategy = getBucketEnvConfig(config);

  if (strategy.provider === DEFAULT_APP_BUCKET_PROVIDERS.R2) {
    return new CloudflareR2Bucket(requireR2Bucket(options.r2));
  }

  throw internalServerError("Isolate runtime does not support memory bucket", {
    details: strategy,
    expose: true,
  });
}

/**
 * Reserved disposer for isolate bucket resources.
 * Current Cloudflare R2 adapters are request-bound.
 */
export function disposeIsolateBucket() {
  return Promise.resolve();
}

/**
 * Stores bucket objects through a Cloudflare R2 binding in isolate runtimes.
 */
export class CloudflareR2Bucket implements Bucket {
  constructor(private readonly bucket: R2Bucket) {}

  async put(input: BucketPutInput): Promise<BucketStoredObject> {
    const body = createLimitedWebUploadBody(input.body, input.maxBytes);

    await this.bucket.put(input.key, body.value, {
      customMetadata: {
        expiresAt: input.expiresAt.toISOString(),
        originalName: input.originalName,
        safeName: input.safeName,
        shopDomain: input.shopDomain,
      },
      httpMetadata: {
        contentType: input.contentType,
      },
    });

    return {
      byteSize: body.getByteLength(),
      key: input.key,
      provider: DEFAULT_APP_BUCKET_PROVIDERS.R2,
    };
  }

  async open(input: BucketOpenInput): Promise<BucketReadableObject> {
    const object = await this.bucket.get(input.key);

    if (!object) {
      throw internalServerError("Failed to open R2 bucket object", {
        details: {
          key: input.key,
        },
      });
    }

    return {
      body: object.body,
      byteSize: object.size,
    };
  }

  async delete(input: BucketDeleteInput): Promise<void> {
    await this.bucket.delete(input.key);
  }
}

/**
 * Requires the request-bound R2 binding before creating the isolate adapter.
 */
function requireR2Bucket(bucket: R2Bucket | undefined): R2Bucket {
  if (!bucket) {
    throw internalServerError("Cloudflare R2 bucket binding is required", {
      expose: true,
    });
  }

  return bucket;
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
