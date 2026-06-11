import { describe, expect, it } from "vitest";
import {
  unifiedSpawn,
  unifiedSpawnAsync,
  unifiedSpawnSync,
} from "../src/unified-spawn";

describe("unifiedSpawn", () => {
  it("spawns a child process with default options", async () => {
    const child = unifiedSpawn(process.execPath, ["--version"], {
      stdio: "ignore",
    });

    await new Promise<void>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code) => {
        expect(code).toBe(0);
        resolve();
      });
    });
  });

  it("resolves with the child close code", async () => {
    await expect(
      unifiedSpawnAsync(process.execPath, ["-e", "process.exit(7)"], {
        stdio: "ignore",
      }),
    ).resolves.toBe(7);
  });

  it("supports synchronous spawning", () => {
    const result = unifiedSpawnSync(process.execPath, ["--version"], {
      stdio: "ignore",
    });

    expect(result.status).toBe(0);
  });
});
