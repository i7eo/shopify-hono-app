import {
  DATE_TIME_FORMAT,
  formatToDateTime,
  isDateObject,
  isPlainObject,
} from "@unimolecule/utils";
import type { DayjsLike, HttpPlugin } from "../utils/types";

type DateTimeInput = Parameters<typeof formatToDateTime>[0];

export interface RequestFormatPluginOptions {
  trimStrings?: boolean;
  formatDates?: boolean;
}

/**
 * Create an opt-in plugin that normalizes request bodies before transport.
 *
 * @example
 * ```ts
 * const client = createHttpClient({
 *   plugins: [requestFormatPlugin()],
 * });
 * await client.post("/users", { name: " Ada " });
 * ```
 */
export function requestFormatPlugin(
  options: RequestFormatPluginOptions = {},
): HttpPlugin {
  const trimStrings = options.trimStrings ?? true;
  const formatDates = options.formatDates ?? true;

  return {
    name: "request-format",
    beforeRequest: (config) => {
      if (config.body === undefined) {
        return config;
      }
      return {
        ...config,
        body: normalizeRequestData(config.body, { trimStrings, formatDates }),
      };
    },
  };
}

/**
 * Recursively normalize request data without mutating the caller's object.
 *
 * @example
 * ```ts
 * normalizeRequestData({ name: " Ada " });
 * // { name: "Ada" }
 * ```
 */
export function normalizeRequestData<T>(
  value: T,
  // eslint-disable-next-line unicorn/no-object-as-default-parameter
  options: Required<RequestFormatPluginOptions> = {
    trimStrings: true,
    formatDates: true,
  },
  seen = new WeakSet<object>(),
): T {
  if (typeof value === "string") {
    return (options.trimStrings ? value.trim() : value) as T;
  }
  if (options.formatDates && isDateObject(value)) {
    return formatToDateTime(value as DateTimeInput) as T;
  }
  if (options.formatDates && isDayjsLike(value)) {
    return value.format(DATE_TIME_FORMAT) as T;
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      throw new TypeError("Circular request data is not supported");
    }
    seen.add(value);
    const normalized = value.map((item) =>
      normalizeRequestData(item, options, seen),
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
        normalizeRequestData(item, options, seen),
      ]),
    ) as T;
    seen.delete(value);
    return normalized;
  }
  return value;
}

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
