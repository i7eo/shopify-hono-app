import { DEFAULT_APP_BUCKET_PROVIDERS } from "@shamt/app-env";
import { internalServerError } from "@/shared/exceptions";
import type {
  Bucket,
  BucketDeleteInput,
  BucketDownloadSigner,
  BucketDownloadSignInput,
  BucketOpenInput,
  BucketPutInput,
  BucketReadableObject,
  BucketStoredObject,
} from "./shared";

export type S3CompatibleBucketConfig = {
  accessKeyId: string;
  bucketName: string;
  endpoint: string;
  secretAccessKey: string;
};

export type S3CompatibleUploadBody = {
  getByteLength: () => number;
  value: unknown;
};

export type CreateS3CompatibleUploadBody = (
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
) => Promise<S3CompatibleUploadBody> | S3CompatibleUploadBody;

/**
 * Stores bucket objects through the S3-compatible API used by Cloudflare R2.
 */
export class S3CompatibleBucket implements Bucket {
  private clientPromise:
    | Promise<import("@aws-sdk/client-s3").S3Client>
    | undefined;

  constructor(
    private readonly config: S3CompatibleBucketConfig,
    private readonly createUploadBody: CreateS3CompatibleUploadBody,
  ) {}

  async put(input: BucketPutInput): Promise<BucketStoredObject> {
    const [{ PutObjectCommand }, body] = await Promise.all([
      import("@aws-sdk/client-s3"),
      this.createUploadBody(input.body, input.maxBytes),
    ]);
    const client = await this.getClient();

    await client.send(
      new PutObjectCommand({
        Body: body.value as never,
        Bucket: this.config.bucketName,
        ContentType: input.contentType,
        Key: input.key,
      }),
    );

    return {
      byteSize: body.getByteLength(),
      key: input.key,
      provider: DEFAULT_APP_BUCKET_PROVIDERS.R2,
    };
  }

  async open(input: BucketOpenInput): Promise<BucketReadableObject> {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.getClient();
    const object = await client.send(
      new GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: input.key,
      }),
    );

    if (!object.Body) {
      throw internalServerError("Failed to open R2 bucket object", {
        details: {
          key: input.key,
        },
      });
    }

    return {
      body: toWebReadableStream(object.Body),
      byteSize: Number(object.ContentLength ?? 0),
    };
  }

  async delete(input: BucketDeleteInput): Promise<void> {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.getClient();
    await client.send(
      new DeleteObjectCommand({
        Bucket: this.config.bucketName,
        Key: input.key,
      }),
    );
  }

  private getClient() {
    this.clientPromise ??= createS3CompatibleClient(this.config);
    return this.clientPromise;
  }
}

/**
 * Creates short-lived S3-compatible download URLs for R2 objects.
 */
export class S3CompatibleBucketDownloadSigner implements BucketDownloadSigner {
  private clientPromise:
    | Promise<import("@aws-sdk/client-s3").S3Client>
    | undefined;

  constructor(private readonly config: S3CompatibleBucketConfig) {}

  async signDownloadUrl(input: BucketDownloadSignInput): Promise<string> {
    const [{ GetObjectCommand }, { getSignedUrl }] = await Promise.all([
      import("@aws-sdk/client-s3"),
      import("@aws-sdk/s3-request-presigner"),
    ]);
    const client = await this.getClient();

    return getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: input.key,
        ResponseContentDisposition: getAttachmentDisposition(
          input.originalName,
        ),
        ResponseContentType: input.contentType,
      }),
      {
        expiresIn: Math.ceil(input.expiresInMilliseconds / 1000),
      },
    );
  }

  private getClient() {
    this.clientPromise ??= createS3CompatibleClient(this.config);
    return this.clientPromise;
  }
}

/**
 * Creates an AWS SDK S3 client configured for Cloudflare R2 compatibility.
 */
async function createS3CompatibleClient(config: S3CompatibleBucketConfig) {
  const { S3Client } = await import("@aws-sdk/client-s3");

  return new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: config.endpoint,
    forcePathStyle: true,
    region: "auto",
  });
}

/**
 * Normalizes AWS SDK response bodies into Web streams for Hono responses.
 */
function toWebReadableStream(body: unknown): ReadableStream<Uint8Array> {
  if (body instanceof ReadableStream) return body;

  if (
    body &&
    typeof body === "object" &&
    "transformToWebStream" in body &&
    typeof body.transformToWebStream === "function"
  ) {
    return body.transformToWebStream() as ReadableStream<Uint8Array>;
  }

  throw internalServerError("Unsupported R2 response body type");
}

/**
 * Builds an RFC 5987 attachment disposition for signed download responses.
 */
function getAttachmentDisposition(filename: string): string {
  return `attachment; filename*=UTF-8''${encodeRFC5987Value(filename)}`;
}

function encodeRFC5987Value(value: string): string {
  return encodeURIComponent(value).replaceAll(/['()*]/g, (char) => {
    const codePoint = char.codePointAt(0);
    return codePoint === undefined
      ? ""
      : `%${codePoint.toString(16).toUpperCase()}`;
  });
}
