import { badRequestError } from "@/shared/exceptions";
import type { FileRecord, PublicFile } from "./types";

/**
 * Converts the internal database row into the public API file shape.
 */
export function toPublicFile(file: FileRecord): PublicFile {
  return {
    bucketKey: file.bucketKey,
    bucketProvider: file.bucketProvider,
    byteSize: file.byteSize,
    contentType: file.contentType,
    createdAt: file.createdAt.toISOString(),
    deletedAt: file.deletedAt?.toISOString() ?? null,
    expiresAt: file.expiresAt.toISOString(),
    id: file.id,
    originalName: file.originalName,
    safeName: file.safeName,
    shopDomain: file.shopDomain,
    status: file.status,
    updatedAt: file.updatedAt.toISOString(),
  };
}

/**
 * Normalizes the user-provided filename header or multipart filename.
 */
export function normalizeOriginalName(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) throw badRequestError("X-File-Name header is required");
  if (trimmed.length > 255) throw badRequestError("Filename is too long");
  return trimmed;
}

/**
 * Normalizes content type values by stripping parameters such as charset.
 */
export function normalizeContentType(value: string | undefined): string {
  const contentType = value?.split(";", 1)[0]?.trim().toLowerCase();
  if (!contentType) throw badRequestError("Content-Type header is required");
  return contentType;
}

/**
 * Sanitizes a filename for object-key usage while keeping the human name stable.
 */
export function sanitizeFilename(value: string): string {
  const LAST_C0_CONTROL_CODE_POINT = 31;
  const DELETE_CONTROL_CODE_POINT = 127;

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

/**
 * Removes export/import timestamp suffixes from generated filenames.
 *
 * Example: import-report-2026-06-03-112151.csv -> import-report.csv
 */
export function stripTrailingTimestamp(value: string): string {
  const extensionIndex = value.lastIndexOf(".");
  const hasExtension = extensionIndex > 0 && extensionIndex < value.length - 1;
  const stem = hasExtension ? value.slice(0, extensionIndex) : value;
  const extension = hasExtension ? value.slice(extensionIndex) : "";
  const normalizedStem = stem
    .replace(/[-_ ]\d{4}[-_]?\d{2}[-_]?\d{2}[-_]?\d{6}$/u, "")
    .trim();

  return `${normalizedStem || stem}${extension}`;
}

/**
 * Creates the canonical bucket key for one file object.
 */
export function createBucketKey(input: {
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

/**
 * Builds a safe attachment Content-Disposition header value.
 */
export function getAttachmentDisposition(filename: string): string {
  return `attachment; filename*=UTF-8''${encodeRFC5987Value(filename)}`;
}

/**
 * Encodes a filename according to RFC 5987 for HTTP header usage.
 */
export function encodeRFC5987Value(value: string): string {
  return encodeURIComponent(value).replaceAll(/['()*]/g, (char) => {
    const codePoint = char.codePointAt(0);
    return codePoint === undefined
      ? ""
      : `%${codePoint.toString(16).toUpperCase()}`;
  });
}
