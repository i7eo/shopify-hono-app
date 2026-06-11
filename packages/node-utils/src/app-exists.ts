import {
  executeCommand,
  executeCommandSync,
  type ExecuteCommandOptions,
} from "./execute-command.ts";

export type AppExistsOptions = Pick<
  ExecuteCommandOptions,
  "cwd" | "env" | "timeoutMs"
>;

/**
 * Build the platform-specific command used to check PATH availability.
 *
 * @example
 * ```ts
 * const [command, args] = getCommandProbe("node");
 * ```
 */
function getCommandProbe(
  app: string,
): [command: string, args: readonly string[]] {
  if (process.platform === "win32") {
    return ["where.exe", [app]];
  }

  return ["sh", ["-c", 'command -v -- "$1"', "sh", app]];
}

/**
 * Check whether an executable app is available on the current PATH.
 *
 * @example
 * ```ts
 * const hasShopify = await appExists("shopify");
 * ```
 */
export async function appExists(
  app: string,
  options: AppExistsOptions = {},
): Promise<boolean> {
  if (!app) return false;

  const [command, args] = getCommandProbe(app);

  try {
    await executeCommand(command, args, { ...options, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Synchronously check whether an executable app is available on the current PATH.
 *
 * @example
 * ```ts
 * const hasNode = appExistsSync("node");
 * ```
 */
export function appExistsSync(
  app: string,
  options: AppExistsOptions = {},
): boolean {
  if (!app) return false;

  const [command, args] = getCommandProbe(app);

  try {
    executeCommandSync(command, args, { ...options, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
