import type { HttpRequestConfig } from "../utils/types";

export type HttpRequestErrorKind =
  | "http_status"
  | "timeout"
  | "network"
  | "abort"
  | "business"
  | "request_validation"
  | "response_validation"
  | "unknown";

export interface HttpRequestErrorOptions {
  kind?: HttpRequestErrorKind;
  code?: number | string;
  status?: number;
  data?: unknown;
  response?: Response;
  config?: HttpRequestConfig;
  cause?: unknown;
}
