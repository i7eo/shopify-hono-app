import { throwError } from "./error";
import { isServer } from "./is";

type RafCallback = (...args: any[]) => void | Promise<void>;

function raf(callback: RafCallback): number {
  if (isServer) {
    return setTimeout(async () => {
      await callback();
    }, 0);
  } else {
    return requestAnimationFrame(callback);
  }
}

function cancelRaf(handle: number): void {
  if (isServer) {
    clearTimeout(handle);
  } else {
    cancelAnimationFrame(handle);
  }
}

/**
 * 使用 Raf 实现 setTimeout
 * @param callback
 * @param delay
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
 * 使用 Raf 实现 setInterval
 * @param callback
 * @param interval
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
 * 使用 Raf 实现 debounce
 * @param callback
 * @param delay
 * @example
 * const debouncedCallback = rafDebounce(() => {
 *   console.log('debouncedCallback');
 * }, 1000);
 * debouncedCallback('123');
 * debouncedCallback('456');
 * debouncedCallback.cancel();
 */
export function rafDebounce(callback: RafCallback, delay: number) {
  let handle: number;
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

      // 如果在执行期间有新的调用，执行最后一次调用
      if (pendingArgs) {
        const args = pendingArgs;
        pendingArgs = null;
        execute(args);
      }
    }
  };

  const debounced = (...args: any[]) => {
    cancelRaf(handle);

    // 存储最新的参数
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
 * 使用 Raf 实现 throttle
 * @param callback
 * @param interval
 * @example
 * const throttledCallback = rafThrottle(() => {
 *   console.log('throttledCallback');
 * }, 1000);
 * throttledCallback('123');
 * throttledCallback('456');
 * throttledCallback.cancel();
 */
export function rafThrottle(callback: RafCallback, interval: number) {
  let handle: number;
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

      // 如果在执行期间有新的调用，执行最后一次调用
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
      // 存储最新的参数
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
