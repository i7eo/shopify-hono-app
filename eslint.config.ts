import {
  baseline,
  command,
  presetBasic,
  presetLangsExtensions,
  prettier,
  specialCases,
  // astro,
  vue,
} from "@sxzz/eslint-config";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  ...presetBasic().filter((rule) => rule.name !== '"sxzz/node"'),
  ...presetLangsExtensions(),
  ...prettier(),
  ...command(),
  ...baseline(),
  ...specialCases(),
  ...vue(),
  {
    rules: {
      "node/prefer-global/process": "off",
      "no-useless-assignment": "off",
      "import/no-default-export": "off",
    },
  },
  globalIgnores(["**/public/"]),
  {
    files: ["**/*.config.ts"],
    rules: {
      "baseline-js/use-baseline": "off",
    },
  },
  {
    files: ["**/*.vue"],
    rules: {
      "vue/singleline-html-element-content-newline": "off",
    },
  },
]);
