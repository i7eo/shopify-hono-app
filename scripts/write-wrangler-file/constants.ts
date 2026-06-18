import path from "node:path";
import { findMonorepoRoot } from "@shamt/node-utils/monorepo";
import { throwError } from "../utils";
import type { ConfigSchema } from "@shamt/app-env";

export type WranglerFileConfig = ConfigSchema;

export const root = findMonorepoRoot();

if (!root) {
  throwError("write-wrangler-file", "Cannot find monorepo root");
}

export const wranglerPath = path.resolve(root, "apps/server/wrangler.json");
