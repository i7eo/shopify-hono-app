import type { Context } from "hono";

export type ParsedFileUpload = {
  body: ReadableStream<Uint8Array>;
  contentType?: string;
  originalName?: string;
};

export type ParseFileUploadInput = {
  fieldNames: string[];
  maxFiles: number;
};

export interface FileMultipartUploadParser {
  parse: (
    context: Context,
    input: ParseFileUploadInput,
  ) => Promise<ParsedFileUpload[]>;
}
