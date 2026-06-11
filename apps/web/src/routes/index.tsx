import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  fetchProducts,
  fetchShopInfo,
  ShopifyAuthRedirectError,
  type ProductNode,
  type ShopInfo,
} from "@/apis/shopify";

export const Route = createFileRoute("/")({
  component: Home,
});

interface HomeState {
  error?: string;
  products: ProductNode[];
  shop?: ShopInfo;
  status: "loading" | "ready" | "redirecting" | "error";
}

function Home() {
  const [state, setState] = useState<HomeState>({
    products: [],
    status: "loading",
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadAppShellData() {
      try {
        const [shop, products] = await Promise.all([
          fetchShopInfo(controller.signal),
          fetchProducts(controller.signal),
        ]);

        setState({
          products:
            products.data?.products?.edges?.map((edge) => edge.node) ?? [],
          shop: shop.data?.shop,
          status: "ready",
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          error: error instanceof Error ? error.message : String(error),
          products: [],
          status: isAuthRedirectError(error) ? "redirecting" : "error",
        });
      }
    }

    loadAppShellData();

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <s-page heading="My Shopify App" inlineSize="base">
      {state.status === "redirecting" ? (
        <s-section>
          <s-banner tone="info">Redirecting to Shopify authorization.</s-banner>
        </s-section>
      ) : null}

      {state.status === "error" ? (
        <s-section>
          <s-banner tone="critical">{state.error}</s-banner>
        </s-section>
      ) : null}

      <s-section heading="Shop Info">
        <s-box id="shop-info">
          {state.status === "loading" ? (
            <s-spinner
              accessibilityLabel="Loading shop info"
              size="base"
            ></s-spinner>
          ) : state.shop ? (
            <>
              <s-text type="strong">{state.shop.name}</s-text>
              <s-text color="subdued"> ({state.shop.myshopifyDomain})</s-text>
            </>
          ) : (
            <s-text color="subdued">No shop info found.</s-text>
          )}
        </s-box>
      </s-section>

      <s-section heading="Products">
        <s-box id="products-container">
          {state.status === "loading" ? (
            <s-spinner
              accessibilityLabel="Loading products"
              size="base"
            ></s-spinner>
          ) : state.products.length > 0 ? (
            <s-unordered-list>
              {state.products.map((product) => (
                <s-list-item key={product.id}>{product.title}</s-list-item>
              ))}
            </s-unordered-list>
          ) : (
            <s-text color="subdued">No products found.</s-text>
          )}
        </s-box>
      </s-section>
    </s-page>
  );
}

function isAuthRedirectError(error: unknown) {
  return error instanceof ShopifyAuthRedirectError;
}
