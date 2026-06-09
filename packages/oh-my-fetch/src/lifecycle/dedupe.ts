import { BODYLESS_METHODS } from "../client/constants";
import { combineAbortSignals, createAbortReason } from "./abort";
import type { DedupeOption, HttpMethod } from "../utils/types";
import type { Disposable, RequestScope } from "./disposable";
import type { Input, Options } from "ky";

export interface DedupeManager extends Disposable {
  register: (
    input: Input,
    options: Options,
    dedupe: DedupeOption | undefined,
    scope: RequestScope,
  ) => void;
  abortAll: (reason?: string) => void;
}

/**
 * Create a dedupe manager that aborts older equivalent in-flight requests.
 *
 * @example
 * ```ts
 * const manager = createDedupeManager();
 * const scope = new RequestScope();
 * const options = { method: "GET" };
 * manager.register("/users", options, true, scope);
 * scope.dispose(); // Clears this request's pending entry.
 * ```
 */
export function createDedupeManager(): DedupeManager {
  const pendingRequests = new Map<string, AbortController>();

  return {
    register(input, options, dedupe, scope) {
      if (!dedupe) {
        return;
      }

      const method = String(
        options.method || "GET",
      ).toUpperCase() as HttpMethod;
      if (dedupe === true && !BODYLESS_METHODS.has(method)) {
        return;
      }

      const key =
        typeof dedupe === "string" ? dedupe : createDedupeKey(input, options);
      pendingRequests
        .get(key)
        ?.abort(createAbortReason("Duplicate request canceled"));

      const controller = new AbortController();
      const combined = combineAbortSignals(
        [options.signal, controller.signal],
        scope,
      );
      options.signal = combined.signal;
      pendingRequests.set(key, controller);

      scope.add(() => {
        if (pendingRequests.get(key) === controller) {
          pendingRequests.delete(key);
        }
      });
    },

    abortAll(reason = "HTTP client disposed") {
      pendingRequests.forEach((controller) => {
        controller.abort(createAbortReason(reason));
      });
      pendingRequests.clear();
    },

    dispose() {
      this.abortAll();
    },
  };
}

/**
 * Create a stable dedupe key from ky input, method, base URL, prefix, and query.
 *
 * @example
 * ```ts
 * createDedupeKey("/users", { method: "GET", searchParams: new URLSearchParams("page=1") });
 * ```
 */
function createDedupeKey(input: Input, options: Options): string {
  const searchParams =
    options.searchParams instanceof URLSearchParams
      ? options.searchParams.toString()
      : String(options.searchParams || "");
  return [
    options.method || "GET",
    options.prefix || "",
    options.baseUrl || "",
    getInputKey(input),
    searchParams,
  ].join(" ");
}

/**
 * Convert ky-supported input values into a stable string identity.
 *
 * @example
 * ```ts
 * getInputKey(new URL("https://example.com/users"));
 * // "https://example.com/users"
 * ```
 */
function getInputKey(input: Input): string {
  if (input instanceof Request) {
    return input.url;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input;
}
