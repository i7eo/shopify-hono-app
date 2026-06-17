import { DEFAULT_APP_BUCKET_PROVIDERS } from "@shamt/app-env";
import { sha256Hex } from "@shamt/utils";
import { internalServerError } from "@/shared/exceptions";
import type { RuntimeConfig } from "@/infra/env";

export type BucketProvider = NonNullable<RuntimeConfig["APP_BUCKET_PROVIDER"]>;
export type BucketRuntimeStrategy = {
  provider: BucketProvider;
  runtime: RuntimeConfig["APP_RUNTIME"];
};

export type BucketPutInput = {
  body: ReadableStream<Uint8Array>;
  contentType: string;
  expiresAt: Date;
  key: string;
  maxBytes: number;
  originalName: string;
  safeName: string;
  shopDomain: string;
};

export type BucketStoredObject = {
  byteSize: number;
  key: string;
  provider: BucketProvider;
};

export type BucketOpenInput = {
  key: string;
};

export type BucketReadableObject = {
  body: ReadableStream<Uint8Array>;
  byteSize: number;
};

export type BucketDeleteInput = {
  key: string;
};

export type BucketDownloadSignInput = {
  contentType: string;
  expiresInMilliseconds: number;
  key: string;
  originalName: string;
};

export interface Bucket {
  put: (input: BucketPutInput) => Promise<BucketStoredObject>;
  open: (input: BucketOpenInput) => Promise<BucketReadableObject>;
  delete: (input: BucketDeleteInput) => Promise<void>;
}

export interface BucketDownloadSigner {
  signDownloadUrl: (input: BucketDownloadSignInput) => Promise<string>;
}

/**
 * Returns the configured bucket strategy and rejects runtime/provider pairs
 * that cannot be executed by the current infrastructure.
 *
 * Example:
 * - node defaults to memory and may opt into r2.
 * - cloudflare defaults to r2 and rejects memory.
 */
export function getBucketEnvConfig(
  config: RuntimeConfig,
): BucketRuntimeStrategy {
  const strategy: BucketRuntimeStrategy = {
    provider: getBucketProvider(config),
    runtime: config.APP_RUNTIME,
  };

  if (
    strategy.runtime === "cloudflare" &&
    strategy.provider !== DEFAULT_APP_BUCKET_PROVIDERS.R2
  ) {
    throw internalServerError(
      "Cloudflare runtime only supports the r2 bucket provider",
      {
        details: strategy,
        expose: true,
      },
    );
  }

  if (
    strategy.runtime === "node" &&
    ![
      DEFAULT_APP_BUCKET_PROVIDERS.MEMORY,
      DEFAULT_APP_BUCKET_PROVIDERS.R2,
    ].includes(strategy.provider)
  ) {
    throw internalServerError("Node runtime does not support bucket provider", {
      details: strategy,
      expose: true,
    });
  }

  return strategy;
}

/**
 * Reads the required R2 S3-compatible config for runtimes that access R2
 * through the S3 API.
 *
 * Example: Node + r2 needs these credentials; Cloudflare + r2 uses a binding.
 */
export async function getR2BucketConfig(config: RuntimeConfig) {
  const missing = [
    ["APP_BUCKET_R2_URL", config.APP_BUCKET_R2_URL],
    ["APP_CLOUDFLARE_USER_TOKEN", config.APP_CLOUDFLARE_USER_TOKEN],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw internalServerError("R2 bucket config is incomplete", {
      details: {
        missing,
      },
      expose: true,
    });
  }
  const url = parseR2BucketUrl(config.APP_BUCKET_R2_URL!);
  const token = config.APP_CLOUDFLARE_USER_TOKEN!;
  const [accessKeyId, secretAccessKey] = await Promise.all([
    getCloudflareTokenId(token),
    sha256Hex(token),
  ]);

  return {
    region: "auto", // Required by AWS SDK, not used by R2
    // Provide your R2 endpoint: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
    endpoint: url.endpoint,
    bucketName: url.bucketName,
    accessKeyId,
    secretAccessKey,
  };
}

/**
 * https://developers.cloudflare.com/r2/api/tokens/#get-s3-api-credentials-from-an-api-token
 */
async function getCloudflareTokenId(token: string): Promise<string> {
  let response: Response;

  try {
    response = await fetch(
      "https://api.cloudflare.com/client/v4/user/tokens/verify",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
  } catch (error) {
    throw internalServerError("Failed to verify Cloudflare API token", {
      details: {
        cause: error,
      },
    });
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch (error) {
    throw internalServerError("Failed to parse Cloudflare token response", {
      details: {
        cause: error,
        status: response.status,
      },
    });
  }

  if (!response.ok || !isCloudflareTokenVerifyResponse(body)) {
    throw internalServerError("Cloudflare API token verification failed", {
      details: {
        body,
        status: response.status,
      },
      expose: true,
    });
  }

  return body.result.id;
}

function isCloudflareTokenVerifyResponse(
  value: unknown,
): value is { result: { id: string } } {
  return (
    value !== null &&
    typeof value === "object" &&
    "result" in value &&
    value.result !== null &&
    typeof value.result === "object" &&
    "id" in value.result &&
    typeof value.result.id === "string" &&
    value.result.id.length > 0
  );
}

/**
 * Parses APP_BUCKET_R2_URL as an S3 endpoint URL with the bucket in the path.
 *
 * Example: https://account-id.r2.cloudflarestorage.com/my-bucket
 */
function parseR2BucketUrl(value: string): {
  bucketName: string;
  endpoint: string;
} {
  try {
    const url = new URL(value);
    const bucketName = url.pathname.split("/").find(Boolean) ?? "bucket";

    if (!bucketName) {
      throw new Error("missing bucket path");
    }

    url.pathname = "";
    url.search = "";
    url.hash = "";

    return {
      bucketName,
      endpoint: url.toString().replace(/\/$/, ""),
    };
  } catch (error) {
    throw internalServerError(
      "APP_BUCKET_R2_URL must be a valid R2 S3 endpoint URL with bucket path",
      {
        details: {
          cause: error,
        },
        expose: true,
      },
    );
  }
}

/**
 * Reads APP_BUCKET_PROVIDER with runtime-aware defaults for older env files.
 */
function getBucketProvider(config: RuntimeConfig): BucketProvider {
  if (config.APP_BUCKET_PROVIDER) return config.APP_BUCKET_PROVIDER;

  return config.APP_RUNTIME === "cloudflare"
    ? DEFAULT_APP_BUCKET_PROVIDERS.R2
    : DEFAULT_APP_BUCKET_PROVIDERS.MEMORY;
}
