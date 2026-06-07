import { RESPONSE_ERROR_MESSAGE } from "@shamt/envs";
import { STATUS_MESSAGE_BY_CODE } from "./constants";
import type { KnownStatusCode } from "./types";

/** Resolve the final error message from an HTTP status and optional upstream message. */
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
