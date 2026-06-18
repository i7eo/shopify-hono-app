import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { disposeRuntimeCapabilities } from "@/app/runtime/capabilities";
import { logger, runtimeConfig } from "./test-utils";
import type { ProductExportRecord } from "@/app/modules/product-export/types";
import type { AppEnv } from "@/typings";

describe("Shopify webhook routes", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/shared/middlewares");
    vi.doUnmock("@/app/modules/shopify/session-storage");
    vi.doUnmock("@/app/modules/product-export/stores/database");
    return disposeRuntimeCapabilities();
  });

  async function createApp(payload?: unknown) {
    const webhookPayload = payload ?? { id: 1 };

    vi.doMock("@/shared/middlewares", () => ({
      verifyWebhook: async (c: any, next: any) => {
        c.set("webhookTopic", "TEST_TOPIC");
        c.set("webhookShop", "shop.myshopify.com");
        c.set("webhookPayload", webhookPayload);
        await next();
      },
    }));

    const sessions = [{ id: "session-1" }, { id: "session-2" }];
    const findSessionsByShop = vi.fn(() => sessions);
    const deleteSessions = vi.fn();
    vi.doMock("@/app/modules/shopify/session-storage", () => ({
      getShopifySessionStorage: vi.fn(() => ({
        findSessionsByShop,
        deleteSessions,
      })),
    }));

    const { createWebhookRoutes } =
      await import("@/app/modules/shopify/webhook");
    const app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("runtimeLogger", logger as never);
      c.set("runtimeEnv", runtimeConfig);
      c.set("requestId", "req_test");
      await next();
    });
    app.route("/webhooks", createWebhookRoutes());

    return { app, findSessionsByShop, deleteSessions };
  }

  it("handles app uninstall webhooks by deleting shop sessions", async () => {
    const { app, findSessionsByShop, deleteSessions } = await createApp();

    const response = await app.request("/webhooks/app/uninstalled", {
      method: "POST",
      body: "{}",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { ok: true },
      requestId: "req_test",
      success: true,
    });
    expect(findSessionsByShop).toHaveBeenCalledWith("shop.myshopify.com");
    expect(deleteSessions).toHaveBeenCalledWith(["session-1", "session-2"]);
    expect(logger.info).toHaveBeenCalledWith(
      "App uninstalled: shop.myshopify.com",
    );
  });

  it.each([
    [
      "/webhooks/customers/data-request",
      'Customer data request from shop.myshopify.com: {"id":1}',
    ],
    [
      "/webhooks/customers/redact",
      'Customer redact request from shop.myshopify.com: {"id":1}',
    ],
    [
      "/webhooks/shop/redact",
      'Shop redact request from shop.myshopify.com: {"id":1}',
    ],
  ])("handles privacy webhook route %s", async (path, logMessage) => {
    const { app } = await createApp();

    const response = await app.request(path, {
      method: "POST",
      body: "{}",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { ok: true },
      requestId: "req_test",
      success: true,
    });
    expect(logger.info).toHaveBeenCalledWith(logMessage);
  });

  it("handles bulk operation finish webhooks for product exports", async () => {
    const record = createProductExportRecord({
      shopifyBulkOperationId: "gid://shopify/BulkOperation/1",
      status: "bulk_operation_running",
    });
    const enqueue = vi.fn();
    const update = vi.fn();

    vi.doMock("@/app/modules/product-export/stores/database", () => ({
      createDatabaseProductExportsStoreFromPromise: vi.fn(() => ({
        create: vi.fn(),
        delete: vi.fn(),
        findByBulkOperationId: vi.fn(() => record),
        findById: vi.fn(),
        list: vi.fn(),
        update,
      })),
    }));

    const { setRuntimeCapability } = await import("@/app/runtime/capabilities");
    setRuntimeCapability(
      "databaseFactory",
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      vi.fn(() => ({ provider: "test" }) as never),
    );
    setRuntimeCapability(
      "queueProducerFactory",
      vi.fn(() => ({
        enqueue,
        enqueueBatch: vi.fn(),
      })),
    );

    const { app } = await createApp({
      admin_graphql_api_id: "gid://shopify/BulkOperation/1",
      completed_at: "2026-06-18T12:00:00.000Z",
      file_size: "1024",
      object_count: "10",
      partial_data_url: null,
      status: "completed",
      url: "https://shopify.example.com/bulk-result.jsonl",
    });

    const response = await app.request("/webhooks/bulk_operations/finish", {
      method: "POST",
      body: "{}",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { ok: true },
      requestId: "req_test",
      success: true,
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        fileSize: 1024,
        objectCount: 10,
        resultUrl: "https://shopify.example.com/bulk-result.jsonl",
        shopifyBulkOperationStatus: "completed",
        status: "bulk_operation_completed",
      }),
    );
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "product-export.bulk-finished",
        payload: {
          exportId: "product-export-1",
          shopDomain: "shop.myshopify.com",
        },
        version: 1,
      }),
      expect.objectContaining({
        idempotencyKey: "product-export.bulk-finished:product-export-1:",
      }),
    );
  });

  it("registers webhook routes on an app", async () => {
    const { registerWebhookRoutes } =
      await import("@/app/modules/shopify/webhook");
    const app = { route: vi.fn() };

    registerWebhookRoutes(app as never);

    expect(app.route).toHaveBeenCalledWith("/webhooks", expect.any(Object));
  });
});

function createProductExportRecord(
  overrides: Partial<ProductExportRecord> = {},
): ProductExportRecord {
  const now = new Date("2026-06-18T12:00:00.000Z");

  return {
    bucketKey: null,
    bucketProvider: null,
    completedAt: null,
    createdAt: now,
    deletedAt: null,
    errorCode: null,
    errorMessage: null,
    fileSize: null,
    id: "product-export-1",
    name: "All products",
    objectCount: null,
    partialDataUrl: null,
    resultUrl: null,
    shopDomain: "shop.myshopify.com",
    shopifyBulkOperationId: null,
    shopifyBulkOperationStatus: null,
    status: "queued",
    updatedAt: now,
    ...overrides,
  };
}
