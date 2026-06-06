import { createResponse } from "@/shared/models";
import type { AppEnv } from "../../types";
import type { Hono } from "hono";

export const registerHealthRoutes = (app: Hono<AppEnv>) => {
  app.get("/health", (c) =>
    c.json(
      createResponse({
        data: { status: "ok" },
        requestId: c.get("requestId"),
      }),
    ),
  );
};

console.info("健康检查");
