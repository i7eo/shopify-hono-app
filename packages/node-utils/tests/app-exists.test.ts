import { describe, expect, it } from "vitest";
import { appExists, appExistsSync } from "../src/app-exists";

const missingCommand = "shamt-node-utils-command-that-does-not-exist";

describe("appExists", () => {
  it("resolves true when an executable is available", async () => {
    await expect(appExists(process.execPath)).resolves.toBe(true);
  });

  it("resolves false for a missing command", async () => {
    await expect(appExists(missingCommand)).resolves.toBe(false);
  });

  it("supports a sync command probe", () => {
    expect(appExistsSync(process.execPath)).toBe(true);
    expect(appExistsSync(missingCommand)).toBe(false);
  });

  it("returns false for an empty command", async () => {
    await expect(appExists("")).resolves.toBe(false);
    expect(appExistsSync("")).toBe(false);
  });
});
