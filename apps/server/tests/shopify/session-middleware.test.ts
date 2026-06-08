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

    const { getShopifySessionStorage } =
      await import("@/app/modules/shopify/session-storage");
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
    expect(memoryConstructor).toHaveBeenCalledOnce();
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

    const { getShopifySessionStorage } =
      await import("@/app/modules/shopify/session-storage");
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

    const { getShopifySessionStorage } =
      await import("@/app/modules/shopify/session-storage");
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
      isActive: vi.fn(() => true),
    };
    const loadSession = vi.fn(() => storedSession);
    const storeSession = vi.fn();
    const tokenExchangeCall = vi.fn();
    vi.doMock("@shopify/shopify-api", () => ({
      RequestedTokenType: {
        OnlineAccessToken: "online",
      },
    }));
    vi.doMock("@/app/modules/shopify/session-storage", () => ({
      getShopifySessionStorage: vi.fn(() => ({ loadSession, storeSession })),
    }));
    vi.doMock("@/infra/provider", () => ({
      getShopifyConfigProvider: vi.fn(() => ({
        config: { scopes: ["read_products"] },
        session: { getCurrentId: vi.fn(() => "session-id") },
        auth: { tokenExchange: tokenExchangeCall },
      })),
    }));

    const { tokenExchange } =
      await import("@/shared/middlewares/shopify/token-exchange");
    const next = vi.fn();
    const context = createMockContext({
      headers: { Authorization: "Bearer session-token" },
      vars: { shopDomain: "shop.myshopify.com" },
    });

    await tokenExchange(context as never, next);

    expect(loadSession).toHaveBeenCalledWith("session-id");
    expect(storedSession.isActive).toHaveBeenCalledWith(["read_products"]);
    expect(tokenExchangeCall).not.toHaveBeenCalled();
    expect(storeSession).not.toHaveBeenCalled();
    expect(context.var.shopifySession).toBe(storedSession);
    expect(context.var.shopifyAccessToken).toBe("stored-token");
    expect(next).toHaveBeenCalledOnce();
  });

  it("exchanges tokens and stores new sessions when no active session exists", async () => {
    const session = { accessToken: "new-token", shop: "shop.myshopify.com" };
    const storeSession = vi.fn();
    const tokenExchangeCall = vi.fn(() => ({ session }));
    vi.doMock("@shopify/shopify-api", () => ({
      RequestedTokenType: {
        OnlineAccessToken: "online",
      },
    }));
    vi.doMock("@/app/modules/shopify/session-storage", () => ({
      getShopifySessionStorage: vi.fn(() => ({
        loadSession: vi.fn(() => undefined),
        storeSession,
      })),
    }));
    vi.doMock("@/infra/provider", () => ({
      getShopifyConfigProvider: vi.fn(() => ({
        config: { scopes: ["read_products"] },
        session: { getCurrentId: vi.fn(() => undefined) },
        auth: { tokenExchange: tokenExchangeCall },
      })),
    }));

    const { tokenExchange } =
      await import("@/shared/middlewares/shopify/token-exchange");
    const next = vi.fn();
    const context = createMockContext({
      headers: { Authorization: "Bearer session-token" },
      vars: { shopDomain: "shop.myshopify.com" },
    });

    await tokenExchange(context as never, next);

    expect(tokenExchangeCall).toHaveBeenCalledWith({
      shop: "shop.myshopify.com",
      sessionToken: "session-token",
      requestedTokenType: "online",
    });
    expect(storeSession).toHaveBeenCalledWith(session);
    expect(context.var.shopifySession).toBe(session);
    expect(context.var.shopifyAccessToken).toBe("new-token");
    expect(next).toHaveBeenCalledOnce();
  });

  it("wraps token exchange failures", async () => {
    vi.doMock("@shopify/shopify-api", () => ({
      RequestedTokenType: {
        OnlineAccessToken: "online",
      },
    }));
    vi.doMock("@/app/modules/shopify/session-storage", () => ({
      getShopifySessionStorage: vi.fn(() => ({
        loadSession: vi.fn(() => undefined),
        storeSession: vi.fn(),
      })),
    }));
    vi.doMock("@/infra/provider", () => ({
      getShopifyConfigProvider: vi.fn(() => ({
        config: { scopes: [] },
        session: { getCurrentId: vi.fn(() => undefined) },
        auth: {
          tokenExchange: vi.fn(() => ({ session: {} })),
        },
      })),
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
