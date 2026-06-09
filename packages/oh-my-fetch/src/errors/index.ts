import { isHTTPError, isNetworkError, isTimeoutError } from "ky";
import { createSearchParams } from "../core/query";
import { isAbortError } from "../lifecycle/abort";
import { resolveStatusMessage } from "../status";
import { REDACTED, SENSITIVE_KEYS } from "./constants";
import type {
  HttpRequestConfig,
  QueryParams,
  RedactedHttpRequestConfig,
} from "../utils/types";
import type { HttpRequestErrorKind, HttpRequestErrorOptions } from "./types";

/**
 * Unified request error with response metadata and redacted request config.
 *
 * @example
 * ```ts
 * throw new HttpRequestError("Network request failed", { kind: "network" });
 * ```
 */
export class HttpRequestError extends Error {
  kind: HttpRequestErrorKind;
  code?: number | string;
  status?: number;
  data?: unknown;
  response?: Response;
  config?: RedactedHttpRequestConfig;
  override cause?: unknown;

  /**
   * Create a normalized request error and redact config before storing it.
   *
   * @example
   * ```ts
   * new HttpRequestError("Failed", {
   *   config: { headers: { authorization: "secret" } },
   * }).config?.headers?.get("authorization");
   * // "[redacted]"
   * ```
   */
  constructor(message: string, options: HttpRequestErrorOptions = {}) {
    super(message);
    this.name = "HttpRequestError";
    this.kind = options.kind ?? "unknown";
    this.code = options.code;
    this.status = options.status;
    this.data = options.data;
    this.response = options.response;
    this.config = options.config
      ? redactHttpRequestConfig(options.config)
      : undefined;
    this.cause = options.cause;
  }

  /**
   * Serialize only safe error fields for logs and telemetry.
   *
   * @example
   * ```ts
   * JSON.stringify(new HttpRequestError("Failed", { data: { secret: true } }));
   * // Does not include raw data.
   * ```
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      kind: this.kind,
      code: this.code,
      status: this.status,
      config: this.config,
    };
  }
}

/**
 * Create a redacted request config for logs and error reporting.
 *
 * @example
 * ```ts
 * redactHttpRequestConfig({ query: { token: "secret" } }).query;
 * // URLSearchParams with token=[redacted]
 * ```
 */
export function redactHttpRequestConfig(
  config: HttpRequestConfig,
): RedactedHttpRequestConfig {
  return {
    method: config.method,
    prefix: config.prefix,
    baseUrl: config.baseUrl,
    timeout: config.timeout,
    totalTimeout: config.totalTimeout,
    retry: config.retry,
    responseType: config.responseType,
    timestamp: config.timestamp,
    dedupe: config.dedupe,
    headers: redactHeaders(config.headers),
    query: redactQuery(config.query),
    body: config.body === undefined ? undefined : REDACTED,
  };
}

/**
 * Redact sensitive header values such as tokens, cookies, and authorization.
 *
 * @example
 * ```ts
 * redactHeaders({ authorization: "secret", accept: "json" })?.get("authorization");
 * // "[redacted]"
 * ```
 */
function redactHeaders(
  headersInit: HttpRequestConfig["headers"],
): Headers | undefined {
  if (!headersInit) {
    return undefined;
  }

  const headers = new Headers();
  if (!(headersInit instanceof Headers) && !Array.isArray(headersInit)) {
    Object.entries(headersInit).forEach(([key, value]) => {
      if (value === undefined) {
        return;
      }
      headers.set(key, SENSITIVE_KEYS.test(key) ? REDACTED : value);
    });
    return headers;
  }

  new Headers(headersInit).forEach((value, key) => {
    headers.set(key, SENSITIVE_KEYS.test(key) ? REDACTED : value);
  });
  return headers;
}

/**
 * Redact sensitive query values such as tokens, passwords, and API keys.
 *
 * @example
 * ```ts
 * redactQuery("api_key=secret&page=1")?.toString();
 * // "api_key=%5Bredacted%5D&page=1"
 * ```
 */
function redactQuery(query: QueryParams | undefined): QueryParams | undefined {
  const source = createSearchParams(query);
  if (!source) {
    return undefined;
  }

  const redacted = new URLSearchParams();
  source.forEach((value, key) => {
    redacted.append(key, SENSITIVE_KEYS.test(key) ? REDACTED : value);
  });
  return redacted;
}

/**
 * Read an upstream error message from common response wrapper shapes.
 *
 * @example
 * ```ts
 * readApiMessage({ message: "Not found" }); // "Not found"
 * ```
 */
function readApiMessage(data: unknown): string {
  if (!data || typeof data !== "object") {
    return "";
  }
  const result = data as {
    msg?: string;
    message?: string;
    error?: { message?: string };
  };
  return result.error?.message || result.msg || result.message || "";
}

/**
 * Normalize ky, fetch, abort, and unknown errors into HttpRequestError.
 *
 * @example
 * ```ts
 * const error = normalizeHttpError(new Error("boom"), { method: "GET" });
 * error.kind; // "unknown"
 * ```
 */
export function normalizeHttpError(
  error: unknown,
  config: HttpRequestConfig,
): HttpRequestError {
  if (error instanceof HttpRequestError) {
    return error;
  }

  if (isAbortError(error)) {
    return new HttpRequestError("Request was aborted", {
      kind: "abort",
      code: "ABORT_ERR",
      config,
      cause: error,
    });
  }

  if (isHTTPError(error)) {
    const data = error.data;
    const status = error.response.status;
    return new HttpRequestError(
      resolveStatusMessage(status, readApiMessage(data)),
      {
        kind: "http_status",
        status,
        data,
        response: error.response,
        config,
        cause: error,
      },
    );
  }

  if (isTimeoutError(error)) {
    return new HttpRequestError("Request timed out", {
      kind: "timeout",
      code: "ECONNABORTED",
      status: 408,
      config,
      cause: error,
    });
  }

  if (isNetworkError(error)) {
    return new HttpRequestError("Network request failed", {
      kind: "network",
      code: "NETWORK_ERROR",
      config,
      cause: error,
    });
  }

  if (error instanceof Error) {
    return new HttpRequestError(error.message || "Request failed", {
      kind: "unknown",
      config,
      cause: error,
    });
  }

  return new HttpRequestError("Request failed", {
    kind: "unknown",
    data: error,
    config,
    cause: error,
  });
}
