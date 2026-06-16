import { DEFAULT_APP_BUCKET_PROVIDERS } from "@shamt/app-env";
import { DEFAULT_SIGNED_DOWNLOAD_URL_EXPIRE } from "@/constants";
import { internalServerError } from "@/shared/exceptions";
import { getAttachmentDisposition } from "../utils";
import type {
  FileDownload,
  FileDownloadInput,
  FileDownloadResolver,
} from "../types";
import type { Bucket, BucketDownloadSigner } from "@/infra/bucket";

/**
 * Resolves bucket-backed files into direct streams or signed redirects.
 */
export class BucketFileDownloadResolver implements FileDownloadResolver {
  constructor(
    private readonly bucket: Bucket,
    private readonly signer?: BucketDownloadSigner,
  ) {}

  /**
   * Returns a short-lived redirect for R2 files and a private stream response
   * for memory files.
   */
  async resolve(input: FileDownloadInput): Promise<FileDownload> {
    if (input.file.bucketProvider === DEFAULT_APP_BUCKET_PROVIDERS.R2) {
      if (!this.signer) {
        throw internalServerError("R2 download signer is not configured", {
          expose: true,
        });
      }

      return {
        type: "redirect",
        url: await this.signer.signDownloadUrl({
          contentType: input.file.contentType,
          expiresInMilliseconds: DEFAULT_SIGNED_DOWNLOAD_URL_EXPIRE,
          key: input.file.bucketKey,
          originalName: input.file.originalName,
        }),
        headers: {
          "Cache-Control": "private, no-store",
        },
      };
    }

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
