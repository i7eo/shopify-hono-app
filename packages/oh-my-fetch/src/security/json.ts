import { deserializeValue } from "@unimolecule/utils";
import { sanitizeJsonValue, sanitizeJsonValueShallow } from "./sanitize";
import type { JsonSecurityMode } from "../utils/types";

/**
 * Parse JSON and apply the configured prototype-pollution defense.
 *
 * @example
 * ```ts
 * parseJsonSafely('{"safe":true,"__proto__":{"polluted":true}}');
 * // { safe: true }
 * ```
 */
export function parseJsonSafely(
  text: string,
  security: JsonSecurityMode = "strict",
): unknown {
  const value = deserializeValue(text);
  if (value === undefined) {
    throw new SyntaxError("Invalid JSON response");
  }
  return applyJsonSecurity(value, security);
}

/**
 * Apply JSON security sanitization to an already parsed value.
 *
 * @example
 * ```ts
 * applyJsonSecurity({ constructor: {}, safe: true }, "shallow");
 * // { safe: true }
 * ```
 */
export function applyJsonSecurity(
  value: unknown,
  security: JsonSecurityMode = "strict",
): unknown {
  if (security === "off") {
    return value;
  }
  if (security === "shallow") {
    return sanitizeJsonValueShallow(value);
  }
  return sanitizeJsonValue(value);
}
