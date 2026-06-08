import { DATE_TIME_FORMAT } from "./constants";
import type { MomentLike, QueryParams, QueryPrimitive } from "./types";

/** Check whether a value is a plain object without treating Date/FormData/Blob as plain data. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (Object.prototype.toString.call(value) !== "[object Object]") {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Detect moment/dayjs-compatible values and format request time fields consistently. */
function isMomentLike(value: unknown): value is MomentLike {
  return (
    isPlainObject(value) &&
    value._isAMomentObject === true &&
    typeof value.format === "function"
  );
}

/** Format Date as the backend-friendly `YYYY-MM-DD HH:mm:ss` string. */
function formatDate(value: Date): string {
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${[
    value.getFullYear(),
    pad(value.getMonth() + 1),
    pad(value.getDate()),
  ].join(
    "-",
  )} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
}

/** Convert query scalar values into URLSearchParams-compatible strings. */
function normalizeScalar(value: QueryPrimitive): string {
  if (value instanceof Date) {
    return formatDate(value);
  }
  if (value === null) {
    return "null";
  }
  return String(value);
}

/** Append one field to URLSearchParams, expanding arrays with bracket notation. */
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

/** Create URLSearchParams from a string, URLSearchParams, tuple array, or object. */
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

/** Append or replace the `_t` cache-busting query parameter when enabled. */
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
  next.set("_t", String(Date.now()));
  return next;
}

/** Normalize request data without mutating the caller-provided object. */
export function normalizeRequestData<T>(
  value: T,
  seen = new WeakSet<object>(),
): T {
  if (typeof value === "string") {
    return value.trim() as T;
  }
  if (value instanceof Date) {
    return formatDate(value) as T;
  }
  if (isMomentLike(value)) {
    return value.format(DATE_TIME_FORMAT) as T;
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      throw new TypeError("Circular request data is not supported");
    }
    seen.add(value);
    const normalized = value.map((item) =>
      normalizeRequestData(item, seen),
    ) as T;
    seen.delete(value);
    return normalized;
  }
  if (isPlainObject(value)) {
    if (seen.has(value)) {
      throw new TypeError("Circular request data is not supported");
    }
    seen.add(value);
    const normalized = Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        normalizeRequestData(item, seen),
      ]),
    ) as T;
    seen.delete(value);
    return normalized;
  }
  return value;
}

/** Serialize objects and arrays into URLSearchParams using bracket notation. */
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
