import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Empty } from "@/components/empty";
import { Offline } from "@/components/errors";
import { Loading } from "@/components/loading";
import {
  productExportListQueryOptions,
  useDeleteProductExportMutation,
  useDownloadProductExportMutation,
  useIsOnline,
} from "./-queries";
import type {
  ProductExport,
  ProductExportStatus,
} from "@/apis/product-exports";

export const Route = createFileRoute("/product-export/")({
  component: ProductExportIndex,
});

const TERMINAL_STATUSES = new Set<ProductExportStatus>([
  "canceled",
  "failed",
  "ready",
]);

const PRODUCT_EXPORT_LIST_INPUT = { limit: 20 };
const PRODUCT_EXPORT_POLL_MS = 1000 * 60 * 5;

function ProductExportIndex() {
  const deleteMutation = useDeleteProductExportMutation();
  const downloadMutation = useDownloadProductExportMutation();
  const isOnline = useIsOnline();
  const [productExportToDelete, setProductExportToDelete] = useState<
    ProductExport | undefined
  >(undefined);
  const productExportsQuery = useQuery({
    ...productExportListQueryOptions(PRODUCT_EXPORT_LIST_INPUT),
    refetchInterval: (query) =>
      query.state.data?.data?.result.some(
        (row) => !TERMINAL_STATUSES.has(row.status),
      )
        ? PRODUCT_EXPORT_POLL_MS
        : false,
  });
  const productExports = productExportsQuery.data?.data?.result ?? [];
  const deletingProductExportId = deleteMutation.isPending
    ? deleteMutation.variables
    : undefined;
  const downloadingProductExportId = downloadMutation.isPending
    ? downloadMutation.variables?.id
    : undefined;

  if (!isOnline) {
    return <Offline scope="page" />;
  }

  async function handleDownload(productExport: ProductExport) {
    setLoading(true);

    try {
      await downloadMutation.mutateAsync(productExport);
      showToast("Product export download started.");
    } catch (error) {
      showToast(getErrorMessage(error), { isError: true });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(productExport: ProductExport) {
    if (deletingProductExportId) return;

    setLoading(true);

    try {
      await deleteMutation.mutateAsync(productExport.id);
      showToast("Product export deleted.");
      setProductExportToDelete(undefined);
    } catch (error) {
      showToast(getErrorMessage(error), { isError: true });
    } finally {
      setLoading(false);
    }
  }

  if (productExportsQuery.isLoading) {
    return (
      <Loading
        heading="Product export"
        message="Loading product export actions"
        scope="page"
      />
    );
  }

  const errorMessage =
    productExportsQuery.error && getErrorMessage(productExportsQuery.error);

  return (
    <s-page heading="Product export">
      <s-button
        href="/product-export/new"
        slot="primary-action"
        variant="primary"
      >
        Create
      </s-button>

      {errorMessage ? (
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
                const isDownloading =
                  downloadingProductExportId === productExport.id;
                const isDeleting = deletingProductExportId === productExport.id;

                return (
                  <s-table-row key={productExport.id}>
                    <s-table-cell>
                      <s-link href={`/product-export/${productExport.id}`}>
                        {productExport.name}
                      </s-link>
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
                          disabled={!canDownload || isDownloading}
                          icon="download"
                          loading={isDownloading}
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
                          command="--show"
                          commandFor="delete-product-export-modal"
                          disabled={Boolean(deletingProductExportId)}
                          icon="delete"
                          loading={isDeleting}
                          tone="critical"
                          variant="secondary"
                          onClick={() => {
                            setProductExportToDelete(productExport);
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

      <s-modal
        id="delete-product-export-modal"
        heading="Delete product export?"
      >
        <s-stack gap="base">
          <s-text>Are you sure you want to delete product export?</s-text>
          <s-text tone="caution">This action cannot be undone.</s-text>
        </s-stack>
        <s-button
          slot="primary-action"
          variant="primary"
          tone="critical"
          commandFor="delete-product-export-modal"
          command="--hide"
          onClick={() => {
            if (!productExportToDelete) return;

            handleDelete(productExportToDelete).catch((error: unknown) => {
              showToast(getErrorMessage(error), {
                isError: true,
              });
            });
          }}
          disabled={
            !productExportToDelete ||
            Boolean(
              deletingProductExportId &&
              deletingProductExportId !== productExportToDelete.id,
            )
          }
          loading={deletingProductExportId === productExportToDelete?.id}
        >
          Delete
        </s-button>
        <s-button
          slot="secondary-actions"
          variant="secondary"
          commandFor="delete-product-export-modal"
          command="--hide"
          onClick={() => {
            setProductExportToDelete(undefined);
          }}
        >
          Cancel
        </s-button>
      </s-modal>
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
