import { describe, expect, it } from "vitest";
import * as exports from "../src/index";

describe("index exports", () => {
  it("re-exports node utility modules", () => {
    expect(exports).toMatchObject({
      appExists: expect.any(Function),
      appExistsSync: expect.any(Function),
      checkProcessDiskAccess: expect.any(Function),
      createProcessGracefulExit: expect.any(Function),
      executeCommand: expect.any(Function),
      executeCommandSync: expect.any(Function),
      findMonorepoRoot: expect.any(Function),
      formatPath: expect.any(Function),
      getLocalhostAddress: expect.any(Function),
      pathExists: expect.any(Function),
      pathExistsSync: expect.any(Function),
      require: expect.any(Function),
      unifiedSpawn: expect.any(Function),
      unifiedSpawnAsync: expect.any(Function),
      unifiedSpawnSync: expect.any(Function),
      userHome: expect.any(String),
    });
  });
});
