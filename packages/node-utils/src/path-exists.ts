import fs, { promises as fsPromises } from "node:fs";

/**
 * Check whether a path exists.
 *
 * @example
 * ```ts
 * const exists = await pathExists("package.json");
 * ```
 */
export async function pathExists(path: string) {
  try {
    await fsPromises.access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Synchronously check whether a path exists.
 *
 * @example
 * ```ts
 * const exists = pathExistsSync("package.json");
 * ```
 */
export function pathExistsSync(path: string) {
  try {
    fs.accessSync(path);
    return true;
  } catch {
    return false;
  }
}
