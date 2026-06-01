import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { defineConfig } from "rolldown";
import { dts as PluginDTS } from "rolldown-plugin-dts";
import { dependencies } from "./package.json";

const isDev = process.env.NODE_ENV === "development";
const sourcemap = !isDev;
const __dirname = dirname(fileURLToPath(import.meta.url));
const packageDir = "src";
const input = resolve(__dirname, "src/index.ts");
const outputDir = resolve(__dirname, "dist");

const common = defineConfig({
  platform: "node",
  input,
  external: Object.keys(dependencies),
});

export default defineConfig([
  {
    ...common,
    plugins: [
      PluginDTS({
        tsconfig: "./tsconfig.web.json",
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
    plugins: [
      PluginDTS({ tsconfig: "./tsconfig.web.json", emitDtsOnly: true }),
    ],
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
