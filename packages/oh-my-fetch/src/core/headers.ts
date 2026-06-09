import type { HeaderSource } from "../client/types";

/**
 * Merge ky-compatible headers while preserving the `undefined` deletion marker.
 *
 * @example
 * ```ts
 * const headers = mergeHeaders({ accept: "application/json" }, { accept: undefined });
 * headers.has("accept"); // false
 * ```
 */
export function mergeHeaders(
  ...headersList: Array<HeaderSource | undefined>
): Headers {
  const headers = new Headers();

  headersList.forEach((headersInit) => {
    if (!headersInit) {
      return;
    }
    if (!(headersInit instanceof Headers) && !Array.isArray(headersInit)) {
      Object.entries(headersInit).forEach(([key, value]) => {
        if (value === undefined || value === "undefined") {
          headers.delete(key);
          return;
        }
        headers.set(key, value);
      });
      return;
    }
    new Headers(headersInit).forEach((value, key) => headers.set(key, value));
  });

  return headers;
}
