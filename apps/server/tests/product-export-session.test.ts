import { describe, expect, it, vi } from "vitest";
import { startProductExportBulkOperationForRecord } from "@/app/modules/product-export/service";
import type { ProductExportRepository } from "@/app/modules/product-export/repositories/database";
import type { ProductExportRecord } from "@/app/modules/product-export/types";
import type { ShopifyClient } from "@/infra/provider";

describe("product export Shopify session ownership", () => {
  it("persists the offline session id used to start the bulk operation", async () => {
    const now = new Date("2026-06-18T12:00:00.000Z");
    const record = createProductExportRecord({ updatedAt: now });
    const update = vi.fn();
    const store = createProductExportRepository({ update });
    const client = {
      request: vi.fn().mockResolvedValue({
        data: {
          bulkOperationRunQuery: {
            bulkOperation: {
              id: "gid://shopify/BulkOperation/1",
              status: "CREATED",
            },
            userErrors: [],
          },
        },
      }),
    } as unknown as ShopifyClient;

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-18T12:05:00.000Z"));

    try {
      const updated = await startProductExportBulkOperationForRecord({
        client,
        record,
        shopifySessionId: "offline_test-shop.myshopify.com",
        store,
      });

      expect(updated).toMatchObject({
        shopifyBulkOperationId: "gid://shopify/BulkOperation/1",
        shopifyBulkOperationStatus: "CREATED",
        shopifySessionId: "offline_test-shop.myshopify.com",
        status: "bulk_operation_running",
      });
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          shopifySessionId: "offline_test-shop.myshopify.com",
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

function createProductExportRepository(
  overrides: Partial<ProductExportRepository> = {},
): ProductExportRepository {
  return {
    claimPart: vi.fn(),
    create: vi.fn(),
    createParts: vi.fn(),
    delete: vi.fn(),
    findByBulkOperationId: vi.fn(),
    findById: vi.fn(),
    getPartStats: vi.fn(),
    list: vi.fn(),
    listParts: vi.fn(),
    listPartsPage: vi.fn(),
    listPartsByStatus: vi.fn(),
    listRecoverableExports: vi.fn(),
    markPartDone: vi.fn(),
    markPartFailed: vi.fn(),
    update: vi.fn(),
    ...overrides,
  };
}

function createProductExportRecord(
  overrides: Partial<ProductExportRecord> = {},
): ProductExportRecord {
  const now = new Date("2026-06-18T12:00:00.000Z");

  return {
    bucketKey: null,
    bucketProvider: null,
    completedAt: null,
    createdAt: now,
    deletedAt: null,
    errorCode: null,
    errorMessage: null,
    fileSize: null,
    id: "export-1",
    name: "All products",
    objectCount: null,
    partialDataUrl: null,
    resultUrl: null,
    shopDomain: "test-shop.myshopify.com",
    shopifyBulkOperationId: null,
    shopifyBulkOperationStatus: null,
    shopifySessionId: null,
    status: "queued",
    template: "basic",
    updatedAt: now,
    ...overrides,
  };
}
