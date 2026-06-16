import type {
  FileDownload,
  FileDownloadInput,
  FileDownloadResolver,
} from "./domain/files";
import type { Bucket } from "@/infra/bucket";

/**
 * Resolves memory Node bucket objects into direct download streams.
 */
export class MemoryBucketFileDownloadResolver implements FileDownloadResolver {
  constructor(private readonly bucket: Bucket) {}

  async resolve(input: FileDownloadInput): Promise<FileDownload> {
    const object = await this.bucket.open({
      key: input.file.bucketKey,
    });

    return {
      type: "stream",
      body: object.body,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": getAttachmentDisposition(
          input.file.originalName,
        ),
        "Content-Length": String(object.byteSize),
        "Content-Type": input.file.contentType,
      },
    };
  }
}

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
