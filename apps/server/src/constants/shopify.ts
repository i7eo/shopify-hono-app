import { DEFAULT_APP_NAME } from "@shamt/app-env";

const appName =
  typeof process !== "undefined" && process.env.APP_NAME
    ? process.env.APP_NAME
    : DEFAULT_APP_NAME;

export const DEFAULT_APP_ACCOUNT_SESSION_COOKIE = `${appName}:account_session_cookie`;
export const DEFAULT_APP_ACCOUNT_SESSION_EXPIRE = 60 * 60 * 24 * 30;
