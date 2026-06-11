import { dynamicRoutePatterns, wranglerPath } from "./constants";
import { executeCommand, readJsonFile, writeJsonFile } from "./utils";

/**
 * Build web assets and patch Wrangler static asset routing before deploy.
 */
async function main() {
  await executeCommand("pnpm", ["-F", "@shamt/web", "build"]);
  await writeWranglerAssets();
}

/**
 * Patch Wrangler config so Cloudflare serves the web build as Worker assets.
 */
async function writeWranglerAssets() {
  const wrangler = await readJsonFile<Record<string, unknown>>(wranglerPath);

  wrangler.assets = {
    directory: "../web/dist",
    not_found_handling: "single-page-application",
    binding: "ASSETS",
    run_worker_first: dynamicRoutePatterns,
  };

  await writeJsonFile(wranglerPath, wrangler);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
