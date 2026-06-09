import { HttpRequestError } from "../errors";
import { VALIDATION_ERROR_CODE, VALIDATION_ERROR_MESSAGE } from "./constants";
import type {
  SafeParseResult,
  StandardSchemaResult,
  ValidationAdapter,
  ValidationFailure,
  ValidationFunction,
  ValidationResult,
  ValidationSchema,
  YupLikeSchema,
} from "../utils/types";
import type { ValidateWithSchemaOptions } from "./types";

/**
 * Validate data with a pluggable schema and normalize failures as HttpRequestError.
 *
 * @example
 * ```ts
 * await validateWithSchema((value) => String(value).trim(), " Ada ", {
 *   target: "request",
 *   config: {},
 * });
 * // "Ada"
 * ```
 */
export async function validateWithSchema<T>(
  schema: ValidationSchema<T>,
  value: unknown,
  options: ValidateWithSchemaOptions,
): Promise<T> {
  const result = await runValidation(schema, value, options);

  if (result.success) {
    return result.data;
  }

  throw new HttpRequestError(
    `${VALIDATION_ERROR_MESSAGE}: ${formatValidationFailure(result)}`,
    {
      kind:
        options.target === "request"
          ? "request_validation"
          : "response_validation",
      code: VALIDATION_ERROR_CODE,
      status: VALIDATION_ERROR_CODE,
      data: result.issues,
      response: options.response,
      config: options.config,
      cause: result.cause,
    },
  );
}

/**
 * Run validation in adapter, Standard Schema, Zod-like, function, and Yup-like order.
 *
 * @example
 * ```ts
 * await runValidation({ safeParse: () => ({ success: true, data: 1 }) }, "1", options);
 * ```
 */
async function runValidation<T>(
  schema: ValidationSchema<T>,
  value: unknown,
  options: ValidateWithSchemaOptions,
): Promise<ValidationResult<T>> {
  try {
    if (isValidationAdapter<T>(schema)) {
      return schema.validateSchema(value, options);
    }
    if (isStandardSchema<T>(schema)) {
      return normalizeStandardSchemaResult(
        await schema["~standard"].validate(value),
      );
    }
    if (isSafeParseSchema<T>(schema)) {
      const result = schema.safeParseAsync
        ? await schema.safeParseAsync(value)
        : schema.safeParse!(value);
      return normalizeSafeParseResult(result);
    }
    if (isValidationFunction<T>(schema)) {
      return normalizeValidationFunctionResult(await schema(value, options));
    }
    if (isYupLikeSchema<T>(schema)) {
      return {
        success: true,
        data: await schema.validate(value),
      };
    }
  } catch (error) {
    return {
      success: false,
      issues: readValidationIssues(error),
      message: readValidationMessage(error),
      cause: error,
    };
  }

  return {
    success: false,
    message: "Unsupported validation schema",
    cause: schema,
  };
}

/**
 * Check whether the schema is an explicit validation adapter.
 *
 * @example
 * ```ts
 * isValidationAdapter({ validateSchema: () => ({ success: true, data: 1 }) });
 * // true
 * ```
 */
function isValidationAdapter<T>(
  schema: unknown,
): schema is ValidationAdapter<T> {
  return isRecord(schema) && typeof schema.validateSchema === "function";
}

/**
 * Check whether the schema is Standard Schema compatible.
 *
 * @example
 * ```ts
 * isStandardSchema({ "~standard": { validate: () => ({ value: 1 }) } });
 * // true
 * ```
 */
function isStandardSchema<T>(schema: unknown): schema is {
  "~standard": {
    validate: (
      value: unknown,
    ) => Promise<StandardSchemaResult<T>> | StandardSchemaResult<T>;
  };
} {
  return (
    isRecord(schema) &&
    isRecord(schema["~standard"]) &&
    typeof schema["~standard"].validate === "function"
  );
}

/**
 * Check whether the schema is a Zod-like safeParse schema.
 *
 * @example
 * ```ts
 * isSafeParseSchema({ safeParse: () => ({ success: true, data: 1 }) });
 * // true
 * ```
 */
function isSafeParseSchema<T>(schema: unknown): schema is {
  safeParseAsync?: (
    value: unknown,
  ) => Promise<SafeParseResult<T>> | SafeParseResult<T>;
  safeParse?: (value: unknown) => SafeParseResult<T>;
} {
  return (
    isRecord(schema) &&
    (typeof schema.safeParseAsync === "function" ||
      typeof schema.safeParse === "function")
  );
}

/**
 * Check whether the schema is a function validator.
 *
 * @example
 * ```ts
 * isValidationFunction((value) => value); // true
 * ```
 */
function isValidationFunction<T>(
  schema: unknown,
): schema is ValidationFunction<T> {
  return typeof schema === "function";
}

/**
 * Check whether the schema is a Yup-like validate schema.
 *
 * @example
 * ```ts
 * isYupLikeSchema({ validate: async (value) => value }); // true
 * ```
 */
function isYupLikeSchema<T>(schema: unknown): schema is YupLikeSchema<T> {
  return isRecord(schema) && typeof schema.validate === "function";
}

/**
 * Normalize a Standard Schema result into the internal ValidationResult shape.
 *
 * @example
 * ```ts
 * normalizeStandardSchemaResult({ value: 1 });
 * // { success: true, data: 1 }
 * ```
 */
function normalizeStandardSchemaResult<T>(
  result: StandardSchemaResult<T>,
): ValidationResult<T> {
  if ("issues" in result && result.issues) {
    return {
      success: false,
      issues: result.issues,
      message: formatIssueList(result.issues),
    };
  }
  return {
    success: true,
    data: result.value,
  };
}

/**
 * Normalize a Zod-like safeParse result into the internal ValidationResult shape.
 *
 * @example
 * ```ts
 * normalizeSafeParseResult({ success: true, data: 1 });
 * // { success: true, data: 1 }
 * ```
 */
function normalizeSafeParseResult<T>(
  result: SafeParseResult<T>,
): ValidationResult<T> {
  if (result.success) {
    return result;
  }

  return {
    success: false,
    issues: readValidationIssues(result.error),
    message: readValidationMessage(result.error),
    cause: result.error,
  };
}

/**
 * Normalize a function validator result into the internal ValidationResult shape.
 *
 * @example
 * ```ts
 * normalizeValidationFunctionResult("ok");
 * // { success: true, data: "ok" }
 * ```
 */
function normalizeValidationFunctionResult<T>(
  result: T | ValidationResult<T>,
): ValidationResult<T> {
  if (isValidationResult<T>(result)) {
    return result;
  }
  return {
    success: true,
    data: result,
  };
}

/**
 * Check whether a value already uses the internal ValidationResult shape.
 *
 * @example
 * ```ts
 * isValidationResult({ success: false, message: "Invalid" }); // true
 * ```
 */
function isValidationResult<T>(value: unknown): value is ValidationResult<T> {
  return (
    isRecord(value) &&
    typeof value.success === "boolean" &&
    ("data" in value ||
      "issues" in value ||
      "message" in value ||
      "cause" in value)
  );
}

/**
 * Read issues or errors from third-party validation errors.
 *
 * @example
 * ```ts
 * readValidationIssues({ issues: [{ message: "Invalid" }] });
 * // [{ message: "Invalid" }]
 * ```
 */
function readValidationIssues(error: unknown): unknown {
  if (!isRecord(error)) {
    return error;
  }
  if ("issues" in error) {
    return error.issues;
  }
  if ("errors" in error) {
    return error.errors;
  }
  return error;
}

/**
 * Read a message from third-party validation errors.
 *
 * @example
 * ```ts
 * readValidationMessage(new Error("Invalid")); // "Invalid"
 * ```
 */
function readValidationMessage(error: unknown): string | undefined {
  if (isRecord(error) && typeof error.message === "string") {
    return error.message;
  }
  return undefined;
}

/**
 * Format a validation failure into one compact message.
 *
 * @example
 * ```ts
 * formatValidationFailure({ success: false, message: "Invalid" });
 * // "Invalid"
 * ```
 */
function formatValidationFailure(error: ValidationFailure): string {
  return error.message || formatIssues(error.issues) || "Validation failed";
}

/**
 * Format an issue list or a single issue-like object.
 *
 * @example
 * ```ts
 * formatIssues([{ message: "Required" }]); // "Required"
 * ```
 */
function formatIssues(issues: unknown): string {
  if (Array.isArray(issues)) {
    return formatIssueList(issues);
  }
  if (issues === undefined || issues === null) {
    return "";
  }
  if (isRecord(issues) && typeof issues.message === "string") {
    return issues.message;
  }
  return String(issues);
}

/**
 * Join multiple issues in `path message` form.
 *
 * @example
 * ```ts
 * formatIssueList([{ path: ["name"], message: "Required" }]);
 * // "name Required"
 * ```
 */
function formatIssueList(issues: readonly unknown[]): string {
  return issues.map(formatIssue).filter(Boolean).join("; ");
}

/**
 * Format one Standard/Zod/Yup issue.
 *
 * @example
 * ```ts
 * formatIssue({ path: ["name"], message: "Required" });
 * // "name Required"
 * ```
 */
function formatIssue(issue: unknown): string {
  if (!isRecord(issue)) {
    return String(issue);
  }

  const path = Array.isArray(issue.path) ? issue.path.join(".") : "";
  const message =
    typeof issue.message === "string" ? issue.message : String(issue);
  return path ? `${path} ${message}` : message;
}

/**
 * Check whether a value is an object with readable fields.
 *
 * @example
 * ```ts
 * isRecord({ ok: true }); // true
 * isRecord(null); // false
 * ```
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
