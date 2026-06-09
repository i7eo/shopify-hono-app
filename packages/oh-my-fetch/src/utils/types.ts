import type { HTTP_METHODS, RESPONSE_BODY_TYPES } from "./constants";
import type { Input, Options } from "ky";

export interface DayjsLike {
  format: (format: string) => string;
}

export type { RetryOptions } from "ky";

export type HttpMethod = (typeof HTTP_METHODS)[number];

export type ResponseBodyType = (typeof RESPONSE_BODY_TYPES)[number];

export const JSON_SECURITY_MODES = ["strict", "shallow", "off"] as const;
export type JsonSecurityMode = (typeof JSON_SECURITY_MODES)[number];

export type QueryPrimitive =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date
  | DayjsLike;
export type QueryValue = QueryPrimitive | readonly QueryPrimitive[];
export type QueryParams =
  | string
  | URLSearchParams
  | readonly (readonly [string, QueryPrimitive])[]
  | Record<string, QueryValue>;
export type MultipartValue = string | Blob;

export type DedupeOption = boolean | string;

export type MaybePromise<T> = T | Promise<T>;
type PickKyOptions<TKey extends PropertyKey> = Pick<
  Options,
  Extract<keyof Options, TKey>
>;

/**
 * Transport options that may pass through to ky/fetch.
 * This intentionally avoids extending the full Options surface.
 */
export interface HttpTransportConfig extends PickKyOptions<
  | "baseUrl"
  | "prefix"
  | "headers"
  | "timeout"
  | "totalTimeout"
  | "retry"
  | "throwHttpErrors"
  | "fetch"
  | "parseJson"
  | "stringifyJson"
  | "context"
  | "signal"
  | "credentials"
  | "mode"
  | "cache"
  | "redirect"
  | "referrer"
  | "referrerPolicy"
  | "integrity"
  | "keepalive"
  | "onDownloadProgress"
  | "onUploadProgress"
> {}

export interface ErrorReporter {
  report: (
    error: Error,
    context: RequestContext & { error: Error },
  ) => MaybePromise<void>;
}

export type ValidationTarget = "request" | "response";

export interface ValidationContext {
  target: ValidationTarget;
  config: HttpRequestConfig;
  response?: Response;
}

export interface ValidationSuccess<TOutput> {
  success: true;
  data: TOutput;
}

export interface ValidationFailure {
  success: false;
  issues?: unknown;
  message?: string;
  cause?: unknown;
}

export type ValidationResult<TOutput> =
  | ValidationSuccess<TOutput>
  | ValidationFailure;

export interface ValidationAdapter<TOutput = unknown> {
  validateSchema: (
    value: unknown,
    context: ValidationContext,
  ) => MaybePromise<ValidationResult<TOutput>>;
}

export type ValidationFunction<TOutput = unknown> = (
  value: unknown,
  context: ValidationContext,
) => MaybePromise<TOutput | ValidationResult<TOutput>>;

export type StandardSchemaIssue = {
  message?: string;
  path?: readonly (string | number | symbol)[];
};

export type StandardSchemaResult<TOutput> =
  | { value: TOutput; issues?: undefined }
  | { issues: readonly StandardSchemaIssue[]; value?: undefined };

export interface StandardSchema<TOutput = unknown> {
  "~standard": {
    validate: (value: unknown) => MaybePromise<StandardSchemaResult<TOutput>>;
  };
}

export type SafeParseResult<TOutput> =
  | { success: true; data: TOutput }
  | { success: false; error: unknown };

export interface SafeParseSchema<TOutput = unknown> {
  safeParseAsync?: (value: unknown) => MaybePromise<SafeParseResult<TOutput>>;
  safeParse?: (value: unknown) => SafeParseResult<TOutput>;
}

export interface YupLikeSchema<TOutput = unknown> {
  validate: (
    value: unknown,
    options?: Record<string, unknown>,
  ) => MaybePromise<TOutput>;
}

/** Pluggable validation protocol for adapters, functions, Standard Schema, Zod-like, and Yup-like schemas. */
export type ValidationSchema<TOutput = unknown> =
  | ValidationAdapter<TOutput>
  | ValidationFunction<TOutput>
  | StandardSchema<TOutput>
  | SafeParseSchema<TOutput>
  | YupLikeSchema<TOutput>;

export type InferSchemaOutput<TSchema extends ValidationSchema> =
  TSchema extends ValidationSchema<infer TOutput> ? TOutput : never;

/**
 * Behavior flags added by the wrapper on top of ky/fetch.
 * They can be configured as client defaults or overridden per request.
 */
export interface RequestBehavior {
  /** Response body parsing mode. */
  responseType?: ResponseBodyType;
  /** Append a current `_t` timestamp to GET requests to bypass caches. */
  timestamp?: boolean;
  /** Abort an in-flight request with the same key before starting a new one. */
  dedupe?: DedupeOption;
  /** Prototype-pollution defense level for parsed JSON. */
  jsonSecurity?: JsonSecurityMode;
}

/**
 * Request config used by HttpClient.
 * It accepts selected ky options while using `query` instead of `searchParams`
 * and one semantic `body` field instead of exposing both `json` and `body`.
 */
export interface HttpRequestConfig<TBody = unknown, TResponse = unknown>
  extends HttpTransportConfig, RequestBehavior {
  method?: HttpMethod;
  query?: QueryParams;
  body?: TBody;
  /** Validate body before sending; transformed schema output becomes the final body. */
  bodySchema?: ValidationSchema<unknown>;
  /** Validate parsed response data after business wrapper validation. */
  responseSchema?: ValidationSchema<TResponse>;
}

export type RedactedHttpRequestConfig = Pick<
  HttpRequestConfig,
  | "method"
  | "prefix"
  | "baseUrl"
  | "timeout"
  | "totalTimeout"
  | "retry"
  | "responseType"
  | "timestamp"
  | "dedupe"
> & {
  headers?: Headers;
  query?: QueryParams;
  body?: "[redacted]";
};

export interface ParsedHttpResponse<T = unknown> extends Response {
  data: T;
  config: RedactedHttpRequestConfig;
}

export interface UploadFileParams {
  file: File | Blob;
  /** Form field name, defaults to `file`. */
  fieldName?: string;
  /** Filename used when appending a Blob or File. */
  filename?: string;
  data?: Record<string, MultipartValue | readonly MultipartValue[]>;
}

export interface RequestContext<TBody = unknown, TResponse = unknown> {
  input: Input;
  config: HttpRequestConfig<TBody, TResponse>;
  state?: Map<PropertyKey, unknown>;
}

/**
 * High-level lifecycle hooks.
 * Use HttpClientOptions.kyHooks when native ky hooks such as beforeRetry are needed.
 */
export interface HttpClientHooks {
  beforeRequest?: <TBody, TResponse>(
    config: HttpRequestConfig<TBody, TResponse>,
    context: RequestContext<TBody, TResponse>,
  ) => MaybePromise<HttpRequestConfig<TBody, TResponse> | void>;
  afterResponse?: <T>(
    response: ParsedHttpResponse<T>,
    context: RequestContext,
  ) => MaybePromise<ParsedHttpResponse<T> | void>;
  beforeError?: (
    error: Error,
    context: RequestContext,
  ) => MaybePromise<Error | void>;
}

export interface HttpPlugin {
  name?: string;
  beforeRequest?: <TBody, TResponse>(
    config: HttpRequestConfig<TBody, TResponse>,
    context: RequestContext<TBody, TResponse>,
  ) => MaybePromise<HttpRequestConfig<TBody, TResponse> | void>;
  afterResponse?: <T>(
    response: ParsedHttpResponse<T>,
    context: RequestContext,
  ) => MaybePromise<ParsedHttpResponse<T> | void>;
  beforeError?: (
    error: Error,
    context: RequestContext,
  ) => MaybePromise<Error | void>;
  dispose?: () => void;
}

export interface HttpClientDependencies {
  fetch?: typeof fetch;
}

export interface HttpClientOptions extends HttpTransportConfig {
  /** Global defaults for wrapper-level HTTP behavior. */
  defaults?: RequestBehavior;
  /** High-level hooks that operate on normalized config/response objects. */
  hooks?: HttpClientHooks;
  /** DI-friendly lifecycle extensions. Prefer plugins over hooks for reusable behavior. */
  plugins?: readonly HttpPlugin[];
  /** Runtime dependencies for tests, telemetry, and host integration. */
  deps?: HttpClientDependencies;
  /** Native ky hooks passed directly to ky.create(). */
  kyHooks?: Options["hooks"];
}
