import { HTTP_STATUS_CODES } from "@shamt/envs/constants";
import type { HttpMethod, RequestBehavior } from "../utils/types";
import type { RetryOptions } from "ky";

export const DEFAULT_BEHAVIOR: Required<RequestBehavior> = {
  responseType: "json",
  timestamp: false,
  dedupe: false,
  jsonSecurity: "strict",
};

export const BODYLESS_METHODS = new Set<HttpMethod>(["GET", "HEAD"]);

export const KY_HOOK_NAMES = [
  "init",
  "beforeRequest",
  "beforeRetry",
  "beforeError",
  "afterResponse",
] as const;

export const DEFAULT_RETRY: RetryOptions = {
  limit: 2,
  methods: ["get", "put", "head", "delete"],
  statusCodes: [
    HTTP_STATUS_CODES.REQUEST_TIMEOUT.code,
    HTTP_STATUS_CODES.CONFLICT.code,
    HTTP_STATUS_CODES.TOO_MANY_REQUESTS.code,
    HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR.code,
    HTTP_STATUS_CODES.BAD_GATEWAY.code,
    HTTP_STATUS_CODES.SERVICE_UNAVAILABLE.code,
    HTTP_STATUS_CODES.GATEWAY_TIMEOUT.code,
  ],
  afterStatusCodes: [
    HTTP_STATUS_CODES.TOO_MANY_REQUESTS.code,
    HTTP_STATUS_CODES.SERVICE_UNAVAILABLE.code,
  ],
  retryOnTimeout: false,
  jitter: true,
  backoffLimit: 3000,
};
