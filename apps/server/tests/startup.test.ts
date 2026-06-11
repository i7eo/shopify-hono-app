import { afterEach, describe, expect, it, vi } from "vitest";

describe("onAppStartup", () => {
  afterEach(() => {
    vi.doUnmock("@shamt/utils");
    vi.resetModules();
  });

  it("awaits the startup placeholder sleep", async () => {
    let resolveSleep!: () => void;
    const sleep = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSleep = resolve;
        }),
    );
    vi.doMock("@shamt/utils", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@shamt/utils")>()),
      sleep,
    }));
    const { onAppStartup } = await import("@/app/lifecycle/startup");

    const startup = onAppStartup();
    let settled = false;
    startup.then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(sleep).toHaveBeenCalledWith(16.7);
    expect(settled).toBe(false);

    resolveSleep();
    await expect(startup).resolves.toBeUndefined();
    expect(settled).toBe(true);
  });
});
