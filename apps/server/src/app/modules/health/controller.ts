import { createResponse } from "@/shared/models";
import {
  getCloudflareKvHealthRoute,
  getDatabaseHealthRoute,
  getDiskHealthRoute,
  getHealthRoute,
  getMemoryHealthRoute,
  getNetworkHealthRoute,
  getRedisHealthRoute,
} from "./meta";
import {
  checkDiskHealth,
  checkMemoryHealth,
  checkNetworkHealth,
  getHealthStatus,
  getReservedHealthStatus,
} from "./service";
import type { AppOpenAPI } from "@/app/bootstrap/register-openapi";

export function registerHealthController(app: AppOpenAPI) {
  app.openapi(getHealthRoute, (c) =>
    c.json(
      createResponse({
        data: getHealthStatus(),
        requestId: c.get("requestId"),
      }),
      200,
    ),
  );

  app.openapi(getDiskHealthRoute, async (c) =>
    c.json(
      createResponse({
        data: await checkDiskHealth(c),
        requestId: c.get("requestId"),
      }),
      200,
    ),
  );

  app.openapi(getMemoryHealthRoute, (c) =>
    c.json(
      createResponse({
        data: checkMemoryHealth(c.get("runtimeEnv")),
        requestId: c.get("requestId"),
      }),
      200,
    ),
  );

  app.openapi(getNetworkHealthRoute, async (c) =>
    c.json(
      createResponse({
        data: await checkNetworkHealth(c.get("runtimeEnv")),
        requestId: c.get("requestId"),
      }),
      200,
    ),
  );

  app.openapi(getDatabaseHealthRoute, (c) =>
    c.json(
      createResponse({
        data: getReservedHealthStatus("database"),
        requestId: c.get("requestId"),
      }),
      200,
    ),
  );

  app.openapi(getRedisHealthRoute, (c) =>
    c.json(
      createResponse({
        data: getReservedHealthStatus("redis"),
        requestId: c.get("requestId"),
      }),
      200,
    ),
  );

  app.openapi(getCloudflareKvHealthRoute, (c) =>
    c.json(
      createResponse({
        data: getReservedHealthStatus("cloudflare-kv"),
        requestId: c.get("requestId"),
      }),
      200,
    ),
  );
}
