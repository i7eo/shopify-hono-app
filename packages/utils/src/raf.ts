import { throwError } from "./error";

type RafHandle = number | ReturnType<typeof setTimeout>;
type RafCallback = (...args: any) => void | Promise<void>;

const scope = globalThis as typeof globalThis & {
  requestAnimationFrame?: (callback: () => void) => number;
  cancelAnimationFrame?: (handle: number) => void;
};

/** Schedule a callback with requestAnimationFrame when available, otherwise setTimeout. */
function raf(callback: RafCallback): RafHandle {
  if (scope.requestAnimationFrame) {
    return scope.requestAnimationFrame(async () => await callback());
  }

  return setTimeout(async () => await callback(), 0);
}

/** Cancel a scheduled raf-compatible callback. */
function cancelRaf(handle: RafHandle): void {
  if (typeof handle === "number" && scope.cancelAnimationFrame) {
    scope.cancelAnimationFrame(handle);
    return;
  }

  clearTimeout(handle as ReturnType<typeof setTimeout>);
}

/**
 * Run a callback once after delay using raf-compatible scheduling.
 *
 * @param callback - Callback to execute.
 * @param delay - Delay in milliseconds.
 * @example
 * const cancelTimeout = rafSetTimeout(() => {
 *   console.log('setTimeout');
 * }, 1000);
 * cancelTimeout()
 */
export function rafSetTimeout(callback: RafCallback, delay: number) {
  let lastTime = performance.now();
  let isExecuted = false;

  const loop = async () => {
    const now = performance.now();
    if (now - lastTime >= delay && !isExecuted) {
      isExecuted = true;
      try {
        await callback();
      } catch (error: any) {
        throwError("rafSetTimeout", `Callback error is: ${error}`);
      } finally {
        isExecuted = false;
        lastTime = performance.now();
      }
    } else if (!isExecuted) {
      handle = raf(loop);
    }
  };
  let handle = raf(loop);

  const cancel = () => {
    cancelRaf(handle);
    isExecuted = false;
  };
  return cancel;
}

/**
 * Run a callback repeatedly with raf-compatible scheduling.
 *
 * @param callback - Callback to execute.
 * @param interval - Interval in milliseconds.
 * @example
 * const cancelInterval = rafSetInterval(() => {
 *   console.log('setInterval');
 * }, 1000);
 * cancelInterval()
 */
export function rafSetInterval(callback: RafCallback, interval: number) {
  let lastTime = performance.now();
  let isExecuted = false;

  const loop = async () => {
    const now = performance.now();
    if (now - lastTime >= interval && !isExecuted) {
      lastTime = now;
      isExecuted = true;
      try {
        await callback();
      } catch (error: any) {
        throwError("rafSetInterval", `Callback error is: ${error}`);
      } finally {
        isExecuted = false;
      }
    }
    handle = raf(loop);
  };
  let handle = raf(loop);

  const cancel = () => {
    cancelRaf(handle);
    isExecuted = false;
  };
  return cancel;
}

/**
 * Create a debounced callback driven by raf-compatible scheduling.
 *
 * @param callback - Callback to debounce.
 * @param delay - Debounce delay in milliseconds.
 * @example
 * const debouncedCallback = rafDebounce(() => {
 *   console.log('debouncedCallback');
 * }, 1000);
 * debouncedCallback('123');
 * debouncedCallback('456');
 * debouncedCallback.cancel();
 */
export function rafDebounce(callback: RafCallback, delay: number) {
  let handle: RafHandle;
  let lastTime = 0;
  let isExecuted = false;
  let pendingArgs: any[] | null = null;

  const execute = async (args: any[]) => {
    if (isExecuted) return;

    try {
      isExecuted = true;
      await callback(...args);
    } catch (error: any) {
      throwError("rafDebounce", `Callback error: ${error}`);
    } finally {
      isExecuted = false;
      lastTime = performance.now();

      // Run the latest call if another invocation arrived during execution.
      if (pendingArgs) {
        const args = pendingArgs;
        pendingArgs = null;
        execute(args);
      }
    }
  };

  const debounced = (...args: any[]) => {
    cancelRaf(handle);

    // Store the latest arguments for the delayed execution.
    pendingArgs = args;

    const loop = () => {
      const now = performance.now();
      if (now - lastTime >= delay && !isExecuted) {
        if (pendingArgs) {
          const argsToUse = pendingArgs;
          pendingArgs = null;
          execute(argsToUse);
        }
      } else {
        handle = raf(loop);
      }
    };

    handle = raf(loop);
  };

  const cancel = () => {
    cancelRaf(handle);
    isExecuted = false;
    pendingArgs = null;
  };
  debounced.cancel = cancel;

  return debounced;
}

/**
 * Create a throttled callback driven by raf-compatible scheduling.
 *
 * @param callback - Callback to throttle.
 * @param interval - Minimum interval between executions in milliseconds.
 * @example
 * const throttledCallback = rafThrottle(() => {
 *   console.log('throttledCallback');
 * }, 1000);
 * throttledCallback('123');
 * throttledCallback('456');
 * throttledCallback.cancel();
 */
export function rafThrottle(callback: RafCallback, interval: number) {
  let handle: RafHandle;
  let lastTime = 0;
  let isExecuted = false;
  let pendingArgs: any[] | null = null;

  const execute = async (args: any[]) => {
    if (isExecuted) return;

    try {
      isExecuted = true;
      await callback(...args);
    } catch (error: any) {
      throwError("rafThrottle", `Callback error: ${error}`);
    } finally {
      isExecuted = false;
      lastTime = performance.now();

      // Run the latest call if another invocation arrived during execution.
      if (pendingArgs) {
        const args = pendingArgs;
        pendingArgs = null;
        execute(args);
      }
    }
  };

  const throttled = (...args: any[]) => {
    const now = performance.now();

    if (now - lastTime >= interval && !isExecuted) {
      execute(args);
    } else {
      // Store the latest arguments for the delayed execution.
      pendingArgs = args;

      cancelRaf(handle);
      handle = raf(() => {
        if (pendingArgs) {
          const argsToUse = pendingArgs;
          pendingArgs = null;
          execute(argsToUse);
        }
      });
    }
  };

  const cancel = () => {
    cancelRaf(handle);
    isExecuted = false;
    pendingArgs = null;
  };
  throttled.cancel = cancel;

  return throttled;
}
