import {
  createCursorPagination,
  createPagePagination,
  createSeekCursor,
  readSeekCursor,
  type SeekCursor,
} from "@/shared/models";
import type {
  ProductExportListInput,
  ProductExportPartRecord,
  ProductExportPartStats,
  ProductExportRecord,
  ProductExportsPage,
} from "../../types";

export function toProductExportsPage(
  rows: ProductExportRecord[],
  input: ProductExportListInput,
  total?: number,
): ProductExportsPage {
  if (input.pagination.mode === "page") {
    const productExports = rows.slice(0, input.pagination.limit);

    return {
      pagination: createPagePagination({
        hasNext: rows.length > input.pagination.limit,
        limit: input.pagination.limit,
        page: input.pagination.page,
        total: total ?? productExports.length,
      }),
      productExports,
    };
  }

  const productExports = rows.slice(0, input.pagination.limit);
  const next =
    rows.length > input.pagination.limit ? productExports.at(-1) : undefined;

  return {
    pagination: createCursorPagination({
      hasNext: Boolean(next),
      limit: input.pagination.limit,
      nextCursor: createProductExportCursor(next),
    }),
    productExports,
  };
}

export function createProductExportCursor(
  record?: ProductExportRecord,
): string | undefined {
  if (!record) return undefined;

  return createSeekCursor({
    createdAt: record.createdAt,
    id: record.id,
  });
}

export function getPageOffset(pagination: {
  limit: number;
  page: number;
}): number {
  return (pagination.page - 1) * pagination.limit;
}

export function getListCursor(
  input: ProductExportListInput,
): SeekCursor | null {
  if (input.pagination.mode !== "cursor") return null;

  return readSeekCursor(input.pagination.cursor);
}

export function toPartStats(
  groups: Array<Pick<ProductExportPartRecord, "status"> & { total: number }>,
) {
  const stats: ProductExportPartStats = {
    done: 0,
    failed: 0,
    pending: 0,
    processing: 0,
    total: 0,
  };

  for (const group of groups) {
    const total = Number(group.total);
    stats[group.status] += total;
    stats.total += total;
  }

  return stats;
}
