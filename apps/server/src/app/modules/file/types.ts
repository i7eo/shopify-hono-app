import type { RuntimeConfig } from "@/infra/env";
import type { SelectFile } from "@shamt/database";
import type { Context } from "hono";

export type FileStatus = SelectFile["status"];

export type FileRecord = SelectFile;

export type PublicFile = Omit<
  SelectFile,
  "createdAt" | "deletedAt" | "expiresAt" | "updatedAt"
> & {
  createdAt: string;
  deletedAt: string | null;
  expiresAt: string;
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

export type CreateFileInput = {
  batchId?: string;
  body: ReadableStream<Uint8Array> | null;
  contentType?: string;
  originalName?: string;
  runtimeEnv: RuntimeConfig;
  shopDomain: string;
};

export type CreateFilesInput = {
  runtimeEnv: RuntimeConfig;
  shopDomain: string;
};

export type ListFilesInput = {
  cursor?: string;
  limit?: number;
  shopDomain: string;
};

export type ParsedFileUpload = {
  body: ReadableStream<Uint8Array>;
  contentType?: string;
  originalName?: string;
};

export type ParseFileUploadInput = {
  fieldNames: string[];
  maxFiles: number;
  onFile: (file: ParsedFileUpload) => Promise<void>;
};

export interface FileUploadStreamParser {
  parse: (context: Context, input: ParseFileUploadInput) => Promise<void>;
}
