import { serializeValue } from "@unimolecule/utils";
import { normalizeError } from "@/shared/exceptions";
import { createErrorResponse } from "@/shared/exceptions/response";
import { getContextValue } from "@/utils";
import type { AppError } from "@/shared/models";
import type { AppEnv } from "@/typings";
import type { Context, Hono } from "hono";

export function onAppError(app: Hono<AppEnv>) {
  app.onError(async (error, c) => {
    const appError = normalizeError(error);
    await logError(c, appError);
    return createErrorResponse(c, appError);
  });
}

async function logError(c: Context<AppEnv>, error: AppError) {
  const record = {
    code: error.code,
    message: error.message,
    details: error.details,
    requestId: getContextValue(c, "requestId"),
    method: c.req.method,
    path: c.req.path,
  };
  const logger =
    getContextValue(c, "runtimeLogger") ??
    (await import("@/infra/logger")).default;

  logger.error(serializeValue(record));
}
