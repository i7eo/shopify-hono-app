import { HttpRequestError } from "../errors";
import { resolveStatusMessage } from "../status";
import type { HttpPlugin, HttpRequestConfig } from "../utils/types";

export interface BusinessFailureResult {
  failed: true;
  code?: number | string;
  status?: number;
  message?: string;
  data?: unknown;
}

export type BusinessCode = number | string;

export type BusinessStatusValidator = (
  data: unknown,
  response: Response,
  config: HttpRequestConfig,
) => boolean | BusinessFailureResult | null | undefined;

export interface ApiResult<T = unknown> {
  code?: number | string;
  type?: "success" | "error" | "warning";
  message?: string;
  msg?: string;
  result?: T;
  data?: T;
  success?: boolean;
}

export interface BusinessStatusPluginOptions {
  validator?: BusinessStatusValidator;
}

/**
 * Create an opt-in plugin that turns business response wrappers into request errors.
 *
 * @example
 * ```ts
 * const api = createHttpClient({
 *   plugins: [businessStatusPlugin()],
 * });
 * await api.get("/users");
 * ```
 */
export function businessStatusPlugin(
  options: BusinessStatusPluginOptions = {},
): HttpPlugin {
  return {
    name: "business-status",
    afterResponse: (response, context) => {
      if (context.config.responseType === "response") {
        return response;
      }
      validateBusinessResult(
        response.data,
        response,
        context.config,
        options.validator,
      );
      return response;
    },
  };
}

/**
 * Validate one parsed response value with the default or custom business validator.
 *
 * @example
 * ```ts
 * validateBusinessResult({ success: true }, response, config);
 * // Does not throw.
 * ```
 */
export function validateBusinessResult(
  data: unknown,
  response: Response,
  config: HttpRequestConfig,
  validator?: BusinessStatusValidator,
) {
  const failure = resolveBusinessFailure(data, response, config, validator);
  if (!failure) {
    return;
  }

  const failureData = failure.data ?? data;
  const code = failure.code ?? readApiCode(failureData);
  const status = resolveBusinessStatus(response, failure.status);
  throw new HttpRequestError(
    resolveStatusMessage(
      status,
      failure.message ?? readApiMessage(failureData),
    ),
    {
      kind: "business",
      code,
      status,
      data: failureData,
      response,
      config,
    },
  );
}

/**
 * Resolve a business failure from parsed data and normalize validator output.
 *
 * @example
 * ```ts
 * resolveBusinessFailure({ success: false }, response, config);
 * // { failed: true, data: ... }
 * ```
 */
function resolveBusinessFailure(
  data: unknown,
  response: Response,
  config: HttpRequestConfig,
  validator: BusinessStatusValidator = defaultBusinessStatusValidator,
): BusinessFailureResult | undefined {
  const result = validator(data, response, config);
  return normalizeBusinessFailureResult(result, data, readApiCode(data));
}

/**
 * Default business wrapper validator for common `{ success: false }` responses.
 *
 * @example
 * ```ts
 * defaultBusinessStatusValidator({ type: "error" });
 * // { failed: true, data: ... }
 * ```
 */
function defaultBusinessStatusValidator(
  data: unknown,
): BusinessFailureResult | false {
  if (!data || typeof data !== "object") {
    return false;
  }

  const result = data as ApiResult;
  if (result.success === false || result.type === "error") {
    return {
      failed: true,
      code: result.code,
      data,
    };
  }

  return false;
}

/**
 * Normalize boolean or structured validator results into one failure shape.
 *
 * @example
 * ```ts
 * normalizeBusinessFailureResult(true, { code: "FAIL" }, "FAIL");
 * // { failed: true, code: "FAIL", data: ... }
 * ```
 */
function normalizeBusinessFailureResult(
  result: boolean | BusinessFailureResult | null | undefined,
  data: unknown,
  code?: BusinessCode,
): BusinessFailureResult | undefined {
  if (result === true) {
    return {
      failed: true,
      code,
      data,
    };
  }
  if (!result) {
    return undefined;
  }
  return result.failed ? { ...result, code: result.code ?? code } : undefined;
}

/**
 * Resolve the status code that should be used for a business failure.
 *
 * @example
 * ```ts
 * resolveBusinessStatus(new Response(null, { status: 200 }), 409); // 409
 * ```
 */
function resolveBusinessStatus(
  response: Response,
  explicitStatus?: number,
): number {
  if (explicitStatus) {
    return explicitStatus;
  }
  return response.status;
}

/**
 * Read a human-facing message from common API response wrapper shapes.
 *
 * @example
 * ```ts
 * readApiMessage({ error: { message: "Nope" } }); // "Nope"
 * ```
 */
function readApiMessage(data: unknown): string {
  if (!data || typeof data !== "object") {
    return "";
  }
  const result = data as ApiResult & { error?: { message?: string } };
  return result.error?.message || result.msg || result.message || "";
}

/**
 * Read a business code from common API response wrapper shapes.
 *
 * @example
 * ```ts
 * readApiCode({ code: "SHOP_LOCKED" }); // "SHOP_LOCKED"
 * ```
 */
function readApiCode(data: unknown): number | string | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }
  return (data as ApiResult).code;
}
