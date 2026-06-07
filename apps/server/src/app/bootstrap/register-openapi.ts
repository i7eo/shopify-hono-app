import { Scalar } from "@scalar/hono-api-reference";
import { name, version } from "../../../package.json";
import type { AppEnv } from "@/types";
import type { OpenAPIHono, RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { Schema } from "hono";

export type AppOpenAPI<S extends Schema = {}> = OpenAPIHono<AppEnv, S>;
export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, AppEnv>;
export function registerOpenAPI(app: AppOpenAPI) {
  app.doc31("/document", {
    openapi: "3.1.0",
    info: {
      title: name,
      version,
    },
  });

  app.get(
    "/reference",
    Scalar({
      url: "/document",
      theme: "kepler",
      layout: "classic",
      defaultHttpClient: {
        targetKey: "js",
        clientKey: "fetch",
      },
    }),
  );
}
