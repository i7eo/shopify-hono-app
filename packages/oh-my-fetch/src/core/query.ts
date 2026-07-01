import {
  DATE_TIME_FORMAT,
  formatToDateTime,
  isDateObject,
  isPlainObject,
  timestamp,
} from "@unimolecule/utils";
import type { DayjsLike, QueryParams, QueryPrimitive } from "../utils/types";

type DateTimeInput = Parameters<typeof formatToDateTime>[0];

/**
 * Detect Day.js-compatible values without importing Day.js.
 *
 * @example
 * ```ts
 * isDayjsLike({ format: () => "2024-01-01" }); // true
 * ```
 */
function isDayjsLike(value: unknown): value is DayjsLike {
  return isPlainObject(value) && typeof value.format === "function";
}

/**
 * Convert one query scalar into a URLSearchParams-safe string.
 *
 * @example
 * ```ts
 * normalizeScalar(null); // "null"
 * normalizeScalar(1); // "1"
 * ```
 */
function normalizeScalar(value: QueryPrimitive): string {
  if (isDateObject(value)) {
    return formatToDateTime(value as DateTimeInput);
  }
  if (isDayjsLike(value)) {
    return value.format(DATE_TIME_FORMAT);
  }
  if (value === null) {
    return "null";
  }
  return String(value);
}

/**
 * Append one query field, expanding arrays with bracket notation.
 *
 * @example
 * ```ts
 * const params = new URLSearchParams();
 * appendParam(params, "tag", ["a", "b"]);
 * params.toString(); // "tag%5B%5D=a&tag%5B%5D=b"
 * ```
 */
function appendParam(
  searchParams: URLSearchParams,
  key: string,
  value: unknown,
) {
  if (value === undefined) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => appendParam(searchParams, `${key}[]`, item));
    return;
  }
  searchParams.append(key, normalizeScalar(value as QueryPrimitive));
}

/**
 * Build URLSearchParams from the supported query input shapes.
 *
 * @example
 * ```ts
 * createSearchParams({ page: 1, tags: ["a", "b"] })?.toString();
 * // "page=1&tags%5B%5D=a&tags%5B%5D=b"
 * ```
 */
export function createSearchParams(
  params?: QueryParams,
): URLSearchParams | undefined {
  if (!params) {
    return undefined;
  }

  const searchParams = new URLSearchParams();

  if (typeof params === "string") {
    const source = new URLSearchParams(params.replace(/^\?/, ""));
    source.forEach((value, key) => searchParams.append(key, value));
    return searchParams;
  }

  if (params instanceof URLSearchParams) {
    params.forEach((value, key) => searchParams.append(key, value));
    return searchParams;
  }

  if (Array.isArray(params)) {
    params.forEach(([key, value]) => appendParam(searchParams, key, value));
    return searchParams;
  }

  Object.entries(params).forEach(([key, value]) =>
    appendParam(searchParams, key, value),
  );
  return searchParams;
}

/**
 * Add or replace the `_t` cache-busting timestamp parameter.
 *
 * @example
 * ```ts
 * appendTimestamp(new URLSearchParams("page=1"))?.has("_t"); // true
 * ```
 */
export function appendTimestamp(
  searchParams: URLSearchParams | undefined,
  enabled = true,
) {
  if (!enabled) {
    return searchParams;
  }
  const next = searchParams
    ? new URLSearchParams(searchParams)
    : new URLSearchParams();
  next.set("_t", String(timestamp()));
  return next;
}

/**
 * Serialize JSON-like data into an application/x-www-form-urlencoded body.
 *
 * @example
 * ```ts
 * createUrlEncodedBody({ a: 1, b: ["x", "y"] }).toString();
 * // "a=1&b%5B%5D=x&b%5B%5D=y"
 * ```
 */
export function createUrlEncodedBody(data: unknown): URLSearchParams {
  const searchParams = new URLSearchParams();

  if (typeof data === "string" || data instanceof URLSearchParams) {
    return createSearchParams(data) || searchParams;
  }
  if (Array.isArray(data)) {
    data.forEach((value, index) =>
      appendParam(searchParams, String(index), value),
    );
    return searchParams;
  }
  if (isPlainObject(data)) {
    Object.entries(data).forEach(([key, value]) =>
      appendParam(searchParams, key, value),
    );
  }
  return searchParams;
}
