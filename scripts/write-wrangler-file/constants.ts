import path from "node:path";
import { DEFAULT_ENVS, type ConfigSchema } from "@shamt/app-env";
import { findMonorepoRoot } from "@shamt/node-utils/monorepo";
import { throwError } from "../utils";

export type WranglerFileConfig = ConfigSchema;

export const root = findMonorepoRoot();

if (!root) {
  throwError("write-wrangler-file", "Cannot find monorepo root");
}

export const wranglerPath = path.resolve(root, "apps/server/wrangler.json");

export function getCloudflareAppName(
  appEnv: WranglerFileConfig["APP_ENV"],
  appBaseName: WranglerFileConfig["APP_CLOUDFLARE_WORKER_NAME"],
) {
  if (appEnv === DEFAULT_ENVS.PRODUCTION) return appBaseName;

  return `${appBaseName}-${getCloudflareEnvironmentSuffix(appEnv)}`;
}

function getCloudflareEnvironmentSuffix(appEnv: WranglerFileConfig["APP_ENV"]) {
  if (appEnv === DEFAULT_ENVS.DEVELOPMENT) return "dev";

  return appEnv;
}
