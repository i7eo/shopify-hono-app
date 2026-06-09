import { describe, expect, it, vi } from "vitest";

describe("Shopify runtime re-exports", () => {
  it("re-exports Shopify middleware functions", async () => {
    const middleware = await import("@/shared/middlewares/shopify");

    expect(middleware.verifySessionToken).toBeTypeOf("function");
    expect(middleware.tokenExchange).toBeTypeOf("function");
    expect(middleware.verifyWebhook).toBeTypeOf("function");
  });

  it("exports Shopify-backed resource module controllers outside Shopify app flow", async () => {
    const product = await import("@/app/modules/product");
    const shop = await import("@/app/modules/shop");

    expect(product.registerProductController).toBeTypeOf("function");
    expect(shop.registerShopController).toBeTypeOf("function");
  });

  it("exports Shopify-backed resource route constants", async () => {
    const productConstants = await import("@/app/modules/product/constants");
    const shopConstants = await import("@/app/modules/shop/constants");

    expect(productConstants.apiPath).toBe("/api/product");
    expect(productConstants.tag).toBe("Api - Product");
    expect(productConstants.tags).toEqual(["Api - Product"]);
    expect(shopConstants.apiPath).toBe("/api/shop");
    expect(shopConstants.tag).toBe("Api - Shop");
    expect(shopConstants.tags).toEqual(["Api - Shop"]);
  });

  it("supports resetting and disposing Shopify mode capabilities", async () => {
    const mode = await import("@/app/modules/shopify/mode");
    const embedded = mode.getShopifyModeCapabilities("embedded");
    const standalone = mode.getShopifyModeCapabilities("standalone");
    const dispose = vi.fn();

    mode.setShopifyModeCapabilities("embedded", embedded, dispose);
    mode.resetShopifyModeCapability("embedded");
    expect(() => mode.getShopifyModeCapabilities("embedded")).toThrow(
      "Shopify app mode is not registered: embedded",
    );

    mode.setShopifyModeCapabilities("embedded", embedded, dispose);
    await mode.disposeShopifyModeCapabilities();
    expect(dispose).toHaveBeenCalledOnce();
    expect(() => mode.getShopifyModeCapabilities("embedded")).toThrow(
      "Shopify app mode is not registered: embedded",
    );

    mode.setShopifyModeCapabilities("embedded", embedded);
    mode.setShopifyModeCapabilities("standalone", standalone);
  });
});
