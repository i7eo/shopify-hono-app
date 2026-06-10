import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { defineConfig } from "rolldown";
import { dts as PluginDTS } from "rolldown-plugin-dts";
import { dependencies } from "./package.json";

const isDev = process.env.APP_ENV === "development";
const sourcemap = !isDev;
const __dirname = dirname(fileURLToPath(import.meta.url));
const packageDir = "src";
// Keep public subpath entries explicit so package exports do not drift.
const input = [
  "src/index.ts",
  "src/client/index.ts",
  "src/errors/index.ts",
  "src/status/index.ts",
  "src/validation/index.ts",
  "src/security/json.ts",
  "src/lifecycle/dedupe.ts",
  "src/plugins/business-status.ts",
  "src/plugins/error-reporter.ts",
  "src/plugins/request-format.ts",
  "src/plugins/validation.ts",
  "src/utils/index.ts",
].map((entry) => resolve(__dirname, entry));
const outputDir = resolve(__dirname, "dist");

const common = defineConfig({
  platform: "node",
  input,
  external: Object.keys(dependencies),
});

/**
 * Builds ESM, CJS, and declaration outputs for every public entrypoint.
 */
export default defineConfig([
  {
    ...common,
    plugins: [
      PluginDTS({
        tsconfig: "./tsconfig.json",
      }),
    ],
    output: {
      format: "esm",
      dir: `${outputDir}/esm`,
      preserveModules: true,
      preserveModulesRoot: packageDir,
      entryFileNames: "[name].mjs",
      chunkFileNames: "[name]-[hash].mjs",
      sourcemap,
    },
  },
  {
    ...common,
    output: {
      format: "cjs",
      dir: `${outputDir}/cjs`,
      preserveModules: true,
      preserveModulesRoot: packageDir,
      entryFileNames: "[name].cjs",
      chunkFileNames: "[name]-[hash].cjs",
      sourcemap,
    },
  },
  {
    ...common,
    plugins: [PluginDTS({ tsconfig: "./tsconfig.json", emitDtsOnly: true })],
    output: {
      format: "esm",
      dir: `${outputDir}/cjs`,
      preserveModules: true,
      preserveModulesRoot: packageDir,
      entryFileNames: "[name].cjs",
      chunkFileNames: "[name]-[hash].cjs",
      sourcemap,
    },
  },
]);
