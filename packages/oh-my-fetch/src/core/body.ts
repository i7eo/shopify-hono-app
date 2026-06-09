import { createUrlEncodedBody } from "./query";
import type { Options } from "ky";

type FetchBody = NonNullable<Options["body"]>;

/**
 * Apply a user body to ky options using the safest transport field.
 *
 * @example
 * ```ts
 * const options = { method: "POST", headers: new Headers() };
 * applyRequestBody(options, { name: "Ada" }, behavior, options.headers);
 * // options.json is now set for ky JSON serialization.
 * ```
 */
export function applyRequestBody(
  options: Options,
  body: unknown,
  headers: Headers,
): unknown {
  const payload = body;

  if (isBodyInit(payload)) {
    options.body = payload;
    if (isBoundaryManagedBody(payload) && !headers.has("content-type")) {
      headers.set("content-type", "undefined");
    }
    return payload;
  }

  if (
    headers.get("content-type")?.includes("application/x-www-form-urlencoded")
  ) {
    options.body = createUrlEncodedBody(payload);
    return options.body;
  }

  options.json = payload;
  return payload;
}

/**
 * Disable inherited retries for request bodies that cannot be safely replayed.
 *
 * @example
 * ```ts
 * const options = { method: "POST" };
 * disableUnsafeBodyRetry(options, stream, false);
 * // options.retry becomes { limit: 0 } for streaming uploads.
 * ```
 */
export function disableUnsafeBodyRetry(
  options: Options,
  payload: unknown,
  hasExplicitRetry: boolean,
) {
  if (hasExplicitRetry || !shouldDisableInheritedRetry(payload, options)) {
    return;
  }

  options.retry = { limit: 0 };
}

/**
 * Check whether a value can be passed directly to Fetch as `body`.
 *
 * @example
 * ```ts
 * isBodyInit(new URLSearchParams("a=1")); // true
 * isBodyInit({ a: 1 }); // false
 * ```
 */
export function isBodyInit(value: unknown): value is FetchBody {
  return (
    typeof value === "string" ||
    isBoundaryManagedBody(value) ||
    value instanceof URLSearchParams ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    isReadableStream(value)
  );
}

/**
 * Check whether Fetch must generate the request content type boundary.
 *
 * @example
 * ```ts
 * isBoundaryManagedBody(new FormData()); // true
 * ```
 */
export function isBoundaryManagedBody(
  value: unknown,
): value is FormData | Blob {
  return (
    (typeof FormData !== "undefined" && value instanceof FormData) ||
    (typeof Blob !== "undefined" && value instanceof Blob)
  );
}

/**
 * Detect ReadableStream bodies in runtimes that implement the Web Streams API.
 *
 * @example
 * ```ts
 * const stream = new ReadableStream();
 * isReadableStream(stream); // true
 * ```
 */
function isReadableStream(value: unknown): value is ReadableStream {
  return (
    typeof ReadableStream !== "undefined" && value instanceof ReadableStream
  );
}

/**
 * Decide whether retrying the current body could duplicate or corrupt upload work.
 *
 * @example
 * ```ts
 * shouldDisableInheritedRetry(stream, {}); // true
 * ```
 */
function shouldDisableInheritedRetry(
  payload: unknown,
  options: Options,
): boolean {
  return (
    isReadableStream(payload) || typeof options.onUploadProgress === "function"
  );
}
