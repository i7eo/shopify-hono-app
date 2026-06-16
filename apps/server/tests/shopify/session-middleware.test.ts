import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  it("wraps non-Error invalid session token failures", async () => {
    vi.doMock("@/infra/provider", () => ({
      getShopifyConfigProvider: vi.fn(() => ({
        session: {
          decodeSessionToken: vi.fn(() => {
            throw "bad token";
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

  it("wraps non-Error token exchange failures", async () => {
    vi.doMock("@/app/modules/shopify/session", () => ({
      loadActiveShopifyOnlineSession: vi.fn(() => undefined),
      exchangeShopifyOnlineSession: vi.fn(() => {
        throw "token exchange exploded";
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
          message: "token exchange exploded",
        },
      });
      return true;
    });
  });
});

describe("Shopify online session helpers", () => {
  beforeEach(() => {
    vi.doUnmock("@/app/modules/shopify/session");
  });

  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/infra/provider");
    vi.doUnmock("@/app/modules/shopify/session-storage");
  });

  it("loads active online sessions from the current Shopify session ID", async () => {
    const session = {
      accessToken: "stored-token",
      isActive: vi.fn(() => true),
    };
    const loadSession = vi.fn(() => session);
    const getCurrentId = vi.fn(() => "online-session-id");
    vi.doMock("@/app/modules/shopify/session-storage", () => ({
      getShopifySessionStorage: vi.fn(() => ({ loadSession })),
    }));
    vi.doMock("@/infra/provider", () => ({
      getShopifyConfigProvider: vi.fn(() => ({
        config: { scopes: ["read_products"] },
        session: { getCurrentId },
      })),
    }));

    const { loadActiveShopifyOnlineSession } =
      await import("@/app/modules/shopify/session");
    const context = createMockContext();

    await expect(
      loadActiveShopifyOnlineSession(context as never),
    ).resolves.toBe(session);
    expect(getCurrentId).toHaveBeenCalledWith({
      isOnline: true,
      rawRequest: context.req.raw,
    });
    expect(loadSession).toHaveBeenCalledWith("online-session-id");
    expect(session.isActive).toHaveBeenCalledWith(["read_products"]);
  });

  it("returns undefined when no active online session can be loaded", async () => {
    const inactiveSession = {
      accessToken: "stored-token",
      isActive: vi.fn(() => false),
    };
    const loadSession = vi.fn(() => inactiveSession);
    const getCurrentId = vi
      .fn()
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce("inactive-session-id");
    vi.doMock("@/app/modules/shopify/session-storage", () => ({
      getShopifySessionStorage: vi.fn(() => ({ loadSession })),
    }));
    vi.doMock("@/infra/provider", () => ({
      getShopifyConfigProvider: vi.fn(() => ({
        config: { scopes: ["read_products"] },
        session: { getCurrentId },
      })),
    }));

    const { loadActiveShopifyOnlineSession } =
      await import("@/app/modules/shopify/session");
    const context = createMockContext();

    await expect(
      loadActiveShopifyOnlineSession(context as never),
    ).resolves.toBeUndefined();
    expect(loadSession).not.toHaveBeenCalled();

    await expect(
      loadActiveShopifyOnlineSession(context as never),
    ).resolves.toBeUndefined();
    expect(loadSession).toHaveBeenCalledWith("inactive-session-id");
    expect(inactiveSession.isActive).toHaveBeenCalledWith(["read_products"]);
  });

  it("exchanges session tokens, stores sessions, and exposes session context", async () => {
    const session = {
      id: "online-session-id",
      shop: "shop.myshopify.com",
      accessToken: "new-token",
    };
    const tokenExchange = vi.fn(() => ({ session }));
    const storeSession = vi.fn();
    vi.doMock("@/app/modules/shopify/session-storage", () => ({
      getShopifySessionStorage: vi.fn(() => ({ storeSession })),
    }));
    vi.doMock("@/infra/provider", () => ({
      getShopifyConfigProvider: vi.fn(() => ({
        auth: { tokenExchange },
      })),
    }));

    const { exchangeShopifyOnlineSession, setShopifySessionContext } =
      await import("@/app/modules/shopify/session");
    const context = createMockContext({
      headers: { Authorization: "Bearer session-token" },
      vars: { shopDomain: "shop.myshopify.com" },
    });

    await expect(exchangeShopifyOnlineSession(context as never)).resolves.toBe(
      session,
    );
    expect(tokenExchange).toHaveBeenCalledWith(
      expect.objectContaining({
        shop: "shop.myshopify.com",
        sessionToken: "session-token",
      }),
    );
    expect(storeSession).toHaveBeenCalledWith(session);

    setShopifySessionContext(context as never, session as never);
    expect(context.var.shopifySession).toBe(session);
    expect(context.var.shopifyAccessToken).toBe("new-token");
  });

  it("rejects malformed token exchange inputs and sessions without access tokens", async () => {
    vi.doMock("@/app/modules/shopify/session-storage", () => ({
      getShopifySessionStorage: vi.fn(),
    }));
    vi.doMock("@/infra/provider", () => ({
      getShopifyConfigProvider: vi.fn(() => ({
        auth: { tokenExchange: vi.fn(() => ({ session: {} })) },
      })),
    }));

    const { exchangeShopifyOnlineSession, setShopifySessionContext } =
      await import("@/app/modules/shopify/session");

    await expect(
      exchangeShopifyOnlineSession(createMockContext() as never),
    ).rejects.toThrow("Missing or malformed Authorization header");
    await expect(
      exchangeShopifyOnlineSession(
        createMockContext({
          headers: { Authorization: "Basic token" },
        }) as never,
      ),
    ).rejects.toThrow("Missing or malformed Authorization header");
    await expect(
      exchangeShopifyOnlineSession(
        createMockContext({
          headers: { Authorization: "Bearer session-token" },
          vars: { shopDomain: "shop.myshopify.com" },
        }) as never,
      ),
    ).rejects.toThrow("Token exchange did not return an access token");
    expect(() =>
      setShopifySessionContext(createMockContext() as never, {} as never),
    ).toThrow("Shopify session does not have an access token");
  });

  it("refreshes online sessions by deleting known session IDs before exchange", async () => {
    const deleteSession = vi.fn();
    const storeSession = vi.fn();
    const getCurrentId = vi.fn(() => "current-session-id");
    const freshSession = {
      id: "fresh-session-id",
      accessToken: "fresh-token",
      shop: "shop.myshopify.com",
    };
    vi.doMock("@/app/modules/shopify/session-storage", () => ({
      getShopifySessionStorage: vi.fn(() => ({
        deleteSession,
        storeSession,
      })),
    }));
    vi.doMock("@/infra/provider", () => ({
      getShopifyConfigProvider: vi.fn(() => ({
        session: { getCurrentId },
        auth: { tokenExchange: vi.fn(() => ({ session: freshSession })) },
      })),
    }));

    const { refreshShopifyOnlineSession } =
      await import("@/app/modules/shopify/session");
    const context = createMockContext({
      headers: { Authorization: "Bearer session-token" },
      vars: {
        shopDomain: "shop.myshopify.com",
        shopifySession: { id: "stored-session-id" },
      },
    });

    await expect(refreshShopifyOnlineSession(context as never)).resolves.toBe(
      freshSession,
    );
    expect(deleteSession).toHaveBeenCalledWith("stored-session-id");
    expect(deleteSession).toHaveBeenCalledWith("current-session-id");
    expect(storeSession).toHaveBeenCalledWith(freshSession);
  });

  it("refreshes online sessions without deleting when no session IDs are available", async () => {
    const deleteSession = vi.fn();
    const freshSession = {
      id: "fresh-session-id",
      accessToken: "fresh-token",
      shop: "shop.myshopify.com",
    };
    vi.doMock("@/app/modules/shopify/session-storage", () => ({
      getShopifySessionStorage: vi.fn(() => ({
        deleteSession,
        storeSession: vi.fn(),
      })),
    }));
    vi.doMock("@/infra/provider", () => ({
      getShopifyConfigProvider: vi.fn(() => ({
        session: { getCurrentId: vi.fn(() => undefined) },
        auth: { tokenExchange: vi.fn(() => ({ session: freshSession })) },
      })),
    }));

    const { refreshShopifyOnlineSession } =
      await import("@/app/modules/shopify/session");

    await expect(
      refreshShopifyOnlineSession(
        createMockContext({
          headers: { Authorization: "Bearer session-token" },
          vars: { shopDomain: "shop.myshopify.com" },
        }) as never,
      ),
    ).resolves.toBe(freshSession);
    expect(deleteSession).not.toHaveBeenCalled();
  });
});

describe("Shopify account session", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/infra/provider");
    vi.doUnmock("@/app/modules/shopify/session-storage");
  });

  it("commits account session cookies from Shopify sessions", async () => {
    const { DEFAULT_APP_ACCOUNT_SESSION_COOKIE } = await import("@/constants");
    const {
      commitShopifyAccountSession,
      createShopifyAccountSession,
      hasShopifyAccountSession,
    } = await import("@/app/modules/shopify/account/session");
    const context = createMockContext();
    const httpContext = createMockContext({
      vars: {
        runtimeEnv: {
          ...runtimeConfig,
          SHOPIFY_APP_URL: "http://localhost:3000",
        },
      },
    });
    const accountContext = createMockContext({
      headers: {
        Cookie: `theme=light; ${DEFAULT_APP_ACCOUNT_SESSION_COOKIE}=offline_shop.myshopify.com`,
      },
    });
    const accountSession = createShopifyAccountSession({
      id: "offline_shop.myshopify.com",
      shop: "shop.myshopify.com",
    } as never);

    const cookie = commitShopifyAccountSession(
      context as never,
      accountSession,
    );
    const httpCookie = commitShopifyAccountSession(
      httpContext as never,
      accountSession,
    );

    expect(accountSession).toEqual({
      id: "offline_shop.myshopify.com",
      shop: "shop.myshopify.com",
      shopifySessionId: "offline_shop.myshopify.com",
    });
    expect(cookie).toContain(
      ":account_session_cookie=offline_shop.myshopify.com",
    );
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("; Secure");
    expect(httpCookie).not.toContain("; Secure");
    expect(hasShopifyAccountSession(createMockContext() as never)).toBe(false);
    expect(
      hasShopifyAccountSession(
        createMockContext({
          headers: { Cookie: "theme=light; other=value" },
        }) as never,
      ),
    ).toBe(false);
    expect(hasShopifyAccountSession(accountContext as never)).toBe(true);
  });

  it("encodes and decodes account session cookie values", async () => {
    const { DEFAULT_APP_ACCOUNT_SESSION_COOKIE } = await import("@/constants");
    const session = {
      id: "offline/shop.myshopify.com",
      shop: "shop.myshopify.com",
      accessToken: "offline-token",
      isActive: vi.fn(() => true),
    };
    const loadSession = vi.fn(() => session);
    vi.doMock("@/app/modules/shopify/session-storage", () => ({
      getShopifySessionStorage: vi.fn(() => ({ loadSession })),
    }));
    vi.doMock("@/infra/provider", () => ({
      getShopifyConfigProvider: vi.fn(() => ({
        config: { scopes: ["read_products"] },
      })),
    }));
    const { commitShopifyAccountSession, loadShopifySessionForAccount } =
      await import("@/app/modules/shopify/account/session");

    const cookie = commitShopifyAccountSession(createMockContext() as never, {
      id: "offline/shop.myshopify.com",
      shop: "shop.myshopify.com",
      shopifySessionId: "offline/shop.myshopify.com",
    });
    const cookieValue = cookie.match(
      new RegExp(`${DEFAULT_APP_ACCOUNT_SESSION_COOKIE}=([^;]+)`),
    )?.[1];

    await expect(
      loadShopifySessionForAccount(
        createMockContext({
          headers: {
            Cookie: `${DEFAULT_APP_ACCOUNT_SESSION_COOKIE}=${cookieValue}`,
          },
        }) as never,
      ),
    ).resolves.toBe(session);
    expect(loadSession).toHaveBeenCalledWith("offline/shop.myshopify.com");
  });

  it("loads active Shopify sessions through the account session cookie", async () => {
    const { DEFAULT_APP_ACCOUNT_SESSION_COOKIE } = await import("@/constants");
    const session = {
      id: "offline_shop.myshopify.com",
      shop: "shop.myshopify.com",
      accessToken: "offline-token",
      isActive: vi.fn(() => true),
    };
    const loadSession = vi.fn(() => session);
    const getShopifyConfigProvider = vi.fn(() => ({
      config: { scopes: ["read_products"] },
    }));
    vi.doMock("@/app/modules/shopify/session-storage", () => ({
      getShopifySessionStorage: vi.fn(() => ({ loadSession })),
    }));
    vi.doMock("@/infra/provider", () => ({
      getShopifyConfigProvider,
    }));

    const { loadShopifySessionForAccount } =
      await import("@/app/modules/shopify/account/session");
    const context = createMockContext({
      headers: {
        Cookie: `${DEFAULT_APP_ACCOUNT_SESSION_COOKIE}=offline_shop.myshopify.com`,
      },
    });

    await expect(loadShopifySessionForAccount(context as never)).resolves.toBe(
      session,
    );
    expect(loadSession).toHaveBeenCalledWith("offline_shop.myshopify.com");
    expect(session.isActive).toHaveBeenCalledWith(["read_products"]);
  });

  it("rejects requests without an account session cookie", async () => {
    const { loadShopifySessionForAccount } =
      await import("@/app/modules/shopify/account/session");

    await expect(
      loadShopifySessionForAccount(createMockContext() as never),
    ).rejects.toSatisfy((error) => {
      expectAppError(error, 401, "Missing app account session");
      return true;
    });
  });

  it("rejects missing, tokenless, and inactive Shopify sessions for account cookies", async () => {
    const { DEFAULT_APP_ACCOUNT_SESSION_COOKIE } = await import("@/constants");
    const loadSession = vi
      .fn()
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce({ id: "offline_shop.myshopify.com" })
      .mockReturnValueOnce({
        id: "offline_shop.myshopify.com",
        accessToken: "offline-token",
        isActive: vi.fn(() => false),
      });
    vi.doMock("@/app/modules/shopify/session-storage", () => ({
      getShopifySessionStorage: vi.fn(() => ({ loadSession })),
    }));
    vi.doMock("@/infra/provider", () => ({
      getShopifyConfigProvider: vi.fn(() => ({
        config: { scopes: ["read_products"] },
      })),
    }));

    const { loadShopifySessionForAccount } =
      await import("@/app/modules/shopify/account/session");
    const context = createMockContext({
      headers: {
        Cookie: `${DEFAULT_APP_ACCOUNT_SESSION_COOKIE}=offline_shop.myshopify.com`,
      },
    });

    await expect(
      loadShopifySessionForAccount(context as never),
    ).rejects.toSatisfy((error) => {
      expectAppError(error, 401, "Invalid app account session");
      return true;
    });
    await expect(
      loadShopifySessionForAccount(context as never),
    ).rejects.toSatisfy((error) => {
      expectAppError(error, 401, "Invalid app account session");
      return true;
    });
    await expect(
      loadShopifySessionForAccount(context as never),
    ).rejects.toSatisfy((error) => {
      expectAppError(error, 401, "Inactive app account session");
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

  it("rejects webhook bodies that exceed the configured size limit", async () => {
    const { DEFAULT_WEBHOOK_MAX_SIZE } = await import("@/constants");
    const { verifyWebhook } =
      await import("@/shared/middlewares/shopify/verify-webhook");

    await expect(
      verifyWebhook(
        createMockContext({
          method: "POST",
          headers: {
            "content-length": String(DEFAULT_WEBHOOK_MAX_SIZE + 1),
          },
          body: "{}",
        }) as never,
        vi.fn(),
      ),
    ).rejects.toSatisfy((error) => {
      expectAppError(error, 413, "Webhook request body overflow maxsize");
      expect(error).toMatchObject({
        details: { maxSize: DEFAULT_WEBHOOK_MAX_SIZE },
      });
      return true;
    });
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
