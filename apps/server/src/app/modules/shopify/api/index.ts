import { Hono } from "hono";
import { tokenExchange, verifySessionToken } from "@/shared/middlewares";
import { registerProductRoutes } from "../product";
import { registerShopRoutes } from "../shop";
import type { AppEnv } from "@/types";

export const createApiRoutes = () => {
  const apiRoutes = new Hono<AppEnv>();

  apiRoutes.use("/*", verifySessionToken);
  apiRoutes.use("/*", tokenExchange);

  registerShopRoutes(apiRoutes);
  registerProductRoutes(apiRoutes);

  return apiRoutes;
};

export const apiRoutes = createApiRoutes();

export const registerApiRoutes = (app: Hono<AppEnv>) => {
  app.route("/api", createApiRoutes());
};
