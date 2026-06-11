import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  findMonorepoRoot,
  getPackage,
  getPackages,
  getPackagesSync,
} from "../src/monorepo";

const tempDirs: string[] = [];

async function createWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "node-utils-workspace-"));
  tempDirs.push(root);

  await mkdir(join(root, "packages", "one"), { recursive: true });
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ name: "workspace", private: true }),
  );
  await writeFile(
    join(root, "pnpm-workspace.yaml"),
    "packages:\n  - packages/*\n",
  );
  await writeFile(
    join(root, "packages", "one", "package.json"),
    JSON.stringify({ name: "@scope/one", version: "1.0.0" }),
  );

  return root;
}

describe("monorepo helpers", () => {
  afterEach(async () => {
    await Promise.all(
      tempDirs
        .splice(0)
        .map((dir) => rm(dir, { force: true, recursive: true })),
    );
  });

  it("finds a pnpm workspace root from a nested directory", async () => {
    const root = await createWorkspace();
    const nested = join(root, "packages", "one");

    expect(findMonorepoRoot(nested)).toBe(root);
  });

  it("returns an empty string when no root marker exists", async () => {
    const dir = await mkdtemp(join(tmpdir(), "node-utils-no-workspace-"));
    tempDirs.push(dir);

    expect(findMonorepoRoot(dir)).toBe("");
  });

  it("loads packages from an explicit workspace directory", async () => {
    const root = await createWorkspace();

    expect(getPackagesSync(root).packages).toHaveLength(1);
    await expect(getPackages(root)).resolves.toMatchObject({
      rootDir: root,
    });
    await expect(getPackage("@scope/one", root)).resolves.toMatchObject({
      packageJson: { name: "@scope/one" },
    });
  });
});
