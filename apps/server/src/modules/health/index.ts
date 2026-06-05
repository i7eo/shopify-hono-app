import type { Hono } from "hono";
import type { AppEnv } from "../../types";

export const registerHealthRoutes = (app: Hono<AppEnv>) => {
  app.get("/health", (c) => c.json({ status: "ok" }));
};

console.info("健康检查");
