import type { Hono } from "hono";
import type { AppEnv } from "../../types";

export const registerAppExceptionListeners = (app: Hono<AppEnv>) => {
  app.onError((error, c) => {
    // eslint-disable-next-line no-console
    console.error("[error]", error);
    return c.json({ error: "Internal Server Error" }, 500);
  });
};
