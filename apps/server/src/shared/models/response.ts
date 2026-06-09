import { z } from "@hono/zod-openapi";
import {
  RESPONSE_SUCCESS_CODE,
  RESPONSE_SUCCESS_MESSAGE,
  RESPONSE_SUCCESS_OK,
} from "@shamt/envs";

export type AppResponseOptions<T = unknown> = {
  message?: string;
  status?: number;
  data?: T | null;
  requestId?: string;
};

export type SuccessResponse<T = unknown> = {
  code: number;
  message: string;
  success: true;
  data: T | null;
  requestId?: string;
};

export class AppResponse<T = unknown> {
  message: string;
  code: number;
  success: true;
  data: T | null;
  requestId: string;

  constructor({ status, message, data, requestId }: AppResponseOptions<T>) {
    this.code = status ?? RESPONSE_SUCCESS_CODE;
    this.message = message ?? RESPONSE_SUCCESS_MESSAGE;
    this.success = RESPONSE_SUCCESS_OK;
    this.data = data ?? null;
    this.requestId = requestId ?? "";
  }
}

export function createResponse<T = unknown>(
  options: AppResponseOptions<T> = {},
): SuccessResponse<T> {
  return {
    code: options.status ?? RESPONSE_SUCCESS_CODE,
    message: options.message ?? RESPONSE_SUCCESS_MESSAGE,
    success: RESPONSE_SUCCESS_OK,
    data: options.data ?? null,
    requestId: options.requestId,
  };
}

export const ResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    code: z.number().openapi({ example: RESPONSE_SUCCESS_CODE }),
    message: z.string().openapi({ example: RESPONSE_SUCCESS_MESSAGE }),
    success: z.literal(true).openapi({ example: RESPONSE_SUCCESS_OK }),
    data: dataSchema.nullable().optional(),
    requestId: z.string().optional(),
  });
