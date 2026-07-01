import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { deserializeValue, serializeValue } from "@unimolecule/utils";
import { root } from "./constants";

/**
 * Read a JSON file through the shared deserialize helper.
 */
export async function readJsonFile<T>(filePath: string): Promise<T> {
  const value = deserializeValue<T>(await readFile(filePath, "utf8"));

  if (value === undefined) {
    throw new Error(`Invalid JSON file: ${path.relative(root, filePath)}`);
  }

  return value;
}

/**
 * Write a JSON file through the shared serialize helper.
 */
export async function writeJsonFile(filePath: string, value: unknown) {
  await writeFile(filePath, `${serializeValue(value)}\n`);
}

/**
 * Convert a package name into a Docker-safe base name.
 */
export function sanitizePackageName(name: string) {
  const normalized = name
    .replace(/^@/, "")
    .replaceAll("/", "-")
    .replaceAll(/[^\w.-]/g, "-")
    .toLowerCase();

  return normalized;
}

/**
 * Error type used by scripts to prefix failures with a scope.
 */
class AppServerScriptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppServerScriptError";
  }
}

/**
 * Throw a scoped script error and stop execution.
 */
export function throwError(scope: string, message: string): never {
  throw new AppServerScriptError(`[${scope}] ${message}`);
}
