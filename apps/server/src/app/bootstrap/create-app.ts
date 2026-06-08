import { OpenAPIHono } from "@hono/zod-openapi";
import { onAppError } from "../lifecycle/error";
import { onAppNotFound } from "../lifecycle/not-found";
import { registerMiddleware } from "./register-middleware";
import { registerOpenAPI } from "./register-openapi";
import { registerRoutes } from "./register-routes";
import type { AppEnv } from "@/types";

/**
 * Central Hono app factory.
 *
 * This mirrors the src1 bootstrap shape while keeping the current Hono runtime.
 */
export function createApp() {
  const app = new OpenAPIHono<AppEnv>();

  registerMiddleware(app);
  registerRoutes(app);
  registerOpenAPI(app);
  onAppError(app);
  onAppNotFound(app);

  return app;
}
