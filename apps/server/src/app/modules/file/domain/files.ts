import type { BucketProvider } from "@/infra/bucket";

export type FileStatus =
  | "uploading"
  | "available"
  | "expired"
  | "deleted"
  | "failed";

export type FileRecord = {
  id: string;
  shopDomain: string;
  originalName: string;
  safeName: string;
  contentType: string;
  byteSize: number;
  bucketProvider: BucketProvider;
  bucketKey: string;
  status: FileStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
};

export type PublicFile = {
  id: string;
  originalName: string;
  safeName: string;
  contentType: string;
  byteSize: number;
  status: FileStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

export type FileLookup = {
  id: string;
  shopDomain: string;
};

export type FileListInput = {
  cursor?: string;
  limit: number;
  shopDomain: string;
};

export type FilesPage = {
  files: FileRecord[];
  nextCursor?: string;
};

export type FileStatusUpdate = FileLookup & {
  status: FileStatus;
  deletedAt?: Date;
};

export interface FilesStore {
  create: (file: FileRecord) => Promise<void>;
  findById: (input: FileLookup) => Promise<FileRecord | null>;
  list: (input: FileListInput) => Promise<FilesPage>;
  updateStatus: (input: FileStatusUpdate) => Promise<void>;
  delete: (input: FileLookup) => Promise<void>;
}

export type FileDownloadInput = {
  file: FileRecord;
};

export type FileDownload =
  | { type: "stream"; body: ReadableStream<Uint8Array>; headers: HeadersInit }
  | { type: "redirect"; url: string; headers?: HeadersInit };

export interface FileDownloadResolver {
  resolve: (input: FileDownloadInput) => Promise<FileDownload>;
}

export function toPublicFile(file: FileRecord): PublicFile {
  return {
    id: file.id,
    originalName: file.originalName,
    safeName: file.safeName,
    contentType: file.contentType,
    byteSize: file.byteSize,
    status: file.status,
    expiresAt: file.expiresAt.toISOString(),
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
  };
}
