import {
  RESPONSE_ERROR_CODE,
  RESPONSE_ERROR_MESSAGE,
  RESPONSE_ERROR_OK,
} from "@shamt/envs";

export type ErrorDetails = Record<string, unknown>;

export type AppErrorOptions<T = unknown> = {
  message?: string;
  status?: number;
  expose?: boolean;
  data?: T | null;
  details?: ErrorDetails;
  headers?: Record<string, string>;
  requestId?: string;
  stack?: string;
};

export type ErrorResponse<T = unknown> = {
  code: number;
  message: string;
  success: false;
  data: T | null;
  requestId?: string;
  details?: ErrorDetails;
};

export class AppError<T = unknown> extends Error {
  status: number;
  code: number;
  success: false;
  data: T | null;
  expose: boolean;
  details?: ErrorDetails;
  headers?: Record<string, string>;
  requestId: string;

  constructor(options: AppErrorOptions<T> = {}) {
    const message = options.message ?? RESPONSE_ERROR_MESSAGE;
    super(message);

    this.name = "AppError";
    this.status = options.status ?? RESPONSE_ERROR_CODE;
    this.code = this.status;
    this.success = RESPONSE_ERROR_OK;
    this.data = options.data ?? null;
    this.expose = options.expose ?? this.status < 500;
    this.details = options.details;
    this.headers = options.headers;
    this.requestId = options.requestId ?? "";
    this.stack = options.stack ?? this.stack;
  }
}

export function createError<T = unknown>(
  options: AppErrorOptions<T> = {},
): ErrorResponse<T> {
  return {
    code: options.status ?? RESPONSE_ERROR_CODE,
    message: options.message ?? RESPONSE_ERROR_MESSAGE,
    success: RESPONSE_ERROR_OK,
    data: options.data ?? null,
    requestId: options.requestId,
    details: options.details,
  };
}
