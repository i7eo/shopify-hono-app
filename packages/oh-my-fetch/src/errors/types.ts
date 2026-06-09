import type { HttpRequestConfig } from "../utils/types";

export const HTTP_REQUEST_ERROR_KINDS = [
  "http_status",
  "timeout",
  "network",
  "abort",
  "business",
  "request_validation",
  "response_validation",
  "unknown",
] as const;

export type HttpRequestErrorKind = (typeof HTTP_REQUEST_ERROR_KINDS)[number];

export interface HttpRequestErrorOptions {
  kind?: HttpRequestErrorKind;
  code?: number | string;
  status?: number;
  data?: unknown;
  response?: Response;
  config?: HttpRequestConfig;
  cause?: unknown;
}
