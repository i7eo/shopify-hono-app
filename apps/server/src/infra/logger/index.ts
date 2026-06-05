import {
  configure,
  getConsoleSink,
  getLogger,
  jsonLinesFormatter,
  withFilter,
  type LogLevel,
} from "@logtape/logtape";
import {
  DEFAULT_APP_LOGGER_DIR,
  DEFAULT_ENVS,
  DEFAULT_LOG_LEVEL,
  DEFAULT_LOGGER_LEVELS,
  DEFAULT_RUNTIMES,
  type DEFAULT_LOGGER_LEVELS_VALUES,
} from "@shamt/envs";
import { name } from "../../../package.json";
import type { RuntimeConfig } from "@/configs/runtime";

const NODE_LOG_FILE_NAMES = {
  warn: "warn.log",
  error: "error.log",
} as const;
type NodeLogFilePaths = Record<keyof typeof NODE_LOG_FILE_NAMES, string>;

let loggerConfigured = false;

export async function setupBootstrapLogger(): Promise<void> {
  if (loggerConfigured) return;

  await configure({
    sinks: {
      console: getConsoleSink({ formatter: jsonLinesFormatter }),
    },
    loggers: [
      {
        category: ["logtape", "meta"],
        sinks: ["console"],
        lowestLevel: "warning",
      },
      {
        category: name,
        lowestLevel: DEFAULT_LOG_LEVEL,
        sinks: ["console"],
      },
    ],
  });
  loggerConfigured = true;
}

/**
 * 初始化 Logger。仅 production 的 Node runtime 写入 APP_LOGGER_DIR/warn.log 和 error.log；
 * 其他环境只使用 LogTape 的 console sink，避免触碰文件系统能力。
 */
export async function setupLogger(
  config?: RuntimeConfig,
  options: { reset?: boolean } = {},
): Promise<void> {
  const runtimeConfig = config ?? (await getNodeRuntimeConfig());
  const reset = options.reset ?? loggerConfigured;

  if (
    runtimeConfig.APP_RUNTIME === DEFAULT_RUNTIMES.NODE &&
    runtimeConfig.APP_ENV === DEFAULT_ENVS.PRODUCTION
  ) {
    await setupNodeLogger(runtimeConfig, reset);
  } else {
    await setupConsoleLogger(runtimeConfig, reset);
  }
  loggerConfigured = true;
}

async function setupNodeLogger(
  config: RuntimeConfig,
  reset: boolean,
): Promise<void> {
  const logFilePaths = await resolveNodeLogFilePaths(config);
  await configure({
    reset,
    sinks: {
      console: getConsoleSink({ formatter: jsonLinesFormatter }),
      warnFile: withFilter(
        await getNodeFileSink(logFilePaths.warn, {
          maxSize: config.APP_LOGGER_MAX_SIZE,
          maxFiles: 1,
        }),
        "warning",
      ),
      errorFile: withFilter(
        await getNodeFileSink(logFilePaths.error, {
          maxSize: config.APP_LOGGER_MAX_SIZE,
          maxFiles: 1,
        }),
        "error",
      ),
    },
    loggers: [
      {
        category: ["logtape", "meta"],
        sinks: ["console"],
        lowestLevel: "warning",
      },
      {
        category: name,
        lowestLevel: toLogTapeLevel(config.APP_LOGGER_LEVEL),
        sinks: ["console", "warnFile", "errorFile"],
      },
    ],
  });
}

async function setupConsoleLogger(
  config: RuntimeConfig,
  reset: boolean,
): Promise<void> {
  await configure({
    reset,
    sinks: {
      console: getConsoleSink({ formatter: jsonLinesFormatter }),
    },
    loggers: [
      {
        category: ["logtape", "meta"],
        sinks: ["console"],
        lowestLevel: "warning",
      },
      {
        category: name,
        lowestLevel: toLogTapeLevel(config.APP_LOGGER_LEVEL),
        sinks: ["console"],
      },
    ],
  });
}

async function resolveNodeLogFilePaths(
  config: RuntimeConfig,
): Promise<NodeLogFilePaths> {
  const [
    { mkdir, stat, writeFile },
    { dirname, isAbsolute, join },
    { fileURLToPath },
  ] = await Promise.all([
    import("node:fs/promises"),
    import("node:path"),
    import("node:url"),
  ]);
  const appServerDir = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../..",
  );
  const configuredLogDir = config.APP_LOGGER_DIR ?? DEFAULT_APP_LOGGER_DIR;
  const logDir = isAbsolute(configuredLogDir)
    ? configuredLogDir
    : join(appServerDir, configuredLogDir);
  await mkdir(logDir, { recursive: true });

  const logFilePaths = {
    warn: join(logDir, NODE_LOG_FILE_NAMES.warn),
    error: join(logDir, NODE_LOG_FILE_NAMES.error),
  };
  await Promise.all(
    Object.values(logFilePaths).map(async (logFilePath) => {
      try {
        await stat(logFilePath);
      } catch {
        await writeFile(logFilePath, "");
      }
    }),
  );
  return logFilePaths;
}

async function getNodeFileSink(
  logFilePath: string,
  options: { maxSize: number; maxFiles: number },
) {
  const { getRotatingFileSink } = await import("@logtape/file");
  return getRotatingFileSink(logFilePath, options);
}

function toLogTapeLevel(level: DEFAULT_LOGGER_LEVELS_VALUES): LogLevel {
  if (level === DEFAULT_LOGGER_LEVELS.WARN) return "warning";
  if (level === DEFAULT_LOGGER_LEVELS.VERBOSE) return "trace";
  return level;
}

async function getNodeRuntimeConfig(): Promise<RuntimeConfig> {
  const { getRuntimeConfig } = await import("@/configs/runtime");
  return getRuntimeConfig(process.env);
}

const logger = getLogger([name]);

export type Logger = typeof logger;
export { dispose } from "@logtape/logtape";
export default logger;
