import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createProcessGracefulExit,
  exitSignals,
  type ProcessGracefulExitLogger,
} from "../src/graceful-exit";

function createLogger(): ProcessGracefulExitLogger {
  return {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };
}

describe("createProcessGracefulExit", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers and unregisters only its own signal listeners", () => {
    const logger = createLogger();
    const gracefulExit = createProcessGracefulExit(logger);
    const before = exitSignals.map((signal) => process.listenerCount(signal));
    const unregister = gracefulExit.register(() => Promise.resolve());

    exitSignals.forEach((signal, index) => {
      expect(process.listenerCount(signal)).toBe(before[index] + 1);
    });

    unregister();

    exitSignals.forEach((signal, index) => {
      expect(process.listenerCount(signal)).toBe(before[index]);
    });
  });

  it("runs stop before the optional shutdown callback", async () => {
    const gracefulExit = createProcessGracefulExit(createLogger());
    const calls: string[] = [];
    const cleanup = gracefulExit.createCleanup(
      {
        stop: () => {
          calls.push("stop");
          return Promise.resolve();
        },
      },
      () => {
        calls.push("callback");
        return Promise.resolve();
      },
    );

    await cleanup();

    expect(calls).toEqual(["stop", "callback"]);
  });

  it("wraps callback-style close methods", async () => {
    const gracefulExit = createProcessGracefulExit(createLogger());
    const cleanup = gracefulExit.createCleanup({
      close: (callback?: (error?: Error) => void) => {
        callback?.();
      },
    });

    await expect(cleanup()).resolves.toBeUndefined();
  });

  it("exits successfully after cleanup completes", async () => {
    const logger = createLogger();
    const gracefulExit = createProcessGracefulExit(logger);
    const exit = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);

    await gracefulExit.shutdown(() => Promise.resolve());

    expect(logger.info).toHaveBeenCalledWith("Graceful exit completed");
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("exits with failure when cleanup rejects", async () => {
    const logger = createLogger();
    const gracefulExit = createProcessGracefulExit(logger);
    const error = new Error("cleanup failed");
    const exit = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);

    await gracefulExit.shutdown(() => Promise.reject(error));

    expect(logger.error).toHaveBeenCalledWith(
      "Error during graceful shutdown",
      error,
    );
    expect(exit).toHaveBeenCalledWith(1);
  });
});
