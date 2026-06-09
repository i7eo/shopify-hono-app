import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "./test-utils";
import type { AppEnv } from "@/types";

describe("Shopify webhook routes", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/shared/middlewares");
    vi.doUnmock("@/app/modules/shopify/session-storage");
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

  it("registers webhook routes on an app", async () => {
    const { registerWebhookRoutes } =
      await import("@/app/modules/shopify/webhook");
    const app = { route: vi.fn() };

    registerWebhookRoutes(app as never);

    expect(app.route).toHaveBeenCalledWith("/webhooks", expect.any(Object));
  });
});
