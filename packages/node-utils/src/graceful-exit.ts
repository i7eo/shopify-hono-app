type MaybePromise<T> = T | Promise<T>;

export type ProcessGracefulExitLogger = {
  info: (...args: any[]) => unknown;
  warn: (...args: any[]) => unknown;
  error: (...args: any[]) => unknown;
};

export type GracefulExitTarget = {
  stop?: () => MaybePromise<void>;
  close?: (callback?: (error?: Error) => void) => MaybePromise<unknown>;
};

type RegisteredExitSignalListener = {
  signal: ExitSignal;
  listener: () => void;
};

/**
 * Process signals used to register graceful shutdown listeners.
 * SIGKILL (9) cannot be caught or ignored, so it is intentionally excluded.
 * - SIGINT: sent by Ctrl+C.
 * - SIGQUIT: sent by Ctrl+\.
 * - SIGTERM: sent by kill, Docker, and Kubernetes during normal termination.
 */
export const exitSignals = ["SIGINT", "SIGQUIT", "SIGTERM"] as const;
type ExitSignal = (typeof exitSignals)[number];

/**
 * Maximum graceful shutdown duration in milliseconds.
 * If cleanup does not finish in time, the process exits with code 1.
 */
export const SHUTDOWN_TIMEOUT_MS = 10000;

/**
 * Create a graceful exit controller with closure-scoped shutdown state.
 *
 * @example
 * ```ts
 * const server = serve({ fetch: app.fetch, port: 3000 });
 * const cleanup = setupCleanup(server);
 * const gracefulExit = createProcessGracefulExit(logger);
 *
 * const unregister = gracefulExit.register(cleanup);
 *
 * // Optional: remove registered process listeners during tests or hot reload.
 * unregister();
 *
 * // Optional: trigger shutdown manually.
 * await gracefulExit.shutdown(cleanup);
 * ```
 */
export function createProcessGracefulExit(
  logger: ProcessGracefulExitLogger = console,
) {
  let isShuttingDown = false;
  const registeredListeners: RegisteredExitSignalListener[] = [];

  /** Remove one process listener registered by this controller. */
  const removeRegisteredListener = ({
    signal,
    listener,
  }: RegisteredExitSignalListener) => {
    process.off(signal, listener);
  };

  /** Remove a group of listeners and keep the local registry in sync. */
  const removeRegisteredListeners = (
    listeners: RegisteredExitSignalListener[],
  ) => {
    listeners.forEach(removeRegisteredListener);
    const removed = new Set(listeners);

    for (let index = registeredListeners.length - 1; index >= 0; index -= 1) {
      if (removed.has(registeredListeners[index])) {
        registeredListeners.splice(index, 1);
      }
    }
  };

  /** Remove only listeners owned by this controller. */
  const removeAllRegisteredExitSignalListeners = () => {
    registeredListeners.forEach(removeRegisteredListener);
    registeredListeners.length = 0;
  };

  /** Run cleanup once and exit the process with the matching status code. */
  const shutdown = async (cleanup: () => Promise<void>) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    removeAllRegisteredExitSignalListeners();

    const timeout = setTimeout(() => {
      logger.warn("Graceful shutdown timeout, forcing exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    timeout.unref?.();

    try {
      await cleanup();
      logger.info("Graceful exit completed");
      clearTimeout(timeout);
      process.exit(0);
    } catch (error) {
      logger.error("Error during graceful shutdown", error);
      clearTimeout(timeout);
      process.exit(1);
    }
  };

  /** Register process signal listeners and return an unregister function. */
  const register = (cleanup: () => Promise<void>) => {
    // A controller owns one active set of signal listeners. Re-registering
    // replaces the previous set, so repeated calls (hot reload, tests) never
    // accumulate listeners or leave orphaned process handlers behind.
    removeAllRegisteredExitSignalListeners();

    const listeners = exitSignals.map((signal) => {
      const listener = async () => {
        await shutdown(cleanup);
      };
      process.on(signal, listener);
      return { signal, listener };
    });

    registeredListeners.push(...listeners);

    return () => removeRegisteredListeners(listeners);
  };

  /**
   * Create a cleanup function for worker or single-process runtimes.
   * The returned function closes the app handle first, then runs app shutdown disposers.
   *
   */
  const createCleanup = (
    app: GracefulExitTarget,
    callback?: () => Promise<void>,
  ) => {
    return async () => {
      try {
        await closeApp(app);
      } finally {
        callback && (await callback());
      }
    };
  };

  return {
    register,
    createCleanup,
    shutdown,
  };
}

/**
 * Close the runtime app handle when it exposes a supported stop or close API.
 * Callback-style close methods are converted to promises.
 *
 * @example
 * ```ts
 * await closeApp(server);
 * ```
 */
async function closeApp(app: GracefulExitTarget) {
  if (app.stop) {
    await app.stop();
    return;
  }

  if (app.close) {
    if (app.close.length > 0) {
      await new Promise<void>((resolve, reject) => {
        app.close?.((error?: Error) => (error ? reject(error) : resolve()));
      });
      return;
    }

    await app.close();
  }
}
