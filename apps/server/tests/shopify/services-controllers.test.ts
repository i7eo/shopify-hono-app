import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockContext, logger } from "./test-utils";

describe("Shopify services", () => {
  it("fetches products, handles empty data, and wraps GraphQL errors", async () => {
    const { getProducts } =
      await import("@/app/modules/shopify/product/service");
    const client = {
      request: vi
        .fn()
        .mockResolvedValueOnce({
          data: {
            products: {
              edges: [
                {
                  node: {
                    id: "gid://shopify/Product/1",
                    title: "Board",
                    status: "ACTIVE",
                  },
                },
              ],
            },
          },
        })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ errors: [{ message: "GraphQL failed" }] }),
    };

    await expect(getProducts(client as never)).resolves.toEqual({
      products: {
        edges: [
          {
            node: {
              id: "gid://shopify/Product/1",
              title: "Board",
              status: "ACTIVE",
            },
          },
        ],
      },
    });
    expect(client.request.mock.calls[0][0]).toContain("products(first: 5)");
    await expect(getProducts(client as never)).resolves.toBeNull();
    await expect(getProducts(client as never)).rejects.toMatchObject({
      status: 502,
      message: "Failed to fetch products",
      details: { errors: [{ message: "GraphQL failed" }] },
    });
  });

  it("fetches shop info, handles empty data, and wraps GraphQL errors", async () => {
    const { getShopInfo } = await import("@/app/modules/shopify/shop/service");
    const client = {
      request: vi
        .fn()
        .mockResolvedValueOnce({
          data: {
            shop: {
              name: "Test Shop",
              email: "merchant@example.com",
              myshopifyDomain: "test.myshopify.com",
            },
          },
        })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ errors: [{ message: "GraphQL failed" }] }),
    };

    await expect(getShopInfo(client as never)).resolves.toEqual({
      shop: {
        name: "Test Shop",
        email: "merchant@example.com",
        myshopifyDomain: "test.myshopify.com",
      },
    });
    expect(client.request.mock.calls[0][0]).toContain("myshopifyDomain");
    await expect(getShopInfo(client as never)).resolves.toBeNull();
    await expect(getShopInfo(client as never)).rejects.toMatchObject({
      status: 502,
      message: "Failed to fetch shop info",
      details: { errors: [{ message: "GraphQL failed" }] },
    });
  });
});

describe("Shopify controllers", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/infra/provider");
    vi.doUnmock("@/app/modules/shopify/admin");
    vi.doUnmock("@/app/modules/shopify/product/service");
    vi.doUnmock("@/app/modules/shopify/shop/service");
  });

  function createOpenApiContext() {
    return {
      get: vi.fn((key: string) =>
        key === "requestId" ? "req_test" : undefined,
      ),
      json: vi.fn((body, status) => ({ body, status })),
    };
  }

  it("registers product controller success and error handlers", async () => {
    const { AppError } = await import("@/shared/models");
    const runWithShopifyAdminClient = vi.fn((_c, operation) =>
      operation({ id: "client" }),
    );
    vi.doMock("@/app/modules/shopify/admin", () => ({
      runWithShopifyAdminClient,
    }));
    const getProducts = vi
      .fn()
      .mockResolvedValueOnce({ products: { edges: [] } })
      .mockRejectedValueOnce(
        new AppError({ status: 502, message: "App failure" }),
      )
      .mockRejectedValueOnce(new Error("boom"));
    vi.doMock("@/app/modules/shopify/product/service", () => ({
      getProducts,
    }));

    const { registerProductController } =
      await import("@/app/modules/shopify/product/controller");
    const app = { openapi: vi.fn() };
    registerProductController(app as never);
    const handler = app.openapi.mock.calls[0][1];
    const context = createOpenApiContext();

    expect(await handler(context)).toEqual({
      status: 200,
      body: expect.objectContaining({
        data: { products: { edges: [] } },
        requestId: "req_test",
        success: true,
      }),
    });
    await expect(handler(createOpenApiContext())).rejects.toMatchObject({
      message: "App failure",
      status: 502,
    });
    await expect(handler(createOpenApiContext())).rejects.toMatchObject({
      message: "Failed to fetch products",
      status: 502,
      details: { message: "boom" },
    });
  });

  it("registers shop controller success and error handlers", async () => {
    const { AppError } = await import("@/shared/models");
    const runWithShopifyAdminClient = vi.fn((_c, operation) =>
      operation({ id: "client" }),
    );
    vi.doMock("@/app/modules/shopify/admin", () => ({
      runWithShopifyAdminClient,
    }));
    const getShopInfo = vi
      .fn()
      .mockResolvedValueOnce({
        shop: {
          name: "Test Shop",
          email: "merchant@example.com",
          myshopifyDomain: "test.myshopify.com",
        },
      })
      .mockRejectedValueOnce(
        new AppError({ status: 502, message: "App failure" }),
      )
      .mockRejectedValueOnce("boom");
    vi.doMock("@/app/modules/shopify/shop/service", () => ({
      getShopInfo,
    }));

    const { registerShopController } =
      await import("@/app/modules/shopify/shop/controller");
    const app = { openapi: vi.fn() };
    registerShopController(app as never);
    const handler = app.openapi.mock.calls[0][1];
    const context = createOpenApiContext();

    expect(await handler(context)).toEqual({
      status: 200,
      body: expect.objectContaining({
        data: {
          shop: {
            name: "Test Shop",
            email: "merchant@example.com",
            myshopifyDomain: "test.myshopify.com",
          },
        },
        requestId: "req_test",
        success: true,
      }),
    });
    await expect(handler(createOpenApiContext())).rejects.toMatchObject({
      message: "App failure",
      status: 502,
    });
    await expect(handler(createOpenApiContext())).rejects.toMatchObject({
      message: "Failed to fetch shop info",
      status: 502,
      details: { message: "boom" },
    });
  });
});

describe("Shopify Admin API client runner", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("@/infra/provider");
    vi.doUnmock("@/app/modules/shopify/session");
  });

  it("refreshes the online session and retries once after Shopify returns 401", async () => {
    const firstClient = { id: "first-client" };
    const refreshedClient = { id: "refreshed-client" };
    const refreshedSession = {
      id: "refreshed-session",
      accessToken: "fresh-token",
    };
    const getShopifyClientProvider = vi
      .fn()
      .mockResolvedValueOnce(firstClient)
      .mockResolvedValueOnce(refreshedClient);
    const refreshShopifyOnlineSession = vi.fn(() => refreshedSession);
    const setShopifySessionContext = vi.fn();

    vi.doMock("@/infra/provider", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/infra/provider")>()),
      getShopifyClientProvider,
    }));
    vi.doMock("@/app/modules/shopify/session", () => ({
      refreshShopifyOnlineSession,
      setShopifySessionContext,
    }));

    const { runWithShopifyAdminClient } =
      await import("@/app/modules/shopify/admin");
    const unauthorizedError = Object.assign(new Error("Unauthorized"), {
      response: { code: 401 },
    });
    const operation = vi
      .fn()
      .mockRejectedValueOnce(unauthorizedError)
      .mockResolvedValueOnce("ok");
    const context = createMockContext({
      vars: { shopDomain: "shop.myshopify.com" },
    });

    await expect(
      runWithShopifyAdminClient(context as never, operation),
    ).resolves.toBe("ok");

    expect(operation).toHaveBeenNthCalledWith(1, firstClient);
    expect(operation).toHaveBeenNthCalledWith(2, refreshedClient);
    expect(refreshShopifyOnlineSession).toHaveBeenCalledWith(context);
    expect(setShopifySessionContext).toHaveBeenCalledWith(
      context,
      refreshedSession,
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "Shopify Admin API returned 401 for shop.myshopify.com; refreshing online session and retrying once",
    );
  });

  it("does not refresh the online session for non-auth Shopify errors", async () => {
    const error = Object.assign(new Error("Forbidden"), {
      response: { code: 403 },
    });
    const getShopifyClientProvider = vi.fn(() => ({ id: "client" }));
    const refreshShopifyOnlineSession = vi.fn();

    vi.doMock("@/infra/provider", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/infra/provider")>()),
      getShopifyClientProvider,
    }));
    vi.doMock("@/app/modules/shopify/session", () => ({
      refreshShopifyOnlineSession,
      setShopifySessionContext: vi.fn(),
    }));

    const { runWithShopifyAdminClient } =
      await import("@/app/modules/shopify/admin");

    await expect(
      runWithShopifyAdminClient(
        createMockContext() as never,
        vi.fn().mockRejectedValue(error),
      ),
    ).rejects.toBe(error);
    expect(refreshShopifyOnlineSession).not.toHaveBeenCalled();
  });
});
