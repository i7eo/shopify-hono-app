export enum DEFAULT_LOGGER_LEVELS {
  ERROR = "error",
  WARN = "warn",
  INFO = "info",
  DEBUG = "debug",
  VERBOSE = "verbose",
}
export const DEFAULT_LOG_LEVEL = DEFAULT_LOGGER_LEVELS.DEBUG;
export const DEFAULT_APP_LOGGER_EXPIRE = 1000 * 60 * 60 * 24 * 7; // limit log keep 7d
export const DEFAULT_APP_LOGGER_MAX_SIZE = 1024 * 1024 * 5; // limit size 5M
