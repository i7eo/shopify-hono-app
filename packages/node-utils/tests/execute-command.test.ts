import { describe, expect, it } from "vitest";
import { executeCommand, executeCommandSync } from "../src/execute-command";

describe("executeCommand", () => {
  it("resolves exit details for a successful command", async () => {
    await expect(
      executeCommand(process.execPath, ["--version"], { stdio: "ignore" }),
    ).resolves.toEqual({ code: 0, signal: null });
  });

  it("rejects when a command exits with a non-zero code", async () => {
    await expect(
      executeCommand(process.execPath, ["-e", "process.exit(3)"], {
        stdio: "ignore",
      }),
    ).rejects.toThrow("exit code 3");
  });

  it("supports synchronous execution", () => {
    expect(
      executeCommandSync(process.execPath, ["--version"], { stdio: "ignore" }),
    ).toEqual({ code: 0, signal: null });
  });
});
