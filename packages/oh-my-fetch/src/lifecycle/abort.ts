import type { Disposable, RequestScope } from "./disposable";

export interface CombinedSignal {
  signal: AbortSignal;
  dispose: () => void;
}

/**
 * Combine user and internal abort signals with disposable fallback listeners.
 *
 * @example
 * ```ts
 * const scope = new RequestScope();
 * const combined = combineAbortSignals([userSignal, internalSignal], scope);
 * fetch(url, { signal: combined.signal });
 * scope.dispose(); // Removes fallback listeners when AbortSignal.any is unavailable.
 * ```
 */
export function combineAbortSignals(
  signals: Array<AbortSignal | null | undefined>,
  scope?: RequestScope,
): CombinedSignal {
  const validSignals = signals.filter(Boolean) as AbortSignal[];

  if (validSignals.length === 0) {
    const controller = new AbortController();
    return { signal: controller.signal, dispose: () => undefined };
  }

  if (validSignals.length === 1) {
    return { signal: validSignals[0]!, dispose: () => undefined };
  }

  if (typeof AbortSignal.any === "function") {
    // eslint-disable-next-line baseline-js/use-baseline
    return { signal: AbortSignal.any(validSignals), dispose: () => undefined };
  }

  const controller = new AbortController();
  const listeners: Array<Disposable> = [];

  validSignals.forEach((signal) => {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return;
    }

    const listener = () => controller.abort(signal.reason);
    signal.addEventListener("abort", listener, { once: true });
    listeners.push({
      dispose: () => signal.removeEventListener("abort", listener),
    });
  });

  const combined = {
    signal: controller.signal,
    dispose: () => {
      listeners.forEach((listener) => listener.dispose());
      listeners.length = 0;
    },
  };
  scope?.add(combined);
  return combined;
}

/**
 * Create a cross-runtime AbortError-compatible reason object.
 *
 * @example
 * ```ts
 * const reason = createAbortReason("Request canceled");
 * reason.name; // "AbortError"
 * ```
 */
export function createAbortReason(message: string): Error {
  if (typeof DOMException !== "undefined") {
    return new DOMException(message, "AbortError");
  }
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

/**
 * Detect AbortError values across browser, Worker, and Node runtimes.
 *
 * @example
 * ```ts
 * isAbortError(new DOMException("stop", "AbortError")); // true
 * ```
 */
export function isAbortError(error: unknown): boolean {
  if (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "AbortError"
  ) {
    return true;
  }
  return error instanceof Error && error.name === "AbortError";
}
