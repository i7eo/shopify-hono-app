import { deserializeValue } from "@shamt/utils";
import ky, { type Input, type KyInstance, type Options } from "ky";
import {
  normalizeHttpError,
  redactHttpRequestConfig,
  validateBusinessResult,
} from "../errors";
import {
  appendTimestamp,
  createSearchParams,
  createUrlEncodedBody,
  normalizeRequestData,
} from "../utils";
import { validateWithSchema } from "../validation";
import {
  BODYLESS_METHODS,
  DEFAULT_BEHAVIOR,
  DEFAULT_RETRY,
  KY_HOOK_NAMES,
  UNSAFE_JSON_KEYS,
} from "./constants";
import type {
  DedupeOption,
  HttpClientOptions,
  HttpMethod,
  HttpRequestConfig,
  InferSchemaOutput,
  ParsedHttpResponse,
  UploadFileParams,
  ValidationSchema,
} from "../utils/types";
import type {
  BodyResponseConfig,
  HeaderSource,
  KyHooks,
  ParseJson,
  PendingRequest,
  ResolvedRequestBehavior,
  ResponseConfig,
} from "./types";

type FetchBody = NonNullable<Options["body"]>;

/**
 * Lightweight ky-based HTTP client with typed body, query, upload, parsing,
 * business wrapper validation, and request dedupe behavior.
 */
export class HttpClient {
  private readonly client: KyInstance;
  private readonly options: HttpClientOptions;
  private readonly pendingRequests = new Map<string, AbortController>();

  /** Create a client and apply ky defaults plus wrapper behavior defaults. */
  constructor(options: HttpClientOptions = {}) {
    const { defaults, hooks, kyHooks, ...kyOptions } = options;
    const parseJson = kyOptions.parseJson ?? safeJsonParse;
    this.options = {
      ...options,
      parseJson,
      defaults: {
        ...DEFAULT_BEHAVIOR,
        ...defaults,
      },
    };
    this.client = ky.create({
      ...kyOptions,
      parseJson,
      retry: kyOptions.retry ?? DEFAULT_RETRY,
      hooks: kyHooks,
    });
  }

  /** Expose the underlying ky instance for callers that need native ky APIs. */
  get ky(): KyInstance {
    return this.client;
  }

  /** Create a new client by merging defaults, headers, and hooks. */
  extend(options: HttpClientOptions): HttpClient {
    return new HttpClient({
      ...this.options,
      ...options,
      headers: mergeHeaders(this.options.headers, options.headers),
      defaults: {
        ...this.options.defaults,
        ...options.defaults,
      },
      hooks: {
        ...this.options.hooks,
        ...options.hooks,
      },
      kyHooks: mergeKyHooks(this.options.kyHooks, options.kyHooks),
    });
  }

  /** Send a GET request; URL parameters should be passed through `query`. */
  get<TSchema extends ValidationSchema>(
    input: Input,
    config: ResponseConfig<TSchema>,
  ): Promise<InferSchemaOutput<TSchema>>;
  get<T = unknown>(
    input: Input,
    config?: Omit<HttpRequestConfig<unknown, T>, "body" | "method">,
  ): Promise<T>;
  get<T = unknown>(
    input: Input,
    config?: Omit<HttpRequestConfig<unknown, T>, "body" | "method">,
  ): Promise<T> {
    return this.request(input, {
      ...config,
      method: "GET",
    } as HttpRequestConfig<unknown, T>);
  }

  /** Send a POST request with JSON-like data, FormData, URLSearchParams, or Fetch body data. */
  post<TSchema extends ValidationSchema, TBody = unknown>(
    input: Input,
    body: TBody,
    config: BodyResponseConfig<TBody, TSchema>,
  ): Promise<InferSchemaOutput<TSchema>>;
  post<T = unknown, TBody = unknown>(
    input: Input,
    body?: TBody,
    config?: Omit<HttpRequestConfig<TBody, T>, "body" | "method">,
  ): Promise<T>;
  post<T = unknown, TBody = unknown>(
    input: Input,
    body?: TBody,
    config?: Omit<HttpRequestConfig<TBody, T>, "body" | "method">,
  ): Promise<T> {
    return this.request(input, {
      ...config,
      method: "POST",
      body,
    } as HttpRequestConfig<TBody, T>);
  }

  /** Send a PUT request. */
  put<TSchema extends ValidationSchema, TBody = unknown>(
    input: Input,
    body: TBody,
    config: BodyResponseConfig<TBody, TSchema>,
  ): Promise<InferSchemaOutput<TSchema>>;
  put<T = unknown, TBody = unknown>(
    input: Input,
    body?: TBody,
    config?: Omit<HttpRequestConfig<TBody, T>, "body" | "method">,
  ): Promise<T>;
  put<T = unknown, TBody = unknown>(
    input: Input,
    body?: TBody,
    config?: Omit<HttpRequestConfig<TBody, T>, "body" | "method">,
  ): Promise<T> {
    return this.request(input, {
      ...config,
      method: "PUT",
      body,
    } as HttpRequestConfig<TBody, T>);
  }

  /** Send a PATCH request. */
  patch<TSchema extends ValidationSchema, TBody = unknown>(
    input: Input,
    body: TBody,
    config: BodyResponseConfig<TBody, TSchema>,
  ): Promise<InferSchemaOutput<TSchema>>;
  patch<T = unknown, TBody = unknown>(
    input: Input,
    body?: TBody,
    config?: Omit<HttpRequestConfig<TBody, T>, "body" | "method">,
  ): Promise<T>;
  patch<T = unknown, TBody = unknown>(
    input: Input,
    body?: TBody,
    config?: Omit<HttpRequestConfig<TBody, T>, "body" | "method">,
  ): Promise<T> {
    return this.request(input, {
      ...config,
      method: "PATCH",
      body,
    } as HttpRequestConfig<TBody, T>);
  }

  /** Send a DELETE request. */
  delete<TSchema extends ValidationSchema>(
    input: Input,
    config: ResponseConfig<TSchema>,
  ): Promise<InferSchemaOutput<TSchema>>;
  delete<T = unknown>(
    input: Input,
    config?: Omit<HttpRequestConfig<unknown, T>, "body" | "method">,
  ): Promise<T>;
  delete<T = unknown>(
    input: Input,
    config?: Omit<HttpRequestConfig<unknown, T>, "body" | "method">,
  ): Promise<T> {
    return this.request(input, {
      ...config,
      method: "DELETE",
    } as HttpRequestConfig<unknown, T>);
  }

  /**
   * Upload a File or Blob with FormData.
   * Do not set Content-Type manually because Fetch must generate the boundary.
   */
  upload<TSchema extends ValidationSchema>(
    input: Input,
    params: UploadFileParams,
    config: BodyResponseConfig<FormData, TSchema>,
  ): Promise<InferSchemaOutput<TSchema>>;
  upload<T = unknown>(
    input: Input,
    params: UploadFileParams,
    config?: Omit<HttpRequestConfig<FormData, T>, "body" | "method">,
  ): Promise<T>;
  upload<T = unknown>(
    input: Input,
    params: UploadFileParams,
    config?: Omit<HttpRequestConfig<FormData, T>, "body" | "method">,
  ): Promise<T> {
    const formData = new FormData();
    const fieldName = params.fieldName || "file";

    if (params.filename) {
      formData.append(fieldName, params.file, params.filename);
    } else {
      formData.append(fieldName, params.file);
    }

    Object.entries(params.data || {}).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => formData.append(`${key}[]`, item));
        return;
      }
      formData.append(key, value instanceof Blob ? value : String(value));
    });

    return this.request(input, {
      ...config,
      method: "POST",
      body: formData,
    } as HttpRequestConfig<FormData, T>);
  }

  /**
   * Low-level request entry for uncommon methods or full option control.
   * Prefer get/post/put/patch/delete/upload for regular calls.
   */
  request<TSchema extends ValidationSchema, TBody = unknown>(
    input: Input,
    config: HttpRequestConfig<TBody, InferSchemaOutput<TSchema>> & {
      responseSchema: TSchema;
    },
  ): Promise<InferSchemaOutput<TSchema>>;
  request<T = unknown, TBody = unknown>(
    input: Input,
    config?: HttpRequestConfig<TBody, T>,
  ): Promise<T>;
  async request<T = unknown, TBody = unknown>(
    input: Input,
    config: HttpRequestConfig<TBody, T> = {},
  ): Promise<T> {
    let requestConfig = this.resolveConfig(config);
    const context = { input, config: requestConfig };
    let pendingRequest: PendingRequest | undefined;

    try {
      if (this.options.hooks?.beforeRequest) {
        requestConfig =
          (await this.options.hooks.beforeRequest(requestConfig, context)) ||
          requestConfig;
        context.config = requestConfig;
      }

      requestConfig = await this.validateRequestBody(requestConfig);
      context.config = requestConfig;

      const behavior = this.resolveBehavior(requestConfig);
      const kyOptions = this.toKyOptions(requestConfig, behavior);
      pendingRequest = this.registerPendingRequest(
        input,
        kyOptions,
        behavior.dedupe,
      );

      const response = await this.client(input, kyOptions);
      this.clearPendingRequest(pendingRequest);
      pendingRequest = undefined;

      let parsedResponse = await this.createParsedResponse<T>(
        response,
        requestConfig,
        behavior,
      );

      if (this.options.hooks?.afterResponse) {
        parsedResponse =
          (await this.options.hooks.afterResponse(parsedResponse, context)) ||
          parsedResponse;
      }

      if (behavior.responseType === "response") {
        return parsedResponse as T;
      }
      return parsedResponse.data as T;
    } catch (error) {
      this.clearPendingRequest(pendingRequest);
      const normalizedError = normalizeHttpError(error, requestConfig);
      await this.notifyErrorMessage(normalizedError, context);

      if (this.options.hooks?.beforeError) {
        const nextError = await this.options.hooks.beforeError(
          normalizedError,
          context,
        );
        throw nextError || normalizedError;
      }

      throw normalizedError;
    }
  }

  /** Validate the request body and use transformed schema output as the final body. */
  private async validateRequestBody<TBody, TResponse>(
    config: HttpRequestConfig<TBody, TResponse>,
  ): Promise<HttpRequestConfig<TBody, TResponse>> {
    if (!config.bodySchema) {
      return config;
    }

    const body = await validateWithSchema(config.bodySchema, config.body, {
      target: "request",
      config,
    });

    return {
      ...config,
      body: body as TBody,
    };
  }

  /** Normalize one request config so headers can be safely merged and edited. */
  private resolveConfig<TBody, TResponse>(
    config: HttpRequestConfig<TBody, TResponse>,
  ): HttpRequestConfig<TBody, TResponse> {
    return {
      ...config,
      headers: mergeHeaders(config.headers),
    };
  }

  /** Merge client defaults with request-level behavior. */
  private resolveBehavior(config: HttpRequestConfig): ResolvedRequestBehavior {
    const defaults = this.options.defaults || {};

    return {
      responseType:
        config.responseType ??
        defaults.responseType ??
        DEFAULT_BEHAVIOR.responseType,
      validateBusinessStatus:
        config.validateBusinessStatus ??
        defaults.validateBusinessStatus ??
        DEFAULT_BEHAVIOR.validateBusinessStatus,
      timestamp:
        config.timestamp ?? defaults.timestamp ?? DEFAULT_BEHAVIOR.timestamp,
      formatRequestData:
        config.formatRequestData ??
        defaults.formatRequestData ??
        DEFAULT_BEHAVIOR.formatRequestData,
      dedupe: config.dedupe ?? defaults.dedupe ?? DEFAULT_BEHAVIOR.dedupe,
      businessStatusValidator:
        config.businessStatusValidator ?? defaults.businessStatusValidator,
      onErrorMessage: config.onErrorMessage ?? defaults.onErrorMessage,
    };
  }

  /** Convert wrapper config into ky options, including query, body, retry, and method. */
  private toKyOptions(
    config: HttpRequestConfig,
    behavior: ResolvedRequestBehavior,
  ): Options {
    const hasExplicitRetry = config.retry !== undefined;
    const {
      body,
      dedupe,
      formatRequestData,
      query,
      responseType,
      bodySchema,
      responseSchema,
      businessStatusValidator,
      onErrorMessage,
      timestamp,
      validateBusinessStatus,
      ...kyOptions
    } = config;
    const method = (kyOptions.method || "GET") as HttpMethod;
    const headers = mergeHeaders(kyOptions.headers);
    const searchParams =
      method === "GET"
        ? appendTimestamp(createSearchParams(query), behavior.timestamp)
        : createSearchParams(query);
    const options: Options = {
      ...kyOptions,
      headers,
      method,
    };

    if (searchParams) {
      options.searchParams = searchParams;
    }

    if (!BODYLESS_METHODS.has(method) && body !== undefined) {
      const payload = this.applyBody(options, body, behavior, headers);
      this.disableUnsafeBodyRetry(options, payload, hasExplicitRetry);
    }

    return options;
  }

  /** Choose ky body or json mode based on the payload type. */
  private applyBody(
    options: Options,
    body: unknown,
    behavior: ResolvedRequestBehavior,
    headers: Headers,
  ): unknown {
    const payload = behavior.formatRequestData
      ? normalizeRequestData(body)
      : body;

    if (isBodyInit(payload)) {
      options.body = payload;
      // ky treats "undefined" as a deletion marker when merging Headers.
      // This avoids a default JSON content-type breaking FormData boundaries.
      if (isBoundaryManagedBody(payload) && !headers.has("content-type")) {
        headers.set("content-type", "undefined");
      }
      return payload;
    }

    if (
      headers.get("content-type")?.includes("application/x-www-form-urlencoded")
    ) {
      options.body = createUrlEncodedBody(payload);
      return options.body;
    }

    options.json = payload;
    return payload;
  }

  /** Disable inherited retries for streaming bodies and upload progress cases. */
  private disableUnsafeBodyRetry(
    options: Options,
    payload: unknown,
    hasExplicitRetry: boolean,
  ) {
    if (hasExplicitRetry || !shouldDisableInheritedRetry(payload, options)) {
      return;
    }

    // ky copies request bodies for retries; streaming uploads should avoid that.
    options.retry = { limit: 0 };
  }

  /** Parse the response, validate business wrappers, and apply response schema. */
  private async createParsedResponse<T>(
    response: Response,
    config: HttpRequestConfig,
    behavior: ResolvedRequestBehavior,
  ): Promise<ParsedHttpResponse<T>> {
    let data =
      behavior.responseType === "response"
        ? response
        : await parseResponseBody(
            response,
            behavior.responseType,
            config.parseJson ?? this.options.parseJson ?? safeJsonParse,
            config.method,
          );

    if (
      behavior.validateBusinessStatus &&
      behavior.responseType !== "response"
    ) {
      validateBusinessResult(
        data,
        response,
        config,
        behavior.businessStatusValidator,
      );
    }

    if (config.responseSchema && behavior.responseType !== "response") {
      data = await validateWithSchema(config.responseSchema, data, {
        target: "response",
        config,
        response,
      });
    }

    return Object.assign(response, {
      data,
      config: redactHttpRequestConfig(config),
    }) as ParsedHttpResponse<T>;
  }

  /** Register dedupe control and abort the previous request with the same key. */
  private registerPendingRequest(
    input: Input,
    options: Options,
    dedupe: DedupeOption | undefined,
  ): PendingRequest | undefined {
    if (!dedupe) {
      return undefined;
    }

    const method = String(options.method || "GET").toUpperCase() as HttpMethod;
    if (dedupe === true && !BODYLESS_METHODS.has(method)) {
      return undefined;
    }

    const key =
      typeof dedupe === "string" ? dedupe : createDedupeKey(input, options);
    this.pendingRequests
      .get(key)
      ?.abort(createAbortReason("Duplicate request canceled"));

    const controller = new AbortController();
    options.signal = combineSignals([options.signal, controller.signal]);
    this.pendingRequests.set(key, controller);
    return { key, controller };
  }

  /** Clear this request's dedupe entry without deleting a newer controller. */
  private clearPendingRequest(pendingRequest?: PendingRequest) {
    if (!pendingRequest) {
      return;
    }
    if (
      this.pendingRequests.get(pendingRequest.key) === pendingRequest.controller
    ) {
      this.pendingRequests.delete(pendingRequest.key);
    }
  }

  /** Notify application code about a normalized error message without masking the request error. */
  private async notifyErrorMessage(
    error: Error,
    context: { input: Input; config: HttpRequestConfig },
  ) {
    const handler =
      context.config.onErrorMessage ?? this.options.defaults?.onErrorMessage;
    if (!handler || !error.message) {
      return;
    }

    try {
      await handler(error.message, { ...context, error });
    } catch {
      // UI notification failures must not replace the original request error.
    }
  }
}

/** Create an HttpClient with optional configuration. */
export function createHttpClient(options?: HttpClientOptions): HttpClient {
  return new HttpClient(options);
}

/** Read the response body by responseType and handle empty responses. */
async function parseResponseBody(
  response: Response,
  responseType = "json",
  parseJson: ParseJson = safeJsonParse,
  method: HttpMethod = "GET",
): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  switch (responseType) {
    case "arrayBuffer":
      return response.arrayBuffer();
    case "blob":
      return response.blob();
    case "formData":
      return response.formData();
    case "text":
      return response.text();
    case "json": {
      const text = await response.text();
      return text
        ? parseJson(text, createJsonParseContext(response, method))
        : null;
    }
    default:
      return response;
  }
}

/** Safely parse JSON and drop keys that can participate in prototype pollution. */
function safeJsonParse(text: string): unknown {
  const value = deserializeValue(text);
  if (value === undefined) {
    throw new SyntaxError("Invalid JSON response");
  }
  return sanitizeJsonValue(value);
}

/** Recursively remove unsafe JSON keys after shared JSON parsing. */
function sanitizeJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeJsonValue);
  }
  if (!isPlainRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !UNSAFE_JSON_KEYS.has(key))
      .map(([key, item]) => [key, sanitizeJsonValue(item)]),
  );
}

/** Create the context object passed to ky-compatible parseJson functions. */
function createJsonParseContext(
  response: Response,
  method: HttpMethod,
): Parameters<ParseJson>[1] {
  return {
    request: createSyntheticRequest(response, method),
    response,
  };
}

/** Create a lightweight Request for custom JSON parsers that need method and URL. */
function createSyntheticRequest(
  response: Response,
  method: HttpMethod,
): Request {
  try {
    return new Request(response.url || "http://localhost/", { method });
  } catch {
    return new Request("http://localhost/", { method });
  }
}

/** Create a stable dedupe key from URL, method, baseUrl/prefix, and query. */
function createDedupeKey(input: Input, options: Options): string {
  const searchParams =
    options.searchParams instanceof URLSearchParams
      ? options.searchParams.toString()
      : String(options.searchParams || "");
  return [
    options.method || "GET",
    options.prefix || "",
    options.baseUrl || "",
    getInputKey(input),
    searchParams,
  ].join(" ");
}

/** Convert ky-supported input into a stable string key. */
function getInputKey(input: Input): string {
  if (input instanceof Request) {
    return input.url;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input;
}

/** Combine user and internal signals, preferring native AbortSignal.any. */
function combineSignals(
  signals: Array<AbortSignal | null | undefined>,
): AbortSignal {
  const validSignals = signals.filter(Boolean) as AbortSignal[];

  if (validSignals.length === 1) {
    return validSignals[0];
  }
  if (typeof AbortSignal.any === "function") {
    // eslint-disable-next-line baseline-js/use-baseline
    return AbortSignal.any(validSignals);
  }

  const controller = new AbortController();
  validSignals.forEach((signal) => {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), {
      once: true,
    });
  });
  return controller.signal;
}

/** Create a cross-runtime AbortError reason. */
function createAbortReason(message: string): Error {
  if (typeof DOMException !== "undefined") {
    return new DOMException(message, "AbortError");
  }
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

/** Merge ky-compatible headers while preserving the `undefined` deletion marker. */
function mergeHeaders(
  ...headersList: Array<HeaderSource | undefined>
): Headers {
  const headers = new Headers();

  headersList.forEach((headersInit) => {
    if (!headersInit) {
      return;
    }
    if (!(headersInit instanceof Headers) && !Array.isArray(headersInit)) {
      Object.entries(headersInit).forEach(([key, value]) => {
        if (value === undefined || value === "undefined") {
          headers.delete(key);
          return;
        }
        headers.set(key, value);
      });
      return;
    }
    new Headers(headersInit).forEach((value, key) => headers.set(key, value));
  });

  return headers;
}

/** Check whether a value can be sent directly as a Fetch body. */
function isBodyInit(value: unknown): value is FetchBody {
  return (
    typeof value === "string" ||
    isBoundaryManagedBody(value) ||
    value instanceof URLSearchParams ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    isReadableStream(value)
  );
}

/** Check whether Fetch should manage the body's Content-Type. */
function isBoundaryManagedBody(value: unknown): value is FormData | Blob {
  return (
    (typeof FormData !== "undefined" && value instanceof FormData) ||
    (typeof Blob !== "undefined" && value instanceof Blob)
  );
}

/** Check whether a value is a plain object created from JSON data. */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (Object.prototype.toString.call(value) !== "[object Object]") {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Detect streaming request bodies in runtimes that support ReadableStream. */
function isReadableStream(value: unknown): value is ReadableStream {
  return (
    typeof ReadableStream !== "undefined" && value instanceof ReadableStream
  );
}

/** Check whether the current body should not inherit the default retry policy. */
function shouldDisableInheritedRetry(
  payload: unknown,
  options: Options,
): boolean {
  return (
    isReadableStream(payload) || typeof options.onUploadProgress === "function"
  );
}

/** Merge parent and child ky hooks while preserving execution order. */
function mergeKyHooks(
  ...hooksList: Array<Options["hooks"] | undefined>
): Options["hooks"] | undefined {
  const merged: Record<string, unknown[]> = {};

  hooksList.forEach((hooks) => {
    if (!hooks) {
      return;
    }
    KY_HOOK_NAMES.forEach((hookName) => {
      const hookItems = hooks[hookName];
      if (!hookItems?.length) {
        return;
      }
      merged[hookName] = [...(merged[hookName] || []), ...hookItems];
    });
  });

  return Object.keys(merged).length > 0 ? (merged as KyHooks) : undefined;
}
