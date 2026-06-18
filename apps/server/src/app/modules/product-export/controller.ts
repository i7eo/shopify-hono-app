import { badGatewayError } from "@/shared/exceptions";
import { AppError, createResponse } from "@/shared/models";
import {
  createProductExportRoute,
  deleteProductExportRoute,
  getProductExportRoute,
  listProductExportsRoute,
} from "./meta";
import {
  createProductExport,
  deleteProductExport,
  getProductExport,
  listProductExports,
} from "./service";
import type { ProductExportStatus } from "./types";
import type { AppOpenAPI } from "@/app/bootstrap/register-openapi";

export function registerProductExportController(app: AppOpenAPI) {
  app.openapi(createProductExportRoute, async (c) => {
    try {
      const body = c.req.valid("json");
      return c.json(
        createResponse({
          data: await createProductExport(c, {
            name: body.name,
            runtimeEnv: c.get("runtimeEnv"),
            shopDomain: c.get("shopDomain"),
          }),
          requestId: c.get("requestId"),
        }),
        202,
      );
    } catch (error) {
      if (error instanceof AppError) throw error;

      throw badGatewayError("Failed to create product export", {
        details: {
          cause: error,
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  });

  app.openapi(listProductExportsRoute, async (c) =>
    c.json(
      createResponse({
        data: await listProductExports(c, {
          cursor: c.req.query("cursor"),
          limit: parseLimit(c.req.query("limit")),
          shopDomain: c.get("shopDomain"),
          status: c.req.valid("query").status as
            | ProductExportStatus
            | undefined,
        }),
        requestId: c.get("requestId"),
      }),
      200,
    ),
  );

  app.openapi(getProductExportRoute, async (c) =>
    c.json(
      createResponse({
        data: await getProductExport(c, {
          id: c.req.param("id"),
          shopDomain: c.get("shopDomain"),
        }),
        requestId: c.get("requestId"),
      }),
      200,
    ),
  );

  app.openapi(deleteProductExportRoute, async (c) => {
    await deleteProductExport(c, {
      id: c.req.param("id"),
      shopDomain: c.get("shopDomain"),
    });

    return c.body(null, 204);
  });
}

function parseLimit(value: string | undefined): number {
  if (!value) return 20;

  const limit = Number(value);
  return Number.isFinite(limit) ? limit : 20;
}
