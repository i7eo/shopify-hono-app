import { describe, expect, it } from "vitest";

describe("Shopify runtime re-exports", () => {
  it("re-exports Shopify middleware functions", async () => {
    const middleware = await import("@/shared/middlewares/shopify");

    expect(middleware.verifySessionToken).toBeTypeOf("function");
    expect(middleware.tokenExchange).toBeTypeOf("function");
    expect(middleware.verifyWebhook).toBeTypeOf("function");
  });

  it("re-exports Shopify module controllers", async () => {
    const product = await import("@/app/modules/shopify/product");
    const shop = await import("@/app/modules/shopify/shop");

    expect(product.registerProductController).toBeTypeOf("function");
    expect(shop.registerShopController).toBeTypeOf("function");
  });

  it("exports Shopify route constants", async () => {
    const constants = await import("@/app/modules/shopify/constants");

    expect(constants.apiPath).toBe("/api/shopify");
    expect(constants.tag).toBe("Api - Shopify");
    expect(constants.tags).toEqual(["Api - Shopify"]);
  });
});
