import { createResponse } from "@/shared/models";
import {
  createFileRoute,
  deleteFileRoute,
  downloadFileRoute,
  getFileRoute,
  listFilesRoute,
} from "./meta";
import {
  createFile,
  createFiles,
  deleteFile,
  downloadFile,
  getFile,
  listFiles,
} from "./service";
import type { AppOpenAPI } from "@/app/bootstrap/register-openapi";

export function registerFileController(app: AppOpenAPI) {
  app.openapi(createFileRoute, async (c) => {
    const runtimeEnv = c.get("runtimeEnv");
    const shopDomain = c.get("shopDomain");

    if (isMultipartRequest(c.req.header("Content-Type"))) {
      return c.json(
        createResponse({
          data: await createFiles(c, {
            runtimeEnv,
            shopDomain,
          }),
          requestId: c.get("requestId"),
        }),
        201,
      );
    }

    return c.json(
      createResponse({
        data: await createFile(c, {
          body: c.req.raw.body,
          contentType: c.req.header("Content-Type"),
          originalName: c.req.header("X-File-Name"),
          runtimeEnv,
          shopDomain,
        }),
        requestId: c.get("requestId"),
      }),
      201,
    );
  });

  app.openapi(listFilesRoute, async (c) =>
    c.json(
      createResponse({
        data: await listFiles(c, {
          cursor: c.req.query("cursor"),
          limit: parseLimit(c.req.query("limit")),
          shopDomain: c.get("shopDomain"),
        }),
        requestId: c.get("requestId"),
      }),
      200,
    ),
  );

  app.openapi(getFileRoute, async (c) =>
    c.json(
      createResponse({
        data: await getFile(c, c.get("shopDomain"), c.req.param("id")),
        requestId: c.get("requestId"),
      }),
      200,
    ),
  );

  app.openapi(downloadFileRoute, async (c) => {
    const download = await downloadFile(
      c,
      c.get("shopDomain"),
      c.req.param("id"),
    );

    if (download.type === "redirect") {
      return new Response(null, {
        status: 302,
        headers: {
          ...download.headers,
          Location: download.url,
        },
      });
    }

    return new Response(download.body, {
      status: 200,
      headers: download.headers,
    });
  });

  app.openapi(deleteFileRoute, async (c) => {
    await deleteFile(c, c.get("shopDomain"), c.req.param("id"));
    return c.body(null, 204);
  });
}

function parseLimit(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const limit = Number(value);
  return Number.isFinite(limit) ? limit : undefined;
}

function isMultipartRequest(contentType: string | undefined): boolean {
  return contentType?.toLowerCase().startsWith("multipart/form-data") ?? false;
}
