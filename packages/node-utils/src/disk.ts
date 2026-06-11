import { constants } from "node:fs";
import { access } from "node:fs/promises";

/**
 * Verify that the current process can read and write a disk path.
 *
 * @example
 * ```ts
 * const diskPath = await checkProcessDiskAccess(process.cwd());
 * ```
 */
export async function checkProcessDiskAccess(
  diskPath: string = process.cwd(),
): Promise<string> {
  await access(diskPath, constants.R_OK | constants.W_OK);
  return diskPath;
}
