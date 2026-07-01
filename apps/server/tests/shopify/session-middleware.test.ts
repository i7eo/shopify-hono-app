import { DEFAULT_APP_DATABASE_PROVIDERS } from "@shamt/app-env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { throwAppServerError as throwError } from "../../internal";
import { createMockContext, expectAppError, runtimeConfig } from "./test-utils";

describe("Shopify session storage", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/app/modules/shopify/session-storage/database");
  });

  it("uses database session storage in Cloudflare D1 runtime", async () => {
    const database = {
      db: {},
      dialect: "sqlite",
      provider: DEFAULT_APP_DATABASE_PROVIDERS.D1,
      runtime: "cloudflare",
    };
    const sessionStorage = { kind: "database-session-storage" };
    const createDatabase = vi.fn(() => Promise.resolve(database));
    const createDatabaseShopifySessionStorage = vi.fn(() => sessionStorage);

    vi.doMock("@/infra/database", () => ({
      createDatabase,
    }));
    vi.doMock("@/app/modules/shopify/session-storage/database", () => ({
      createDatabaseShopifySessionStorage,
    }));

    const { setRuntimeCapability } = await import("@/app/runtime/capabilities");
    const { getShopifySessionStorage } =
      await import("@/app/modules/shopify/session-storage");
    //@ts-ignore
    setRuntimeCapability("databaseFactory", () => createDatabase());
    const context = createMockContext({
      vars: {
        runtimeEnv: {
          ...runtimeConfig,
          APP_DATABASE_PROVIDER: DEFAULT_APP_DATABASE_PROVIDERS.D1,
          APP_RUNTIME: "cloudflare",
          APP_ENV: "production",
        },
      },
    });

    await expect(getShopifySessionStorage(context as never)).resolves.toBe(
      sessionStorage,
    );
    expect(createDatabase).toHaveBeenCalledOnce();
    expect(createDatabaseShopifySessionStorage).toHaveBeenCalledWith(database);
  });

  it("uses database session storage in node postgres runtime", async () => {
    const database = {
      db: {},
      dialect: "postgres",
      provider: DEFAULT_APP_DATABASE_PROVIDERS.POSTGRES,
      runtime: "node",
    };
    const sessionStorage = { kind: "database-session-storage" };
    const createDatabase = vi.fn(() => Promise.resolve(database));
    const createDatabaseShopifySessionStorage = vi.fn(() => sessionStorage);

    vi.doMock("@/infra/database", () => ({
      createDatabase,
    }));
    vi.doMock("@/app/modules/shopify/session-storage/database", () => ({
      createDatabaseShopifySessionStorage,
    }));

    const { setRuntimeCapability } = await import("@/app/runtime/capabilities");
    const { getShopifySessionStorage } =
      await import("@/app/modules/shopify/session-storage");
    //@ts-ignore
    setRuntimeCapability("databaseFactory", () => createDatabase());
    const context = createMockContext({
      vars: {
        runtimeEnv: {
          ...runtimeConfig,
          APP_DATABASE_PROVIDER: DEFAULT_APP_DATABASE_PROVIDERS.POSTGRES,
          APP_RUNTIME: "node",
          APP_ENV: "development",
        },
      },
    });

    await expect(getShopifySessionStorage(context as never)).resolves.toBe(
      sessionStorage,
    );
    expect(createDatabase).toHaveBeenCalledOnce();
    expect(createDatabaseShopifySessionStorage).toHaveBeenCalledWith(database);
  });
});

describe("Shopify database session storage adapter", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/app/modules/shopify/session-storage/database");
    vi.doUnmock("@shopify/shopify-app-session-storage-drizzle");
  });

  it("creates the Postgres Drizzle session storage adapter", async () => {
    vi.doUnmock("@/app/modules/shopify/session-storage/database");
    const DrizzleSessionStoragePostgres = vi.fn(function (
      this: { db: unknown; table: unknown; type: string },
      db: unknown,
      table: unknown,
    ) {
      this.db = db;
      this.table = table;
      this.type = "postgres";
    });
    const DrizzleSessionStorageSQLite = vi.fn();

    vi.doMock("@shopify/shopify-app-session-storage-drizzle", () => ({
      DrizzleSessionStoragePostgres,
      DrizzleSessionStorageSQLite,
    }));

    const { postgresShopifySessions } =
      await import("@shamt/database/models/postgres");
    const { createDatabaseShopifySessionStorage } =
      await import("@/app/modules/shopify/session-storage/database");
    const db = { id: "pg-db" };
    const storage = createDatabaseShopifySessionStorage({
      db,
      dialect: "postgres",
      dispose: vi.fn(),
      provider: DEFAULT_APP_DATABASE_PROVIDERS.POSTGRES,
      runtime: "node",
    } as never);

    expect(DrizzleSessionStoragePostgres).toHaveBeenCalledWith(
      db,
      postgresShopifySessions,
    );
    expect(DrizzleSessionStorageSQLite).not.toHaveBeenCalled();
    expect(storage).toMatchObject({ db, table: postgresShopifySessions });
  });

  it("creates the SQLite Drizzle session storage adapter for D1", async () => {
    vi.doUnmock("@/app/modules/shopify/session-storage/database");
    const DrizzleSessionStoragePostgres = vi.fn();
    const DrizzleSessionStorageSQLite = vi.fn(function (
      this: { db: unknown; table: unknown; type: string },
      db: unknown,
      table: unknown,
    ) {
      this.db = db;
      this.table = table;
      this.type = "sqlite";
    });

    vi.doMock("@shopify/shopify-app-session-storage-drizzle", () => ({
      DrizzleSessionStoragePostgres,
      DrizzleSessionStorageSQLite,
    }));

    const { sqliteShopifySessions } =
      await import("@shamt/database/models/sqlite");
    const { createDatabaseShopifySessionStorage } =
      await import("@/app/modules/shopify/session-storage/database");
    const db = { id: "d1-db" };
    const storage = createDatabaseShopifySessionStorage({
      db,
      dialect: "sqlite",
      provider: DEFAULT_APP_DATABASE_PROVIDERS.D1,
      runtime: "cloudflare",
    } as never);

    expect(DrizzleSessionStorageSQLite).toHaveBeenCalledWith(
      db,
      sqliteShopifySessions,
    );
    expect(DrizzleSessionStoragePostgres).not.toHaveBeenCalled();
    expect(storage).toMatchObject({ db, table: sqliteShopifySessions });
  });

  it("rejects unsupported database providers", async () => {
    vi.doUnmock("@/app/modules/shopify/session-storage/database");
    vi.doMock("@shopify/shopify-app-session-storage-drizzle", () => ({
      DrizzleSessionStoragePostgres: vi.fn(),
      DrizzleSessionStorageSQLite: vi.fn(),
    }));

    const { createDatabaseShopifySessionStorage } =
      await import("@/app/modules/shopify/session-storage/database");

    expect(() =>
      createDatabaseShopifySessionStorage({
        db: {},
        dialect: "unknown",
        provider: "unsupported",
        runtime: "node",
      } as never),
    ).toThrow(
      "Shopify session storage database provider is not supported: unsupported",
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
            throwError("bad token");
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
        throwError("Token exchange did not return an access token");
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

  it("reuses active offline sessions for the current shop", async () => {
    const session = {
      accessToken: "offline-token",
      isActive: vi.fn(() => true),
      isOnline: false,
      shop: "shop.myshopify.com",
    };
    const findSessionsByShop = vi.fn(() => [session]);
    vi.doMock("@/app/modules/shopify/session-storage", () => ({
      getShopifySessionStorage: vi.fn(() => ({ findSessionsByShop })),
    }));
    vi.doMock("@/infra/provider", () => ({
      getShopifyConfigProvider: vi.fn(() => ({
        config: { scopes: ["read_products"] },
      })),
    }));

    const { ensureShopifyOfflineSession } =
      await import("@/app/modules/shopify/session");
    const context = createMockContext({
      vars: { shopDomain: "shop.myshopify.com" },
    });

    await expect(ensureShopifyOfflineSession(context as never)).resolves.toBe(
      session,
    );
    expect(findSessionsByShop).toHaveBeenCalledWith("shop.myshopify.com");
    expect(session.isActive).toHaveBeenCalledWith(["read_products"]);
  });

  it("exchanges session tokens for offline sessions when none are active", async () => {
    const session = {
      id: "offline_shop.myshopify.com",
      shop: "shop.myshopify.com",
      accessToken: "offline-token",
    };
    const findSessionsByShop = vi.fn(() => []);
    const storeSession = vi.fn();
    const tokenExchange = vi.fn(() => ({ session }));
    vi.doMock("@/app/modules/shopify/session-storage", () => ({
      getShopifySessionStorage: vi.fn(() => ({
        findSessionsByShop,
        storeSession,
      })),
    }));
    vi.doMock("@/infra/provider", () => ({
      getShopifyConfigProvider: vi.fn(() => ({
        auth: { tokenExchange },
        config: { scopes: ["read_products"] },
      })),
    }));

    const { ensureShopifyOfflineSession } =
      await import("@/app/modules/shopify/session");
    const context = createMockContext({
      headers: { Authorization: "Bearer session-token" },
      vars: { shopDomain: "shop.myshopify.com" },
    });

    await expect(ensureShopifyOfflineSession(context as never)).resolves.toBe(
      session,
    );
    expect(tokenExchange).toHaveBeenCalledWith(
      expect.objectContaining({
        shop: "shop.myshopify.com",
        sessionToken: "session-token",
      }),
    );
    expect(storeSession).toHaveBeenCalledWith(session);
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
      `${DEFAULT_APP_ACCOUNT_SESSION_COOKIE}=offline_shop.myshopify.com`,
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
      webhookId: "webhook-1",
      apiVersion: "2026-04",
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
    expect(context.var.webhook).toEqual({
      apiVersion: "2026-04",
      payload: { shop_id: 1 },
      shop: "shop.myshopify.com",
      topic: "APP_UNINSTALLED",
      webhookId: "webhook-1",
    });
    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects empty webhook bodies after validation", async () => {
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
        }) as never,
        vi.fn(),
      ),
    ).rejects.toSatisfy((error) => {
      expectAppError(error, 401, "Invalid Shopify webhook JSON payload");
      return true;
    });
  });

  it("ignores invalid webhook content-length values", async () => {
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
      headers: {
        "content-length": "not-a-number",
      },
      body: JSON.stringify({ ok: true }),
    });

    await verifyWebhook(context as never, next);

    expect(validate).toHaveBeenCalledWith({
      rawRequest: context.req.raw,
      rawBody: '{"ok":true}',
    });
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

  it("rejects streamed webhook bodies that overflow without content-length", async () => {
    const { DEFAULT_WEBHOOK_MAX_SIZE } = await import("@/constants");
    const { verifyWebhook } =
      await import("@/shared/middlewares/shopify/verify-webhook");
    const raw = new Request("https://app.example.com/webhook", {
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(DEFAULT_WEBHOOK_MAX_SIZE + 1));
          controller.close();
        },
        cancel: vi.fn(),
      }),
      // Node's Request implementation requires duplex for streaming bodies.
      duplex: "half",
      method: "POST",
    } as RequestInit & { duplex: "half" });

    await expect(
      verifyWebhook(
        {
          req: { raw },
          get: vi.fn(() => runtimeConfig),
          set: vi.fn(),
          var: {},
        } as never,
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

  it("ignores reader cancel failures after streamed webhook overflow", async () => {
    const { DEFAULT_WEBHOOK_MAX_SIZE } = await import("@/constants");
    const { verifyWebhook } =
      await import("@/shared/middlewares/shopify/verify-webhook");
    const cancel = vi.fn(() => Promise.reject(new Error("cancel failed")));
    const raw = {
      clone: () => ({
        body: {
          getReader: () => ({
            cancel,
            read: vi.fn(() =>
              Promise.resolve({
                done: false,
                value: new Uint8Array(DEFAULT_WEBHOOK_MAX_SIZE + 1),
              }),
            ),
          }),
        },
      }),
      headers: new Headers(),
    };

    await expect(
      verifyWebhook(
        {
          req: { raw },
          get: vi.fn(() => runtimeConfig),
          set: vi.fn(),
          var: {},
        } as never,
        vi.fn(),
      ),
    ).rejects.toSatisfy((error) => {
      expectAppError(error, 413, "Webhook request body overflow maxsize");
      return true;
    });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("rejects invalid webhook signatures", async () => {
    const validation = { valid: false, reason: "invalid_hmac" };
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
      expectAppError(error, 401, "Webhook HMAC validation failed");
      expect(error).toMatchObject({ details: { validation } });
      return true;
    });
  });

  it("rejects invalid webhook requests with a bad request error", async () => {
    const validation = {
      missingHeaders: ["X-Shopify-Webhook-Id"],
      reason: "missing_headers",
      valid: false,
    };
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
      expectAppError(error, 400, "Webhook request is invalid");
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
