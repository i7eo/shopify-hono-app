import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  fetchProducts,
  fetchShopInfo,
  type ProductNode,
  type ShopInfo,
} from "@/apis/shopify";
import { ShopifyAuthRedirectError } from "@/utils/client.shopify";

export const Route = createFileRoute("/product-export/")({
  component: ProductExport,
});

interface ProductExportState {
  error?: string;
  products: ProductNode[];
  shop?: ShopInfo;
  status: "loading" | "ready" | "redirecting" | "error";
}

function ProductExport() {
  const [state, setState] = useState<ProductExportState>({
    products: [],
    status: "loading",
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadProductExportData() {
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

    loadProductExportData();

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <s-page heading="Product export">
      <s-button slot="primary-action" variant="primary">
        Export catalog
      </s-button>
      <s-button slot="secondary-actions" variant="secondary">
        Schedule export
      </s-button>

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

      <s-section heading="Shop">
        <s-box id="shop-info" border="base" borderRadius="base" padding="base">
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

      <s-section heading="Export queue">
        <s-text color="subdued">
          Select products to include in your next catalog export.
        </s-text>
      </s-section>

      <s-section padding="none" accessibilityLabel="Products export table">
        {state.status === "loading" ? (
          <s-box padding="base">
            <s-spinner
              accessibilityLabel="Loading products"
              size="base"
            ></s-spinner>
          </s-box>
        ) : state.products.length > 0 ? (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Product</s-table-header>
              <s-table-header>Format</s-table-header>
              <s-table-header>Status</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {state.products.map((product) => (
                <s-table-row key={product.id}>
                  <s-table-cell>
                    <s-link href="#">{product.title}</s-link>
                  </s-table-cell>
                  <s-table-cell>CSV</s-table-cell>
                  <s-table-cell>
                    <s-badge tone="success">Ready</s-badge>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        ) : (
          <s-box padding="base">
            <s-text color="subdued">No products found.</s-text>
          </s-box>
        )}
      </s-section>
    </s-page>
  );
}

function isAuthRedirectError(error: unknown) {
  return error instanceof ShopifyAuthRedirectError;
}
