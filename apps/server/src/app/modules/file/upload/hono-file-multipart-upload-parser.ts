import { badRequestError } from "@/shared/exceptions";
import type {
  FileMultipartUploadParser,
  ParsedFileUpload,
} from "./file-multipart-upload-parser";
import type { Context } from "hono";

type FileFormDataEntryValue = File | string;

/**
 * Parses multipart uploads with Hono's native body parser for the phase-1 MVP.
 *
 * Phase 2 can replace this capability with formidable@next once we validate
 * its backpressure behavior across Node and Cloudflare runtimes.
 */
export class HonoFileMultipartUploadParser implements FileMultipartUploadParser {
  async parse(
    context: Context,
    input: { fieldNames: string[]; maxFiles: number },
  ): Promise<ParsedFileUpload[]> {
    const body = await context.req.parseBody({ all: true });
    const files = getFilesFromBody(body, input.fieldNames);

    if (files.length === 0) {
      throw badRequestError("At least one file is required");
    }

    if (files.length > input.maxFiles) {
      throw badRequestError("Too many files", {
        details: {
          maxFiles: input.maxFiles,
        },
      });
    }

    return files.map((file) => ({
      body: file.stream(),
      contentType: file.type || "application/octet-stream",
      originalName: file.name,
    }));
  }
}

function getFilesFromBody(
  body: Record<string, FileFormDataEntryValue | FileFormDataEntryValue[]>,
  fieldNames: string[],
): File[] {
  const files: File[] = [];

  for (const fieldName of fieldNames) {
    const value = body[fieldName];
    const values = Array.isArray(value) ? value : [value];

    for (const entry of values) {
      if (entry instanceof File) {
        files.push(entry);
      }
    }
  }

  return files;
}
