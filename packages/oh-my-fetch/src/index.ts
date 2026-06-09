import { createHttpClient } from "./client";

export { createHttpClient, HttpClient } from "./client";
export { HttpRequestError } from "./errors";
export { createDedupeManager } from "./lifecycle/dedupe";
export { RequestScope } from "./lifecycle/disposable";
export {
  businessStatusPlugin,
  errorReporterPlugin,
  requestFormatPlugin,
  validationPlugin,
} from "./plugins";
export { applyJsonSecurity, parseJsonSafely } from "./security/json";
export { HTTP_METHODS, RESPONSE_BODY_TYPES } from "./utils/constants";
export type { HttpRequestErrorKind } from "./errors/types";
export type {
  ApiResult,
  BusinessCode,
  BusinessFailureResult,
  BusinessStatusPluginOptions,
  BusinessStatusValidator,
  RequestFormatPluginOptions,
} from "./plugins";
export type {
  DedupeOption,
  ErrorReporter,
  HttpClientDependencies,
  HttpClientHooks,
  HttpClientOptions,
  HttpMethod,
  HttpPlugin,
  HttpRequestConfig,
  HttpTransportConfig,
  InferSchemaOutput,
  JsonSecurityMode,
  ParsedHttpResponse,
  QueryParams,
  RedactedHttpRequestConfig,
  RequestBehavior,
  RequestContext,
  ResponseBodyType,
  RetryOptions,
  SafeParseSchema,
  StandardSchema,
  UploadFileParams,
  ValidationAdapter,
  ValidationContext,
  ValidationFailure,
  ValidationFunction,
  ValidationResult,
  ValidationSchema,
  ValidationSuccess,
  ValidationTarget,
  YupLikeSchema,
} from "./utils/types";
export const httpClient = createHttpClient();
