import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteProductExport,
  downloadProductExportFile,
  listProductExports,
  type ProductExport,
  type ProductExportStatus,
} from "@/apis/product-exports";
import { Empty } from "@/components/empty";

export const Route = createFileRoute("/product-export/")({
  component: ProductExportIndex,
});

const PRODUCT_EXPORT_POLL_MS = 1000 * 60 * 5;
const TERMINAL_STATUSES = new Set<ProductExportStatus>([
  "canceled",
  "failed",
  "ready",
]);

type LoadState = "idle" | "loading" | "ready" | "error";

function ProductExportIndex() {
  const abortControllerRef = useRef<AbortController | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState("");
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [productExports, setProductExports] = useState<ProductExport[]>([]);

  const loadExports = useCallback(
    async (options: { silent?: boolean } = {}) => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (!options.silent) {
        setLoadState("loading");
        setErrorMessage("");
      }

      try {
        const response = await listProductExports(
          { limit: 20 },
          controller.signal,
        );
        setProductExports(response.data?.result ?? []);
        setLoadState("ready");
      } catch (error) {
        if (!controller.signal.aborted) {
          setErrorMessage(getErrorMessage(error));
          setLoadState("error");
        }
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = undefined;
        }
      }
    },
    [],
  );

  useEffect(() => {
    loadExports().catch((error: unknown) => {
      setErrorMessage(getErrorMessage(error));
      setLoadState("error");
    });

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [loadExports]);

  useEffect(() => {
    if (!productExports.some((row) => !TERMINAL_STATUSES.has(row.status))) {
      return;
    }

    const timer = globalThis.setInterval(() => {
      loadExports({ silent: true }).catch((error: unknown) => {
        setErrorMessage(getErrorMessage(error));
        setLoadState("error");
      });
    }, PRODUCT_EXPORT_POLL_MS);

    return () => {
      globalThis.clearInterval(timer);
    };
  }, [loadExports, productExports]);

  async function handleDownload(productExport: ProductExport) {
    const controller = new AbortController();
    setLoading(true);

    try {
      await downloadProductExportFile(productExport, controller.signal);
      showToast("Product export download started.");
    } catch (error) {
      showToast(getErrorMessage(error), { isError: true });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(productExport: ProductExport) {
    const controller = new AbortController();
    setLoading(true);

    try {
      await deleteProductExport(productExport.id, controller.signal);
      showToast("Product export deleted.");
      await loadExports({ silent: true });
    } catch (error) {
      showToast(getErrorMessage(error), { isError: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <s-page heading="Product export">
      <s-button
        href="/product-export/new"
        slot="primary-action"
        variant="primary"
      >
        Create
      </s-button>

      {loadState === "loading" ? (
        <s-section>
          <s-spinner
            accessibilityLabel="Loading product export actions"
            size="base"
          ></s-spinner>
        </s-section>
      ) : loadState === "error" ? (
        <s-section>
          <s-banner heading="Unable to load product exports" tone="critical">
            <s-text>{errorMessage}</s-text>
          </s-banner>
        </s-section>
      ) : productExports.length === 0 ? (
        <Empty
          heading="No product exports"
          message="Create a product export to generate a CSV file from your Shopify products."
          scope="inline"
        />
      ) : (
        <s-section padding="none" accessibilityLabel="Product exports">
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Export</s-table-header>
              <s-table-header>Created</s-table-header>
              <s-table-header>Products</s-table-header>
              <s-table-header listSlot="secondary">Status</s-table-header>
              <s-table-header>Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {productExports.map((productExport) => {
                const status = getStatusDisplay(productExport.status);
                const canDownload = productExport.status === "ready";

                return (
                  <s-table-row key={productExport.id}>
                    <s-table-cell>
                      <s-text type="strong">{productExport.name}</s-text>
                    </s-table-cell>
                    <s-table-cell>
                      {formatDateTime(productExport.createdAt)}
                    </s-table-cell>
                    <s-table-cell>
                      {formatCount(productExport.objectCount)}
                    </s-table-cell>
                    <s-table-cell>
                      <s-badge tone={status.tone}>{status.label}</s-badge>
                    </s-table-cell>
                    <s-table-cell>
                      <s-stack direction="inline" gap="small-200">
                        <s-button
                          accessibilityLabel={`Download ${productExport.name}`}
                          disabled={!canDownload}
                          icon="download"
                          variant="secondary"
                          onClick={() => {
                            handleDownload(productExport).catch(
                              (error: unknown) => {
                                showToast(getErrorMessage(error), {
                                  isError: true,
                                });
                              },
                            );
                          }}
                        >
                          Download
                        </s-button>
                        <s-button
                          accessibilityLabel={`Delete ${productExport.name}`}
                          icon="delete"
                          tone="critical"
                          variant="secondary"
                          onClick={() => {
                            handleDelete(productExport).catch(
                              (error: unknown) => {
                                showToast(getErrorMessage(error), {
                                  isError: true,
                                });
                              },
                            );
                          }}
                        >
                          Delete
                        </s-button>
                      </s-stack>
                    </s-table-cell>
                  </s-table-row>
                );
              })}
            </s-table-body>
          </s-table>
        </s-section>
      )}
    </s-page>
  );
}

function getStatusDisplay(status: ProductExportStatus): {
  label: string;
  tone: "critical" | "info" | "success" | "warning";
} {
  switch (status) {
    case "ready":
      return { label: "Ready", tone: "success" };
    case "failed":
      return { label: "Failed", tone: "critical" };
    case "canceled":
      return { label: "Canceled", tone: "critical" };
    case "requires_node_finalize":
      return { label: "Requires Node finalize", tone: "warning" };
    case "bulk_operation_running":
      return { label: "Running bulk operation", tone: "info" };
    case "bulk_operation_completed":
      return { label: "Bulk operation completed", tone: "info" };
    case "generating_csv":
      return { label: "Generating CSV", tone: "info" };
    case "queued":
      return { label: "Queued", tone: "info" };
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatCount(value: number | null) {
  return typeof value === "number" ? String(value) : "-";
}

function setLoading(isLoading: boolean) {
  globalThis.shopify?.loading(isLoading);
}

function showToast(
  message: string,
  options?: Parameters<(typeof globalThis.shopify)["toast"]["show"]>[1],
) {
  globalThis.shopify?.toast.show(message, options);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}
