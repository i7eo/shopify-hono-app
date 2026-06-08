import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockContext, expectAppError, runtimeConfig } from "./test-utils";

describe("Shopify session storage", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("uses KV session storage in Cloudflare runtime", async () => {
    const kvConstructor = vi.fn(function KVSessionStorage(
      this: unknown,
      namespace,
    ) {
      return { kind: "kv", namespace };
    });
    const memoryConstructor = vi.fn(function MemorySessionStorage() {
      return { kind: "memory" };
    });

    vi.doMock("@shopify/shopify-app-session-storage-kv", () => ({
      KVSessionStorage: kvConstructor,
    }));
    vi.doMock("@shopify/shopify-app-session-storage-memory", () => ({
      MemorySessionStorage: memoryConstructor,
    }));

    const { registerCloudflareIsolateRuntimeCapabilities } =
      await import("@/app/runtime/isolate/cloudflare/capabilities");
    const { getShopifySessionStorage } =
      await import("@/app/modules/shopify/session-storage");
    registerCloudflareIsolateRuntimeCapabilities();
    const namespace = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    };
    const context = createMockContext({
      env: { sofary: namespace },
      vars: {
        runtimeEnv: {
          ...runtimeConfig,
          APP_RUNTIME: "cloudflare",
          APP_ENV: "production",
        },
      },
    });

    expect(getShopifySessionStorage(context as never)).toEqual({
      kind: "kv",
      namespace,
    });
    expect(kvConstructor).toHaveBeenCalledWith(namespace);
    expect(memoryConstructor).not.toHaveBeenCalled();
  });

  it("uses one shared memory session storage in node development", async () => {
    const memoryInstance = { kind: "memory" };
    const memoryConstructor = vi.fn(function MemorySessionStorage() {
      return memoryInstance;
    });

    vi.doMock("@shopify/shopify-app-session-storage-kv", () => ({
      KVSessionStorage: vi.fn(),
    }));
    vi.doMock("@shopify/shopify-app-session-storage-memory", () => ({
      MemorySessionStorage: memoryConstructor,
    }));

    const { registerProcessRuntimeCapabilities } =
      await import("@/app/runtime/process/capabilities");
    const { getShopifySessionStorage } =
      await import("@/app/modules/shopify/session-storage");
    registerProcessRuntimeCapabilities();
    const context = createMockContext({
      vars: {
        runtimeEnv: {
          ...runtimeConfig,
          APP_RUNTIME: "node",
          APP_ENV: "development",
        },
      },
    });

    expect(getShopifySessionStorage(context as never)).toBe(memoryInstance);
    expect(getShopifySessionStorage(context as never)).toBe(memoryInstance);
    expect(memoryConstructor).toHaveBeenCalledOnce();
  });

  it("rejects memory session storage outside node development", async () => {
    vi.doMock("@shopify/shopify-app-session-storage-kv", () => ({
      KVSessionStorage: vi.fn(),
    }));
    vi.doMock("@shopify/shopify-app-session-storage-memory", () => ({
      MemorySessionStorage: vi.fn(),
    }));

    const { registerProcessRuntimeCapabilities } =
      await import("@/app/runtime/process/capabilities");
    const { getShopifySessionStorage } =
      await import("@/app/modules/shopify/session-storage");
    registerProcessRuntimeCapabilities();
    const context = createMockContext({
      vars: {
        runtimeEnv: {
          ...runtimeConfig,
          APP_RUNTIME: "node",
          APP_ENV: "production",
        },
      },
    });

    expect(() => getShopifySessionStorage(context as never)).toThrow(
      "Shopify memory session storage is only available",
    );
  });
});

describe("verifySessionToken middleware", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("rejects missing or malformed Authorization headers", async () => {
    const { verifySessionToken } =
      await import("@/shared/middlewares/shopify/verify-session-token");

    await expect(
      verifySessionToken(createMockContext() as never, vi.fn()),
    ).rejects.toSatisfy((error) => {
      expectAppError(error, 401, "Missing or malformed Authorization header");
      return true;
    });
  });

  it("decodes session tokens and stores claims on context", async () => {
    const claims = {
      dest: "https://shop.example.myshopify.com/admin",
      sub: "gid://shopify/User/1",
    };
    const decodeSessionToken = vi.fn(() => claims);
    vi.doMock("@/infra/provider", () => ({
      getShopifyConfigProvider: vi.fn(() => ({
        session: { decodeSessionToken },
      })),
    }));

    const { verifySessionToken } =
      await import("@/shared/middlewares/shopify/verify-session-token");
    const next = vi.fn();
    const context = createMockContext({
      headers: { Authorization: "Bearer session-token" },
    });

    await verifySessionToken(context as never, next);

    expect(decodeSessionToken).toHaveBeenCalledWith("session-token");
    expect(context.var.shopifySessionToken).toBe(claims);
    expect(context.var.shopDomain).toBe("shop.example.myshopify.com");
    expect(context.var.shopifyUserId).toBe("gid://shopify/User/1");
    expect(next).toHaveBeenCalledOnce();
  });

  it("wraps invalid session token errors", async () => {
    vi.doMock("@/infra/provider", () => ({
      getShopifyConfigProvider: vi.fn(() => ({
        session: {
          decodeSessionToken: vi.fn(() => {
            throw new Error("bad token");
          }),
        },
      })),
    }));

    const { verifySessionToken } =
      await import("@/shared/middlewares/shopify/verify-session-token");

    await expect(
      verifySessionToken(
        createMockContext({
          headers: { Authorization: "Bearer bad" },
        }) as never,
        vi.fn(),
      ),
    ).rejects.toSatisfy((error) => {
      expectAppError(error, 401, "Invalid session token");
      expect(error).toMatchObject({
        details: { message: "bad token" },
      });
      return true;
    });
  });
});

describe("tokenExchange middleware", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("reuses active stored sessions", async () => {
    const storedSession = {
      accessToken: "stored-token",
    };
    const loadActiveShopifyOnlineSession = vi.fn(() => storedSession);
    const exchangeShopifyOnlineSession = vi.fn();
    const setShopifySessionContext = vi.fn((context, session) => {
      context.set("shopifySession", session);
      context.set("shopifyAccessToken", session.accessToken);
    });
    vi.doMock("@/app/modules/shopify/session", () => ({
      loadActiveShopifyOnlineSession,
      exchangeShopifyOnlineSession,
      setShopifySessionContext,
    }));

    const { tokenExchange } =
      await import("@/shared/middlewares/shopify/token-exchange");
    const next = vi.fn();
    const context = createMockContext({
      headers: { Authorization: "Bearer session-token" },
      vars: { shopDomain: "shop.myshopify.com" },
    });

    await tokenExchange(context as never, next);

    expect(loadActiveShopifyOnlineSession).toHaveBeenCalledWith(context);
    expect(exchangeShopifyOnlineSession).not.toHaveBeenCalled();
    expect(setShopifySessionContext).toHaveBeenCalledWith(
      context,
      storedSession,
    );
    expect(context.var.shopifySession).toBe(storedSession);
    expect(context.var.shopifyAccessToken).toBe("stored-token");
    expect(next).toHaveBeenCalledOnce();
  });

  it("exchanges tokens and stores new sessions when no active session exists", async () => {
    const session = { accessToken: "new-token", shop: "shop.myshopify.com" };
    const loadActiveShopifyOnlineSession = vi.fn(() => undefined);
    const exchangeShopifyOnlineSession = vi.fn(() => session);
    const setShopifySessionContext = vi.fn((context, nextSession) => {
      context.set("shopifySession", nextSession);
      context.set("shopifyAccessToken", nextSession.accessToken);
    });
    vi.doMock("@/app/modules/shopify/session", () => ({
      loadActiveShopifyOnlineSession,
      exchangeShopifyOnlineSession,
      setShopifySessionContext,
    }));

    const { tokenExchange } =
      await import("@/shared/middlewares/shopify/token-exchange");
    const next = vi.fn();
    const context = createMockContext({
      headers: { Authorization: "Bearer session-token" },
      vars: { shopDomain: "shop.myshopify.com" },
    });

    await tokenExchange(context as never, next);

    expect(loadActiveShopifyOnlineSession).toHaveBeenCalledWith(context);
    expect(exchangeShopifyOnlineSession).toHaveBeenCalledWith(context);
    expect(setShopifySessionContext).toHaveBeenCalledWith(context, session);
    expect(context.var.shopifySession).toBe(session);
    expect(context.var.shopifyAccessToken).toBe("new-token");
    expect(next).toHaveBeenCalledOnce();
  });

  it("wraps token exchange failures", async () => {
    vi.doMock("@/app/modules/shopify/session", () => ({
      loadActiveShopifyOnlineSession: vi.fn(() => undefined),
      exchangeShopifyOnlineSession: vi.fn(() => {
        throw new Error("Token exchange did not return an access token");
      }),
      setShopifySessionContext: vi.fn(),
    }));

    const { tokenExchange } =
      await import("@/shared/middlewares/shopify/token-exchange");

    await expect(
      tokenExchange(
        createMockContext({
          headers: { Authorization: "Bearer session-token" },
          vars: { shopDomain: "shop.myshopify.com" },
        }) as never,
        vi.fn(),
      ),
    ).rejects.toSatisfy((error) => {
      expectAppError(error, 502, "Token exchange failed");
      expect(error).toMatchObject({
        details: {
          message: "Token exchange did not return an access token",
        },
      });
      return true;
    });
  });
});

describe("verifyWebhook middleware", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("validates webhooks, parses JSON payloads, and stores context vars", async () => {
    const validate = vi.fn(() => ({
      valid: true,
      topic: "APP_UNINSTALLED",
      domain: "shop.myshopify.com",
    }));
    vi.doMock("@/infra/provider", () => ({
      getShopifyConfigProvider: vi.fn(() => ({
        webhooks: { validate },
      })),
    }));

    const { verifyWebhook } =
      await import("@/shared/middlewares/shopify/verify-webhook");
    const next = vi.fn();
    const context = createMockContext({
      method: "POST",
      body: JSON.stringify({ shop_id: 1 }),
    });

    await verifyWebhook(context as never, next);

    expect(validate).toHaveBeenCalledWith({
      rawRequest: context.req.raw,
      rawBody: '{"shop_id":1}',
    });
    expect(context.var.webhookTopic).toBe("APP_UNINSTALLED");
    expect(context.var.webhookShop).toBe("shop.myshopify.com");
    expect(context.var.webhookPayload).toEqual({ shop_id: 1 });
    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects invalid webhook signatures", async () => {
    const validation = { valid: false, reason: "hmac" };
    vi.doMock("@/infra/provider", () => ({
      getShopifyConfigProvider: vi.fn(() => ({
        webhooks: { validate: vi.fn(() => validation) },
      })),
    }));

    const { verifyWebhook } =
      await import("@/shared/middlewares/shopify/verify-webhook");

    await expect(
      verifyWebhook(
        createMockContext({
          method: "POST",
          body: JSON.stringify({ ok: true }),
        }) as never,
        vi.fn(),
      ),
    ).rejects.toSatisfy((error) => {
      expectAppError(error, 401, "Webhook validation failed");
      expect(error).toMatchObject({ details: { validation } });
      return true;
    });
  });

  it("rejects invalid webhook JSON payloads", async () => {
    vi.doMock("@/infra/provider", () => ({
      getShopifyConfigProvider: vi.fn(() => ({
        webhooks: {
          validate: vi.fn(() => ({
            valid: true,
            topic: "SHOP_REDACT",
            domain: "shop.myshopify.com",
          })),
        },
      })),
    }));

    const { verifyWebhook } =
      await import("@/shared/middlewares/shopify/verify-webhook");

    await expect(
      verifyWebhook(
        createMockContext({
          method: "POST",
          body: "not-json",
        }) as never,
        vi.fn(),
      ),
    ).rejects.toSatisfy((error) => {
      expectAppError(error, 401, "Invalid Shopify webhook JSON payload");
      return true;
    });
  });
});
