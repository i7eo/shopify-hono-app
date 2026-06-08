import {
  DEFAULT_ENVS,
  DEFAULT_RUNTIMES,
  type DEFAULT_ENVS_VALUES,
  type DEFAULT_RUNTIMES_VALUES,
} from "@shamt/envs";

export function isDev(appEnv?: DEFAULT_ENVS_VALUES) {
  return appEnv === DEFAULT_ENVS.DEVELOPMENT;
}

export function isTest(appEnv?: DEFAULT_ENVS_VALUES) {
  return appEnv === DEFAULT_ENVS.TEST;
}

export function isProd(appEnv?: DEFAULT_ENVS_VALUES) {
  return appEnv === DEFAULT_ENVS.PRODUCTION;
}

export function isProcessRuntime(appRuntime?: DEFAULT_RUNTIMES_VALUES) {
  return appRuntime === DEFAULT_RUNTIMES.NODE;
}

export function isIsolateRuntime(appRuntime?: DEFAULT_RUNTIMES_VALUES) {
  return appRuntime === DEFAULT_RUNTIMES.CLOUDFLARE;
}
