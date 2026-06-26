import type { Logger } from "@/infra/logger";

/**
 * A request/job-scoped resource registry.
 *
 * Runtime-agnostic by design: it memoizes resources per scope and releases them
 * when the scope disposes. Isolate resources close their request-bound sockets;
 * process resources expose a no-op dispose (shared pools close at app teardown),
 * so callers never branch on runtime.
 */
export interface ResourceScope {
  /**
   * Resolves a resource once per scope, memoized by `key`. The optional
   * `dispose` runs (LIFO) when the scope is disposed. Repeated calls with the
   * same key reuse the in-flight or settled resource.
   */
  resolve: <T>(
    key: string,
    factory: () => T | Promise<T>,
    dispose?: (resource: T) => unknown,
  ) => Promise<T>;
  /**
   * Registers an ad-hoc cleanup that is not tied to a memoized resource
   * (e.g. aborting a multipart upload or cancelling a stream reader).
   */
  add: (disposer: () => unknown) => void;
  /**
   * Releases every registered cleanup in LIFO order. A failing disposer is
   * logged and skipped so one failure never strands the rest. Idempotent.
   */
  dispose: () => Promise<void>;
}

/**
 * Creates an empty resource scope. Pass a logger so disposer failures are
 * recorded instead of silently swallowed.
 *
 * @example
 * ```ts
 * const scope = createResourceScope(logger);
 * const db = await scope.resolve("database", () => factory(ctx), (d) => d.dispose());
 * await scope.dispose();
 * ```
 */
export function createResourceScope(
  logger?: Pick<Logger, "error">,
): ResourceScope {
  const cache = new Map<string, Promise<unknown>>();
  const disposers: Array<() => unknown> = [];

  return {
    resolve<T>(
      key: string,
      factory: () => T | Promise<T>,
      dispose?: (resource: T) => unknown,
    ): Promise<T> {
      const existing = cache.get(key) as Promise<T> | undefined;
      if (existing) {
        return existing;
      }

      const pending = Promise.resolve(factory()).then((resource) => {
        if (dispose) {
          disposers.push(() => dispose(resource));
        }
        return resource;
      });

      cache.set(key, pending);
      return pending;
    },

    add(disposer) {
      disposers.push(disposer);
    },

    async dispose() {
      for (let index = disposers.length - 1; index >= 0; index -= 1) {
        try {
          await disposers[index]?.();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          logger?.error(`Failed to dispose a scoped resource: ${message}`);
        }
      }

      disposers.length = 0;
      cache.clear();
    },
  };
}
