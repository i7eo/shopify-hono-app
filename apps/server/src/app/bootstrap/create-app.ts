import { Hono } from "hono";
import { registerAppExceptionListeners } from "@/shared/exceptions";
import { onAppShutdown } from "../lifecycle/shutdown";
import { onAppStartup } from "../lifecycle/startup";
import { registerMiddleware } from "./register-middleware";
import { registerRoutes } from "./register-routes";
import type { AppEnv } from "@/types";

/**
 * Central Hono app factory.
 *
 * This mirrors the src1 bootstrap shape while keeping the current Hono runtime.
 */
export async function createApp() {
  await onAppStartup();

  const app = new Hono<AppEnv>();
  registerAppExceptionListeners(app);
  registerMiddleware(app);
  registerRoutes(app);

  await onAppShutdown(app);
  return app;
}
