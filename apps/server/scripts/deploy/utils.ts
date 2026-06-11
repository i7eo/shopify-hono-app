import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { deserializeValue, serializeValue } from "@shamt/utils";
import { root } from "./constants";

/**
 * Execute a child process from the monorepo root and fail on non-zero exit.
 */
export async function executeCommand(command: string, args: readonly string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: process.env,
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${command} ${args.join(" ")} failed with ${
            signal ? `signal ${signal}` : `exit code ${code}`
          }`,
        ),
      );
    });
  });
}

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

  return normalized || "shopify-hono-app";
}
