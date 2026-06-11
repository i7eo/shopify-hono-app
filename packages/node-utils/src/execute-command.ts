import { unifiedSpawn, unifiedSpawnSync } from "./unified-spawn.ts";
import type { SpawnOptions } from "node:child_process";

export type ExecuteCommandOptions = Pick<
  SpawnOptions,
  "cwd" | "env" | "shell" | "stdio" | "windowsHide"
> & {
  timeoutMs?: number;
};

export type ExecuteCommandResult = {
  code: number | null;
  signal: NodeJS.Signals | null;
};

const defaultStdio = "inherit";

/**
 * Create a consistent error for commands that exit unsuccessfully.
 *
 * @example
 * ```ts
 * const error = createCommandError("node", ["--bad-flag"], 9, null);
 * ```
 */
function createCommandError(
  command: string,
  args: readonly string[],
  code: number | null,
  signal: NodeJS.Signals | null,
) {
  return new Error(
    `${command} ${args.join(" ")} failed with ${
      signal ? `signal ${signal}` : `exit code ${code}`
    }`,
  );
}

/**
 * Execute a command and resolve when it exits with code 0.
 *
 * @example
 * ```ts
 * await executeCommand("pnpm", ["--version"], { stdio: "ignore" });
 * ```
 */
export async function executeCommand(
  command: string,
  args: readonly string[] = [],
  options: ExecuteCommandOptions = {},
): Promise<ExecuteCommandResult> {
  const {
    cwd = process.cwd(),
    env = process.env,
    shell = false,
    stdio = defaultStdio,
    timeoutMs,
    windowsHide = true,
  } = options;

  return await new Promise<ExecuteCommandResult>((resolve, reject) => {
    const child = unifiedSpawn(command, args, {
      cwd,
      env,
      shell,
      stdio,
      windowsHide,
    });
    let timeoutError: Error | undefined;

    const timeout =
      timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            timeoutError = new Error(
              `${command} ${args.join(" ")} timed out after ${timeoutMs}ms`,
            );
            child.kill();
          }, timeoutMs);
    timeout?.unref?.();

    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      child.off("error", onError);
      child.off("close", onClose);
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const onClose = (code: number | null, signal: NodeJS.Signals | null) => {
      cleanup();

      if (code === 0) {
        resolve({ code, signal });
        return;
      }

      reject(timeoutError ?? createCommandError(command, args, code, signal));
    };

    child.once("error", onError);
    child.once("close", onClose);
  });
}

/**
 * Execute a command synchronously and return its exit details when it succeeds.
 *
 * @example
 * ```ts
 * const result = executeCommandSync("node", ["--version"], { stdio: "ignore" });
 * console.log(result.code);
 * ```
 */
export function executeCommandSync(
  command: string,
  args: readonly string[] = [],
  options: ExecuteCommandOptions = {},
): ExecuteCommandResult {
  const {
    cwd = process.cwd(),
    env = process.env,
    shell = false,
    stdio = defaultStdio,
    timeoutMs,
    windowsHide = true,
  } = options;
  const result = unifiedSpawnSync(command, args, {
    cwd,
    env,
    shell,
    stdio,
    timeout: timeoutMs,
    windowsHide,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status === 0) {
    return {
      code: result.status,
      signal: result.signal,
    };
  }

  throw createCommandError(command, args, result.status, result.signal);
}
