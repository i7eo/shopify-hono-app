import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { AppError } from "@/shared/models";
import { internalServerError, unprocessableEntityError } from "./errors";

/**
 * Convert any thrown value into AppError before building the HTTP response.
 * Use only from global error handling; business code should throw AppError helpers directly.
 */
export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof ZodError) {
    return unprocessableEntityError("Validation failed", {
      details: {
        cause: error,
        issues: error.issues,
      },
    });
  }

  if (error instanceof HTTPException) {
    return new AppError({
      status: error.status,
      message: error.message,
      expose: error.status < 500,
      details: { cause: error },
    });
  }

  return internalServerError("Unhandled application error", {
    details: {
      cause: error,
      ...getUnknownErrorDetails(error),
    },
  });
}

/**
 * Extract safe debug metadata from an unknown runtime error.
 * The returned object is stored under details and is not exposed in production.
 */
function getUnknownErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    value: String(error),
  };
}
