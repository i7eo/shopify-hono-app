import { constants } from "node:fs";
import { access } from "node:fs/promises";

export async function checkProcessDiskAccess(): Promise<string> {
  const diskPath = process.cwd();
  await access(diskPath, constants.R_OK | constants.W_OK);
  return diskPath;
}
