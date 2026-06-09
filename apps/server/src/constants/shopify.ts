import { DEFAULT_APP_NAME } from "@shamt/envs";

export const DEFAULT_SHOPIFY_APP_MODES = {
  EMBEDDED: "embedded",
  STANDALONE: "standalone",
} as const;
export type DEFAULT_SHOPIFY_APP_MODES_VALUES =
  (typeof DEFAULT_SHOPIFY_APP_MODES)[keyof typeof DEFAULT_SHOPIFY_APP_MODES];

const appName =
  typeof process !== "undefined" && process.env.APP_NAME
    ? process.env.APP_NAME
    : DEFAULT_APP_NAME;

export const DEFAULT_APP_ACCOUNT_SESSION_COOKIE = `${appName}:account_session_cookie`;
export const DEFAULT_APP_ACCOUNT_SESSION_EXPIRE = 60 * 60 * 24 * 30;
