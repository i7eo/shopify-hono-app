import {
  getRuntimeCapability,
  type RuntimeCapabilityInstances,
  type RuntimeCapabilityName,
} from "@/app/runtime/capabilities";
import { getBucketRuntimeStrategy, type Bucket } from "@/infra/bucket";
import {
  badRequestError,
  goneError,
  internalServerError,
  notFoundError,
} from "@/shared/exceptions";
import {
  toPublicFile,
  type FileDownload,
  type FileRecord,
  type FilesStore,
  type PublicFile,
} from "./domain/files";
import type {
  FileMultipartUploadParser,
  ParsedFileUpload,
} from "./upload/file-multipart-upload-parser";
import type { RuntimeConfig } from "@/infra/env";
import type { AppEnv } from "@/typings";
import type { Context } from "hono";

const DEFAULT_LIST_LIMIT = 20;
const LAST_C0_CONTROL_CODE_POINT = 31;
const DELETE_CONTROL_CODE_POINT = 127;

export type CreateFileInput = {
  batchId?: string;
  body: ReadableStream<Uint8Array> | null;
  contentType?: string;
  originalName?: string;
  runtimeEnv: RuntimeConfig;
  shopDomain: string;
};

export type CreateFilesInput = {
  files: ParsedFileUpload[];
  runtimeEnv: RuntimeConfig;
  shopDomain: string;
};

export type ListFilesInput = {
  cursor?: string;
  limit?: number;
  shopDomain: string;
};

export async function createFile(
  c: Context<AppEnv>,
  input: CreateFileInput,
): Promise<PublicFile> {
  if (!input.body) throw badRequestError("File body is required");

  const originalName = normalizeOriginalName(input.originalName);
  const safeName = sanitizeFilename(originalName);
  const contentType = normalizeContentType(input.contentType);
  const now = new Date();
  const id = crypto.randomUUID();
  const bucketDirId = input.batchId ?? id;
  const expiresAt = new Date(now.getTime() + input.runtimeEnv.APP_FILE_EXPIRE);
  const bucketKey = createBucketKey({
    id: bucketDirId,
    safeName,
    shopDomain: input.shopDomain,
    now,
  });
  const bucketProvider = getBucketRuntimeStrategy(input.runtimeEnv).provider;
  const store = getFilesStore(c);
  const bucket = await getFileBucket(c);

  const initialFile: FileRecord = {
    id,
    shopDomain: input.shopDomain,
    originalName,
    safeName,
    contentType,
    byteSize: 0,
    bucketProvider,
    bucketKey,
    status: "uploading",
    expiresAt,
    createdAt: now,
    updatedAt: now,
  };

  await store.create(initialFile);

  try {
    const stored = await bucket.put({
      body: input.body,
      contentType,
      expiresAt,
      key: bucketKey,
      maxBytes: input.runtimeEnv.APP_FILE_MAX_SIZE,
      originalName,
      safeName,
      shopDomain: input.shopDomain,
    });
    const file: FileRecord = {
      ...initialFile,
      byteSize: stored.byteSize,
      bucketProvider: stored.provider,
      bucketKey: stored.key,
      status: "available",
      updatedAt: new Date(),
    };

    await store.create(file);
    return toPublicFile(file);
  } catch (error) {
    await store.updateStatus({
      id,
      shopDomain: input.shopDomain,
      status: "failed",
    });
    throw error;
  }
}

export async function createFiles(
  c: Context<AppEnv>,
  input: CreateFilesInput,
): Promise<{ files: PublicFile[] }> {
  if (input.files.length === 0) {
    throw badRequestError("At least one file is required");
  }

  const files: PublicFile[] = [];
  const batchId = crypto.randomUUID();

  for (const file of input.files) {
    files.push(
      await createFile(c, {
        batchId,
        body: file.body,
        contentType: file.contentType,
        originalName: file.originalName,
        runtimeEnv: input.runtimeEnv,
        shopDomain: input.shopDomain,
      }),
    );
  }

  return { files };
}

export async function listFiles(
  c: Context<AppEnv>,
  input: ListFilesInput,
): Promise<{ files: PublicFile[]; nextCursor?: string }> {
  const page = await getFilesStore(c).list({
    cursor: input.cursor,
    limit: input.limit ?? DEFAULT_LIST_LIMIT,
    shopDomain: input.shopDomain,
  });

  return {
    files: page.files.map(toPublicFile),
    nextCursor: page.nextCursor,
  };
}

export async function getFile(
  c: Context<AppEnv>,
  shopDomain: string,
  id: string,
): Promise<PublicFile> {
  const file = await getAvailableFile(c, shopDomain, id);
  return toPublicFile(file);
}

export async function downloadFile(
  c: Context<AppEnv>,
  shopDomain: string,
  id: string,
): Promise<FileDownload> {
  const file = await getAvailableFile(c, shopDomain, id);
  return (await getFileDownloadResolver(c)).resolve({ file });
}

export async function deleteFile(
  c: Context<AppEnv>,
  shopDomain: string,
  id: string,
): Promise<void> {
  const store = getFilesStore(c);
  const file = await store.findById({ id, shopDomain });
  if (!file || file.deletedAt || file.status === "deleted") {
    throw notFoundError("File not found");
  }

  await (await getFileBucket(c)).delete({ key: file.bucketKey });
  await store.delete({ id, shopDomain });
}

async function getAvailableFile(
  c: Context<AppEnv>,
  shopDomain: string,
  id: string,
): Promise<FileRecord> {
  const store = getFilesStore(c);
  const file = await store.findById({ id, shopDomain });

  if (!file || file.deletedAt || file.status === "deleted") {
    throw notFoundError("File not found");
  }

  if (file.status !== "available") {
    throw notFoundError("File not found");
  }

  if (file.expiresAt.getTime() <= Date.now()) {
    await store.updateStatus({ id, shopDomain, status: "expired" });
    throw goneError("File expired");
  }

  return file;
}

function getFilesStore(c: Context<AppEnv>): FilesStore {
  return getFactory("moduleFileFilesStoreFactory")(c);
}

function getFileBucket(c: Context<AppEnv>): Bucket | Promise<Bucket> {
  return getFactory("moduleFileBucketFactory")(c);
}

function getFileDownloadResolver(c: Context<AppEnv>) {
  return getFactory("moduleFileDownloadResolverFactory")(c);
}

export function getFileMultipartUploadParser(
  c: Context<AppEnv>,
): FileMultipartUploadParser {
  return getFactory("moduleFileMultipartUploadParserFactory")(c);
}

/**
 * Resolves a required runtime capability and fails loudly when it is missing.
 */
function getFactory<K extends RuntimeCapabilityName>(
  name: K,
): RuntimeCapabilityInstances[K] {
  const factory = getRuntimeCapability(name);
  if (!factory) {
    throw internalServerError(`Runtime capability is not registered: ${name}`, {
      expose: true,
    });
  }

  return factory;
}

function normalizeOriginalName(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) throw badRequestError("X-File-Name header is required");
  if (trimmed.length > 255) throw badRequestError("Filename is too long");
  return trimmed;
}

function normalizeContentType(value: string | undefined): string {
  const contentType = value?.split(";", 1)[0]?.trim().toLowerCase();
  if (!contentType) throw badRequestError("Content-Type header is required");
  return contentType;
}

export function sanitizeFilename(value: string): string {
  const sanitized = value
    .normalize("NFKC")
    .replaceAll(/[\\/]/g, "-")
    .split("")
    .filter((character) => {
      const codePoint = character.codePointAt(0);
      return (
        codePoint !== undefined &&
        codePoint > LAST_C0_CONTROL_CODE_POINT &&
        codePoint !== DELETE_CONTROL_CODE_POINT
      );
    })
    .join("")
    .replaceAll(/\s+/g, " ")
    .trim()
    .replace(/^\.+$/, "");

  return stripTrailingTimestamp(sanitized).slice(0, 255) || "file";
}

function stripTrailingTimestamp(value: string): string {
  const extensionIndex = value.lastIndexOf(".");
  const hasExtension = extensionIndex > 0 && extensionIndex < value.length - 1;
  const stem = hasExtension ? value.slice(0, extensionIndex) : value;
  const extension = hasExtension ? value.slice(extensionIndex) : "";
  const normalizedStem = stem
    .replace(/[-_ ]\d{4}[-_]?\d{2}[-_]?\d{2}[-_]?\d{6}$/u, "")
    .trim();

  return `${normalizedStem || stem}${extension}`;
}

function createBucketKey(input: {
  id: string;
  now: Date;
  safeName: string;
  shopDomain: string;
}): string {
  const year = String(input.now.getUTCFullYear());
  const month = String(input.now.getUTCMonth() + 1).padStart(2, "0");
  const safeShopDomain = input.shopDomain.replaceAll(/[^a-z0-9.-]/gi, "-");

  return `${safeShopDomain}/${year}/${month}/${input.id}/${input.safeName}`;
}
