import ky, { type Input, type KyInstance, type Options } from "ky";
import { applyRequestBody, disableUnsafeBodyRetry } from "../core/body";
import { mergeHeaders } from "../core/headers";
import { appendTimestamp, createSearchParams } from "../core/query";
import { createJsonParser, parseResponseBody } from "../core/response";
import { normalizeHttpError, redactHttpRequestConfig } from "../errors";
import { createAbortReason } from "../lifecycle/abort";
import { createDedupeManager, type DedupeManager } from "../lifecycle/dedupe";
import { RequestScope } from "../lifecycle/disposable";
import { validationPlugin } from "../plugins/validation";
import {
  BODYLESS_METHODS,
  DEFAULT_BEHAVIOR,
  DEFAULT_RETRY,
  KY_HOOK_NAMES,
} from "./constants";
import type {
  HttpClientOptions,
  HttpMethod,
  HttpPlugin,
  HttpRequestConfig,
  InferSchemaOutput,
  ParsedHttpResponse,
  RequestContext,
  UploadFileParams,
  ValidationSchema,
} from "../utils/types";
import type {
  BodyResponseConfig,
  KyHooks,
  ResolvedRequestBehavior,
  ResponseConfig,
} from "./types";

/**
 * Generic ky-based HTTP client with plugin-driven policies and scoped cleanup.
 *
 * @example
 * ```ts
 * const client = new HttpClient({ prefix: "/api" });
 * const user = await client.get<User>("users/current");
 * ```
 */
export class HttpClient {
  private readonly client: KyInstance;
  private readonly options: HttpClientOptions;
  private readonly plugins: readonly HttpPlugin[];
  private readonly dedupeManager: DedupeManager;
  private disposed = false;

  /**
   * Create a client with transport defaults, plugins, and dependency injection.
   *
   * @example
   * ```ts
   * const client = new HttpClient({
   *   deps: { fetch: customFetch },
   *   plugins: [requestFormatPlugin()],
   * });
   * ```
   */
  constructor(options: HttpClientOptions = {}) {
    const { defaults, hooks, kyHooks, plugins, deps, ...kyOptions } = options;
    const behavior = {
      ...DEFAULT_BEHAVIOR,
      ...defaults,
    };
    const parseJson =
      kyOptions.parseJson ?? createJsonParser(behavior.jsonSecurity);

    this.options = {
      ...options,
      parseJson,
      defaults: behavior,
    };
    this.plugins = [validationPlugin(), ...(plugins || [])];
    this.dedupeManager = createDedupeManager();
    this.client = ky.create({
      ...kyOptions,
      fetch: deps?.fetch ?? kyOptions.fetch,
      parseJson,
      retry: kyOptions.retry ?? DEFAULT_RETRY,
      hooks: kyHooks,
    });
  }

  /**
   * Access the underlying ky instance for native ky APIs.
   *
   * @example
   * ```ts
   * const response = await client.ky("https://example.com");
   * ```
   */
  get ky(): KyInstance {
    return this.client;
  }

  /**
   * Create a child client by merging defaults, headers, hooks, and plugins.
   *
   * @example
   * ```ts
   * const adminApi = client.extend({ prefix: "/admin" });
   * ```
   */
  extend(options: HttpClientOptions): HttpClient {
    return new HttpClient({
      ...this.options,
      ...options,
      deps: {
        ...this.options.deps,
        ...options.deps,
      },
      headers: mergeHeaders(this.options.headers, options.headers),
      defaults: {
        ...this.options.defaults,
        ...options.defaults,
      },
      hooks: {
        ...this.options.hooks,
        ...options.hooks,
      },
      plugins: [...this.plugins, ...(options.plugins || [])],
      kyHooks: mergeKyHooks(this.options.kyHooks, options.kyHooks),
    });
  }

  /**
   * Dispose client-owned resources and abort pending dedupe requests.
   *
   * @example
   * ```ts
   * const client = createHttpClient();
   * client.dispose();
   * ```
   */
  dispose(): void {
    this.disposed = true;
    this.dedupeManager.dispose();
    this.plugins.forEach((plugin) => plugin.dispose?.());
  }

  /**
   * Abort all currently pending dedupe-managed requests.
   *
   * @example
   * ```ts
   * client.abortAll("Route changed");
   * ```
   */
  abortAll(reason?: string): void {
    this.dedupeManager.abortAll(reason);
  }

  get<TSchema extends ValidationSchema>(
    input: Input,
    config: ResponseConfig<TSchema>,
  ): Promise<InferSchemaOutput<TSchema>>;
  /**
   * Send a GET request with optional query, parsing, and validation config.
   *
   * @example
   * ```ts
   * const users = await client.get<User[]>("/users", { query: { page: 1 } });
   * ```
   */
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

  post<TSchema extends ValidationSchema, TBody = unknown>(
    input: Input,
    body: TBody,
    config: BodyResponseConfig<TBody, TSchema>,
  ): Promise<InferSchemaOutput<TSchema>>;
  /**
   * Send a POST request with a JSON-like or Fetch-compatible body.
   *
   * @example
   * ```ts
   * const user = await client.post<User>("/users", { name: "Ada" });
   * ```
   */
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

  put<TSchema extends ValidationSchema, TBody = unknown>(
    input: Input,
    body: TBody,
    config: BodyResponseConfig<TBody, TSchema>,
  ): Promise<InferSchemaOutput<TSchema>>;
  /**
   * Send a PUT request with a JSON-like or Fetch-compatible body.
   *
   * @example
   * ```ts
   * await client.put("/users/1", { name: "Ada" });
   * ```
   */
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

  patch<TSchema extends ValidationSchema, TBody = unknown>(
    input: Input,
    body: TBody,
    config: BodyResponseConfig<TBody, TSchema>,
  ): Promise<InferSchemaOutput<TSchema>>;
  /**
   * Send a PATCH request with a JSON-like or Fetch-compatible body.
   *
   * @example
   * ```ts
   * await client.patch("/users/1", { name: "Ada" });
   * ```
   */
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

  delete<TSchema extends ValidationSchema>(
    input: Input,
    config: ResponseConfig<TSchema>,
  ): Promise<InferSchemaOutput<TSchema>>;
  /**
   * Send a DELETE request.
   *
   * @example
   * ```ts
   * await client.delete("/users/1");
   * ```
   */
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

  upload<TSchema extends ValidationSchema>(
    input: Input,
    params: UploadFileParams,
    config: BodyResponseConfig<FormData, TSchema>,
  ): Promise<InferSchemaOutput<TSchema>>;
  /**
   * Upload a Blob or File with FormData while leaving boundaries to Fetch.
   *
   * @example
   * ```ts
   * await client.upload("/assets", {
   *   file,
   *   fieldName: "image",
   *   filename: "cover.png",
   * });
   * ```
   */
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

  request<TSchema extends ValidationSchema, TBody = unknown>(
    input: Input,
    config: HttpRequestConfig<TBody, InferSchemaOutput<TSchema>> & {
      responseSchema: TSchema;
    },
  ): Promise<InferSchemaOutput<TSchema>>;
  /**
   * Send a low-level request when helper methods do not fit.
   *
   * @example
   * ```ts
   * const text = await client.request<string>("/health", { responseType: "text" });
   * ```
   */
  request<T = unknown, TBody = unknown>(
    input: Input,
    config?: HttpRequestConfig<TBody, T>,
  ): Promise<T>;
  async request<T = unknown, TBody = unknown>(
    input: Input,
    config: HttpRequestConfig<TBody, T> = {},
  ): Promise<T> {
    const scope = new RequestScope();
    let requestConfig = this.resolveConfig(config);
    const context: RequestContext<TBody, T> = {
      input,
      config: requestConfig,
      state: new Map(),
    };

    try {
      this.throwIfDisposed();
      requestConfig = await this.runBeforeRequest(requestConfig, context);
      context.config = requestConfig;
      this.throwIfDisposed();

      const behavior = this.resolveBehavior(requestConfig);
      const kyOptions = this.toKyOptions(input, requestConfig, behavior);
      this.dedupeManager.register(input, kyOptions, behavior.dedupe, scope);

      const response = await this.client(input, kyOptions);
      let parsedResponse = await this.createParsedResponse<T>(
        response,
        requestConfig,
        behavior,
      );

      parsedResponse = await this.runAfterResponse(parsedResponse, context);

      if (behavior.responseType === "response") {
        return parsedResponse as T;
      }
      return parsedResponse.data as T;
    } catch (error) {
      const normalizedError = normalizeHttpError(error, requestConfig);
      const nextError = await this.runBeforeError(normalizedError, context);
      throw nextError || normalizedError;
    } finally {
      scope.dispose();
    }
  }

  /**
   * Throw an abort reason when a disposed client is used.
   *
   * @example
   * ```ts
   * client.dispose();
   * // Subsequent requests fail before transport starts.
   * ```
   */
  private throwIfDisposed(): void {
    if (this.disposed) {
      throw createAbortReason("HTTP client disposed");
    }
  }

  /**
   * Run beforeRequest hooks and plugins in deterministic order.
   *
   * @example
   * ```ts
   * await this.runBeforeRequest(config, context);
   * ```
   */
  private async runBeforeRequest<TBody, TResponse>(
    config: HttpRequestConfig<TBody, TResponse>,
    context: RequestContext<TBody, TResponse>,
  ): Promise<HttpRequestConfig<TBody, TResponse>> {
    let nextConfig = config;

    if (this.options.hooks?.beforeRequest) {
      nextConfig =
        (await this.options.hooks.beforeRequest(nextConfig, context)) ||
        nextConfig;
      context.config = nextConfig;
    }

    for (const plugin of this.plugins) {
      if (!plugin.beforeRequest) {
        continue;
      }
      nextConfig =
        (await plugin.beforeRequest(nextConfig, context)) || nextConfig;
      context.config = nextConfig;
    }

    return nextConfig;
  }

  /**
   * Run afterResponse plugins and hooks after the body has been parsed.
   *
   * @example
   * ```ts
   * const response = await this.runAfterResponse(parsed, context);
   * ```
   */
  private async runAfterResponse<T>(
    response: ParsedHttpResponse<T>,
    context: RequestContext,
  ): Promise<ParsedHttpResponse<T>> {
    let nextResponse = response;

    for (const plugin of this.plugins) {
      if (!plugin.afterResponse) {
        continue;
      }
      nextResponse =
        (await plugin.afterResponse(nextResponse, context)) || nextResponse;
    }

    if (this.options.hooks?.afterResponse) {
      nextResponse =
        (await this.options.hooks.afterResponse(nextResponse, context)) ||
        nextResponse;
    }

    return nextResponse;
  }

  /**
   * Run error plugins and hooks before throwing the final error.
   *
   * @example
   * ```ts
   * const mapped = await this.runBeforeError(error, context);
   * ```
   */
  private async runBeforeError(
    error: Error,
    context: RequestContext,
  ): Promise<Error | void> {
    let nextError = error;

    for (const plugin of this.plugins) {
      if (!plugin.beforeError) {
        continue;
      }
      nextError = (await plugin.beforeError(nextError, context)) || nextError;
    }

    if (this.options.hooks?.beforeError) {
      return this.options.hooks.beforeError(nextError, context);
    }

    return nextError;
  }

  /**
   * Normalize one request config before plugins can inspect or mutate it.
   *
   * @example
   * ```ts
   * const config = this.resolveConfig({ headers: { accept: "application/json" } });
   * ```
   */
  private resolveConfig<TBody, TResponse>(
    config: HttpRequestConfig<TBody, TResponse>,
  ): HttpRequestConfig<TBody, TResponse> {
    return {
      ...config,
      headers: mergeHeaders(config.headers),
    };
  }

  /**
   * Merge per-request behavior with client defaults.
   *
   * @example
   * ```ts
   * const behavior = this.resolveBehavior({ responseType: "text" });
   * ```
   */
  private resolveBehavior(config: HttpRequestConfig): ResolvedRequestBehavior {
    const defaults = this.options.defaults || {};

    return {
      responseType:
        config.responseType ??
        defaults.responseType ??
        DEFAULT_BEHAVIOR.responseType,
      timestamp:
        config.timestamp ?? defaults.timestamp ?? DEFAULT_BEHAVIOR.timestamp,
      dedupe: config.dedupe ?? defaults.dedupe ?? DEFAULT_BEHAVIOR.dedupe,
      jsonSecurity:
        config.jsonSecurity ??
        defaults.jsonSecurity ??
        DEFAULT_BEHAVIOR.jsonSecurity,
    };
  }

  /**
   * Convert public request config into ky options.
   *
   * @example
   * ```ts
   * const options = this.toKyOptions(config, behavior);
   * ```
   */
  private toKyOptions(
    input: Input,
    config: HttpRequestConfig,
    behavior: ResolvedRequestBehavior,
  ): Options {
    const hasExplicitRetry = config.retry !== undefined;
    const {
      body,
      dedupe,
      query,
      responseType,
      bodySchema,
      responseSchema,
      timestamp,
      jsonSecurity,
      ...kyOptions
    } = config;
    const method = (kyOptions.method || "GET") as HttpMethod;
    // resolveConfig already normalized headers into a Headers instance; only
    // re-merge when a plugin replaced it with a raw object/array.
    const headers =
      kyOptions.headers instanceof Headers
        ? kyOptions.headers
        : mergeHeaders(kyOptions.headers);
    const searchParams =
      method === "GET"
        ? appendTimestamp(createSearchParams(query), behavior.timestamp)
        : createSearchParams(query);
    const options: Options = {
      ...kyOptions,
      headers,
      method,
      parseJson:
        kyOptions.parseJson ??
        this.options.parseJson ??
        createJsonParser(behavior.jsonSecurity),
    };

    if (searchParams) {
      options.searchParams = searchParams;
    }

    if (!BODYLESS_METHODS.has(method) && body !== undefined) {
      const payload = applyRequestBody(options, body, headers);
      disableUnsafeBodyRetry(options, payload, hasExplicitRetry);
    }

    if (isAbsoluteUrl(input)) {
      options.prefix = "";
      delete options.baseUrl;
    }

    return options;
  }

  /**
   * Attach parsed data and redacted config to the Fetch Response object.
   *
   * @example
   * ```ts
   * const parsed = await this.createParsedResponse(response, config, behavior);
   * parsed.config; // redacted request config
   * ```
   */
  private async createParsedResponse<T>(
    response: Response,
    config: HttpRequestConfig,
    behavior: ResolvedRequestBehavior,
  ): Promise<ParsedHttpResponse<T>> {
    const data =
      behavior.responseType === "response"
        ? response
        : await parseResponseBody(
            response,
            behavior.responseType,
            config.parseJson ??
              this.options.parseJson ??
              createJsonParser(behavior.jsonSecurity),
            config.method,
          );

    return Object.assign(response, {
      data,
      config: redactHttpRequestConfig(config),
    }) as ParsedHttpResponse<T>;
  }
}

/**
 * Create an HttpClient with optional defaults, plugins, and dependencies.
 *
 * @example
 * ```ts
 * const client = createHttpClient({ prefix: "/api" });
 * ```
 */
export function createHttpClient(options?: HttpClientOptions): HttpClient {
  return new HttpClient(options);
}

/**
 * Merge parent and child ky hooks while preserving execution order.
 *
 * @example
 * ```ts
 * mergeKyHooks({ beforeRequest: [a] }, { beforeRequest: [b] });
 * // beforeRequest runs a, then b.
 * ```
 */
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

const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+\-.]*:\/\//i;

function isAbsoluteUrl(input: Input): boolean {
  if (typeof input === "string") {
    return ABSOLUTE_URL_PATTERN.test(input);
  }

  if (input instanceof URL) return true;
  if (input instanceof Request) return true;

  return false;
}

export type { HttpClientOptions } from "../utils/types";
export type { HeaderSource } from "./types";
