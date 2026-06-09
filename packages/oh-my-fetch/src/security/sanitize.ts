export const UNSAFE_JSON_KEYS = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

/**
 * Recursively remove JSON keys that can participate in prototype pollution.
 *
 * @example
 * ```ts
 * sanitizeJsonValue({ nested: { __proto__: { polluted: true }, ok: 1 } });
 * // { nested: { ok: 1 } }
 * ```
 */
export function sanitizeJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeJsonValue);
  }
  if (!isPlainRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !UNSAFE_JSON_KEYS.has(key))
      .map(([key, item]) => [key, sanitizeJsonValue(item)]),
  );
}

/**
 * Remove unsafe JSON keys only from the top-level object.
 *
 * @example
 * ```ts
 * sanitizeJsonValueShallow({ __proto__: {}, ok: true });
 * // { ok: true }
 * ```
 */
export function sanitizeJsonValueShallow(value: unknown): unknown {
  if (!isPlainRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !UNSAFE_JSON_KEYS.has(key)),
  );
}

/**
 * Check whether a value is a plain object that can be safely enumerated.
 *
 * @example
 * ```ts
 * isPlainRecord(Object.create(null)); // true
 * isPlainRecord([]); // false
 * ```
 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (Object.prototype.toString.call(value) !== "[object Object]") {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
