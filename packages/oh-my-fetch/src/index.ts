import { createHttpClient } from "./client";

export { createHttpClient, HttpClient } from "./client";
export { HttpRequestError } from "./errors";
export { HTTP_METHODS, RESPONSE_BODY_TYPES } from "./utils/constants";
export type { HttpRequestErrorKind } from "./errors/types";
export type {
  ApiResult,
  BusinessCode,
  BusinessFailureResult,
  BusinessStatusValidator,
  DedupeOption,
  ErrorMessageHandler,
  HttpClientHooks,
  HttpClientOptions,
  HttpMethod,
  HttpRequestConfig,
  HttpTransportConfig,
  InferSchemaOutput,
  ParsedHttpResponse,
  QueryParams,
  RedactedHttpRequestConfig,
  RequestBehavior,
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
