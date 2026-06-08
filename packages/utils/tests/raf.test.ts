import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  rafDebounce,
  rafSetInterval,
  rafSetTimeout,
  rafThrottle,
} from "../src/raf";

function installRafMock() {
  let nextHandle = 0;
  const timers = new Map<number, ReturnType<typeof setTimeout>>();

  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: () => void) => {
      const handle = ++nextHandle;
      const timer = setTimeout(() => {
        timers.delete(handle);
        callback();
      }, 16);
      timers.set(handle, timer);
      return handle;
    }),
  );
  vi.stubGlobal(
    "cancelAnimationFrame",
    vi.fn((handle: number) => {
      const timer = timers.get(handle);
      if (timer) {
        clearTimeout(timer);
        timers.delete(handle);
      }
    }),
  );
}

describe("raf utilities", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    installRafMock();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("runs a callback once after a raf-driven timeout", async () => {
    const callback = vi.fn();
    const cancel = rafSetTimeout(callback, 30);

    await vi.advanceTimersByTimeAsync(16);
    expect(callback).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(16);
    expect(callback).toHaveBeenCalledTimes(1);

    cancel();
  });

  it("cancels a raf-driven timeout", async () => {
    const callback = vi.fn();
    const cancel = rafSetTimeout(callback, 30);

    cancel();
    await vi.advanceTimersByTimeAsync(64);

    expect(callback).not.toHaveBeenCalled();
  });

  it("runs and cancels a raf-driven interval", async () => {
    const callback = vi.fn();
    const cancel = rafSetInterval(callback, 30);

    await vi.advanceTimersByTimeAsync(32);
    expect(callback).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(32);
    expect(callback).toHaveBeenCalledTimes(2);

    cancel();
    await vi.advanceTimersByTimeAsync(64);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("debounces calls and keeps the latest arguments", async () => {
    const callback = vi.fn();
    const debounced = rafDebounce(callback, 30);

    debounced("first");
    await vi.advanceTimersByTimeAsync(16);
    debounced("latest");
    await vi.advanceTimersByTimeAsync(16);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("latest");

    debounced("cancelled");
    debounced.cancel();
    await vi.advanceTimersByTimeAsync(64);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("throttles calls and can cancel pending work", async () => {
    const callback = vi.fn();
    const throttled = rafThrottle(callback, 30);

    throttled("first");
    await vi.advanceTimersByTimeAsync(16);
    expect(callback).toHaveBeenCalledWith("first");

    throttled("second");
    throttled("latest");
    await vi.advanceTimersByTimeAsync(16);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith("latest");

    throttled("cancelled");
    throttled.cancel();
    await vi.advanceTimersByTimeAsync(64);
    expect(callback).toHaveBeenCalledTimes(2);
  });
});
