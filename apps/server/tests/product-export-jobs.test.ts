import { describe, expect, it, vi } from "vitest";
import { deleteProductExportPartObjects } from "@/app/modules/product-export/queue/jobs";
import type { ProductExportPartRecord } from "@/app/modules/product-export/types";
import type { Bucket } from "@/infra/bucket";

describe("product export queue jobs", () => {
  it("deletes intermediate part objects and skips parts without bucket keys", async () => {
    const bucket = createBucket();

    await deleteProductExportPartObjects(
      [
        createPartRecord({
          bucketKey: "shop/product-exports/2026/06/exp/0.csv",
        }),
        createPartRecord({ bucketKey: null, seq: 1 }),
        createPartRecord({
          bucketKey: "shop/product-exports/2026/06/exp/2.csv",
          seq: 2,
        }),
      ],
      bucket,
    );

    expect(bucket.delete).toHaveBeenCalledTimes(2);
    expect(bucket.delete).toHaveBeenNthCalledWith(1, {
      key: "shop/product-exports/2026/06/exp/0.csv",
    });
    expect(bucket.delete).toHaveBeenNthCalledWith(2, {
      key: "shop/product-exports/2026/06/exp/2.csv",
    });
  });

  it("reports part object delete failures after trying every part", async () => {
    const bucket = createBucket({
      delete: vi.fn(({ key }) =>
        key.endsWith("1.csv")
          ? Promise.reject(new Error("delete failed"))
          : Promise.resolve(),
      ),
    });

    await expect(
      deleteProductExportPartObjects(
        [
          createPartRecord({
            bucketKey: "shop/product-exports/2026/06/exp/0.csv",
          }),
          createPartRecord({
            bucketKey: "shop/product-exports/2026/06/exp/1.csv",
            seq: 1,
          }),
        ],
        bucket,
      ),
    ).rejects.toMatchObject({
      message: "Failed to delete product export part objects",
      status: 502,
    });
    expect(bucket.delete).toHaveBeenCalledTimes(2);
  });

  it("limits part object delete concurrency by batches", async () => {
    let activeDeletes = 0;
    let maxActiveDeletes = 0;
    const bucket = createBucket({
      delete: vi.fn(async () => {
        activeDeletes += 1;
        maxActiveDeletes = Math.max(maxActiveDeletes, activeDeletes);
        await new Promise((resolve) => setTimeout(resolve, 0));
        activeDeletes -= 1;
      }),
    });

    await deleteProductExportPartObjects(
      Array.from({ length: 25 }, (_, seq) =>
        createPartRecord({
          bucketKey: `shop/product-exports/2026/06/exp/${seq}.csv`,
          seq,
        }),
      ),
      bucket,
    );

    expect(bucket.delete).toHaveBeenCalledTimes(25);
    expect(maxActiveDeletes).toBeLessThanOrEqual(10);
  });
});

function createBucket(overrides: Partial<Bucket> = {}): Bucket {
  return {
    delete: vi.fn(() => Promise.resolve()),
    open: vi.fn(),
    put: vi.fn(),
    ...overrides,
  };
}

function createPartRecord(
  overrides: Partial<ProductExportPartRecord> = {},
): ProductExportPartRecord {
  const now = new Date("2026-06-20T00:00:00.000Z");

  return {
    attempts: 0,
    bucketKey: null,
    bucketProvider: null,
    byteSize: null,
    completedAt: null,
    createdAt: now,
    errorCode: null,
    errorMessage: null,
    exportId: "export-1",
    id: "part-1",
    lockedAt: null,
    rangeEnd: 1024,
    rangeStart: 0,
    rowCount: null,
    seq: 0,
    status: "done",
    updatedAt: now,
    ...overrides,
  };
}
