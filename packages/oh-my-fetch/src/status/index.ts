import { RESPONSE_ERROR_MESSAGE } from "@shamt/envs/constants";
import { STATUS_MESSAGE_BY_CODE } from "./constants";
import type { KnownStatusCode } from "./types";

/**
 * Resolve the final error message from an HTTP status and optional upstream message.
 *
 * @example
 * ```ts
 * resolveStatusMessage(404); // "Not Found"
 * resolveStatusMessage(500, "Upstream failed"); // "Upstream failed"
 * ```
 */
export function resolveStatusMessage(
  status?: number,
  message?: string,
): string {
  if (message) {
    return message;
  }
  if (!status) {
    return RESPONSE_ERROR_MESSAGE;
  }
  return (
    STATUS_MESSAGE_BY_CODE[status as KnownStatusCode] || RESPONSE_ERROR_MESSAGE
  );
}
