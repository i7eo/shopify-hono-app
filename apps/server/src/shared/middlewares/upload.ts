import { DEFAULT_UPLOAD_MAX_SIZE } from "@shamt/app-env";
import { bodyLimit } from "hono/body-limit";
import {
  createErrorResponse,
  uploadPayloadTooLargeError,
} from "@/shared/exceptions";

export function uploadMiddleware() {
  return bodyLimit({
    maxSize: DEFAULT_UPLOAD_MAX_SIZE,
    onError: (c) =>
      createErrorResponse(
        c,
        uploadPayloadTooLargeError("Upload request body overflow maxsize", {
          details: {
            maxSize: DEFAULT_UPLOAD_MAX_SIZE,
          },
        }),
      ),
  });
}
