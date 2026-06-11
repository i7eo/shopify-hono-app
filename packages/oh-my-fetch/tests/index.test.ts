import { describe, expect, it } from "vitest";
import { createHttpClient, HttpClient, HttpRequestError } from "../src";

describe("package entry", () => {
  it("exports only core runtime APIs", () => {
    expect(createHttpClient()).toBeInstanceOf(HttpClient);
    expect(new HttpRequestError("Failed")).toBeInstanceOf(Error);
  });

  it("exposes focused subpath entries", async () => {
    await expect(import("@shamt/oh-my-fetch/client")).resolves.toMatchObject({
      createHttpClient: expect.any(Function),
    });
    await expect(
      import("@shamt/oh-my-fetch/plugins/validation"),
    ).resolves.toMatchObject({
      validationPlugin: expect.any(Function),
    });
    await expect(import("@shamt/oh-my-fetch/json")).resolves.toMatchObject({
      parseJsonSafely: expect.any(Function),
    });
    await expect(import("@shamt/oh-my-fetch/dedupe")).resolves.toMatchObject({
      createDedupeManager: expect.any(Function),
    });
  });
});
