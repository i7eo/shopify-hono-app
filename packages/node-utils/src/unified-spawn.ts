import {
  spawn,
  spawnSync,
  type SpawnOptions,
  type SpawnSyncOptions,
} from "node:child_process";

type UnifiedSpawnCommand = {
  command: string;
  args: readonly string[];
};

/**
 * Resolve a command and args for the current platform.
 *
 * @example
 * ```ts
 * const { command, args } = resolveUnifiedSpawnCommand("pnpm", ["--version"]);
 * ```
 */
function resolveUnifiedSpawnCommand(
  command: string,
  args: readonly string[] = [],
): UnifiedSpawnCommand {
  if (process.platform !== "win32") {
    return { command, args };
  }

  return {
    command: "cmd",
    args: ["/d", "/s", "/c", command, ...args],
  };
}

/**
 * Spawn a command with the workspace's Windows-compatible command wrapper.
 *
 * @example
 * ```ts
 * const child = unifiedSpawn("pnpm", ["--version"], { stdio: "ignore" });
 * ```
 */
export function unifiedSpawn(
  command: string,
  args: readonly string[] = [],
  options: SpawnOptions = {},
) {
  const resolved = resolveUnifiedSpawnCommand(command, args);

  return spawn(resolved.command, resolved.args, options);
}

/**
 * Synchronously spawn a command with the same Windows-compatible wrapper.
 *
 * @example
 * ```ts
 * const result = unifiedSpawnSync("node", ["--version"], { stdio: "ignore" });
 * ```
 */
export function unifiedSpawnSync(
  command: string,
  args: readonly string[] = [],
  options: SpawnSyncOptions = {},
) {
  const resolved = resolveUnifiedSpawnCommand(command, args);

  return spawnSync(resolved.command, resolved.args, options);
}

/**
 * Spawn a command and resolve with its close code.
 *
 * @example
 * ```ts
 * const code = await unifiedSpawnAsync("pnpm", ["--version"]);
 * ```
 */
export function unifiedSpawnAsync(
  command: string,
  args: readonly string[] = [],
  options: SpawnOptions = {},
) {
  return new Promise<number | null>((resolve, reject) => {
    const cp = unifiedSpawn(command, args, options);
    cp.once("error", reject);
    cp.once("close", (code) => resolve(code));
  });
}
