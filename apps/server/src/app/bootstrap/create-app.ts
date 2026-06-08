import { OpenAPIHono } from "@hono/zod-openapi";
import { onAppError } from "../lifecycle/error";
import { onAppNotFound } from "../lifecycle/not-found";
import { registerMiddleware } from "./register-middleware";
import { registerRoutes } from "./register-routes";
import type { AppEnv } from "@/types";

/**
 * Central Hono app factory.
 */
export function createApp() {
  const app = new OpenAPIHono<AppEnv>();

  registerMiddleware(app);
  registerRoutes(app);
  onAppError(app);
  onAppNotFound(app);

  return app;
}
