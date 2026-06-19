import { shopifyClient } from "@/utils/client.shopify";
import type { ApiResponse, JsonSerializedDates } from "@/typings/json-api";
import type {
  InsertProductExport,
  SelectProductExport,
} from "@shamt/database/sql-schemas/postgres";
import type { HttpRequestConfig } from "@shamt/oh-my-fetch";

export type ProductExportStatus = SelectProductExport["status"];

export type ProductExport = JsonSerializedDates<
  SelectProductExport,
  "completedAt" | "createdAt" | "deletedAt" | "updatedAt"
>;

export interface ProductExportsPage {
  nextCursor?: string;
  productExports: ProductExport[];
}

export interface ProductExportListInput {
  cursor?: string;
  limit?: number;
  status?: ProductExportStatus;
}

export type CreateProductExportInput = Pick<InsertProductExport, "name">;

export type ProductExportDownloadTarget =
  | {
      type: "redirect";
      url: string;
    }
  | {
      type: "stream";
      url: string;
    };

/**
 * Lists product exports for the current Shopify shop.
 */
export function listProductExports(
  input: ProductExportListInput = {},
  signal?: AbortSignal,
) {
  return shopifyClient.get<ApiResponse<ProductExportsPage>>("product-exports", {
    query: toProductExportListQuery(input),
    signal,
  });
}

/**
 * Creates a product export job for the current Shopify shop.
 */
export function createProductExport(
  input: CreateProductExportInput,
  signal?: AbortSignal,
) {
  return shopifyClient.post<
    ApiResponse<ProductExport>,
    CreateProductExportInput
  >("product-exports", input, { signal });
}

/**
 * Fetches one product export by ID.
 */
export function getProductExport(id: string, signal?: AbortSignal) {
  return shopifyClient.get<ApiResponse<ProductExport>>(
    `product-exports/${encodeURIComponent(id)}`,
    { signal },
  );
}

/**
 * Soft-deletes one product export by ID.
 */
export function deleteProductExport(id: string, signal?: AbortSignal) {
  return shopifyClient.delete(`product-exports/${encodeURIComponent(id)}`, {
    signal,
  });
}

/**
 * Downloads the generated CSV response for one ready product export.
 */
export function downloadProductExport(id: string, signal?: AbortSignal) {
  return shopifyClient.get<Response>(
    `product-exports/${encodeURIComponent(id)}/download`,
    {
      responseType: "response",
      signal,
    },
  );
}

/**
 * Resolves the browser download target without following cross-origin R2
 * redirects inside fetch, which would require bucket CORS.
 */
export function resolveProductExportDownload(id: string, signal?: AbortSignal) {
  return shopifyClient.get<ApiResponse<ProductExportDownloadTarget>>(
    `product-exports/${encodeURIComponent(id)}/download`,
    {
      headers: {
        Accept: "application/json",
      },
      signal,
    },
  );
}

/**
 * Downloads a ready product export CSV using the browser download affordance.
 */
export async function downloadProductExportFile(
  productExport: ProductExport,
  signal?: AbortSignal,
) {
  const target = await resolveProductExportDownload(productExport.id, signal);
  const data = target.data;

  if (!data?.url) {
    throw new Error("Download response did not include a URL");
  }

  if (data.type === "redirect") {
    triggerBrowserDownload(data.url, getProductExportFilename(productExport));
    return;
  }

  const response = await downloadProductExport(productExport.id, signal);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  triggerBrowserDownload(objectUrl, getProductExportFilename(productExport));
  URL.revokeObjectURL(objectUrl);
}

function toProductExportListQuery(
  input: ProductExportListInput,
): HttpRequestConfig["query"] {
  return {
    cursor: input.cursor,
    limit: input.limit,
    status: input.status,
  };
}

function triggerBrowserDownload(url: string, filename: string) {
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
}

function getProductExportFilename(productExport: ProductExport) {
  const name = productExport.name.trim();
  if (!name) return "products.csv";
  if (name.toLowerCase().endsWith(".csv")) return sanitizeFilename(name);
  return `${sanitizeFilename(name)}.csv`;
}

function sanitizeFilename(value: string) {
  return value.replaceAll(/[\\/]/g, "-").replaceAll(/\s+/g, " ").trim();
}
