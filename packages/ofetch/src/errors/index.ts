import { isHTTPError, isNetworkError, isTimeoutError } from "ky";
import { resolveStatusMessage } from "../status";
import { createSearchParams } from "../utils";
import { REDACTED, SENSITIVE_KEYS } from "./constants";
import type {
  ApiResult,
  BusinessCode,
  BusinessFailureResult,
  BusinessStatusValidator,
  HttpRequestConfig,
  QueryParams,
  RedactedHttpRequestConfig,
} from "../utils/types";
import type { HttpRequestErrorKind, HttpRequestErrorOptions } from "./types";

/** Unified request error with response metadata and redacted request config. */
export class HttpRequestError extends Error {
  kind: HttpRequestErrorKind;
  code?: number | string;
  status?: number;
  data?: unknown;
  response?: Response;
  config?: RedactedHttpRequestConfig;
  override cause?: unknown;

  /** Create a normalized request error and redact config before storing it. */
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
}

/** Create a redacted request config for logs and error reporting. */
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
    validateBusinessStatus: config.validateBusinessStatus,
    timestamp: config.timestamp,
    formatRequestData: config.formatRequestData,
    dedupe: config.dedupe,
    headers: redactHeaders(config.headers),
    query: redactQuery(config.query),
    body: config.body === undefined ? undefined : REDACTED,
  };
}

/** Redact sensitive header values such as tokens, cookies, and authorization. */
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

/** Redact sensitive query values such as tokens, passwords, and API keys. */
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

/** Read a displayable message from common backend wrappers. */
function readApiMessage(data: unknown): string {
  if (!data || typeof data !== "object") {
    return "";
  }
  const result = data as ApiResult & { error?: { message?: string } };
  return result.error?.message || result.msg || result.message || "";
}

/** Read a custom business code from common backend wrappers. */
function readApiCode(data: unknown): number | string | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }
  return (data as ApiResult).code;
}

/** Default business wrapper strategy for `success=false` and `type=error`. */
function defaultBusinessStatusValidator(
  data: unknown,
): BusinessFailureResult | false {
  if (!data || typeof data !== "object") {
    return false;
  }

  const result = data as ApiResult;
  if (result.success === false || result.type === "error") {
    return {
      failed: true,
      code: result.code,
      data,
    };
  }

  return false;
}

/** Run the business wrapper strategy and normalize boolean failures. */
function resolveBusinessFailure(
  data: unknown,
  response: Response,
  config: HttpRequestConfig,
  validator: BusinessStatusValidator = defaultBusinessStatusValidator,
): BusinessFailureResult | undefined {
  const result = validator(data, response, config);
  return normalizeBusinessFailureResult(result, data, readApiCode(data));
}

/** Normalize a boolean or structured business failure result. */
function normalizeBusinessFailureResult(
  result: boolean | BusinessFailureResult | null | undefined,
  data: unknown,
  code?: BusinessCode,
): BusinessFailureResult | undefined {
  if (result === true) {
    return {
      failed: true,
      code,
      data,
    };
  }
  if (!result) {
    return undefined;
  }
  return result.failed ? { ...result, code: result.code ?? code } : undefined;
}

/** Resolve the HTTP status used for message fallback and response mapping. */
function resolveBusinessStatus(
  response: Response,
  explicitStatus?: number,
): number {
  if (explicitStatus) {
    return explicitStatus;
  }
  return response.status;
}

/** Convert a business wrapper failure into a normalized request error. */
export function validateBusinessResult(
  data: unknown,
  response: Response,
  config: HttpRequestConfig,
  validator?: BusinessStatusValidator,
) {
  const failure = resolveBusinessFailure(data, response, config, validator);
  if (!failure) {
    return;
  }

  const failureData = failure.data ?? data;
  const code = failure.code ?? readApiCode(failureData);
  const status = resolveBusinessStatus(response, failure.status);
  throw new HttpRequestError(
    resolveStatusMessage(
      status,
      failure.message ?? readApiMessage(failureData),
    ),
    {
      kind: "business",
      code,
      status,
      data: failureData,
      response,
      config,
    },
  );
}

/** Normalize ky, fetch, abort, and unknown errors into HttpRequestError. */
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

/** Detect AbortController cancellation across browser-like and Node runtimes. */
function isAbortError(error: unknown): boolean {
  if (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "AbortError"
  ) {
    return true;
  }
  return error instanceof Error && error.name === "AbortError";
}
