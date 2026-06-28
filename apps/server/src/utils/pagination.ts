import {
  createCursorPagination,
  createPagePagination,
  type Pagination,
  type PaginationInput,
} from "@/shared/models";

export type PaginatedRowsPage<Item> = {
  items: Item[];
  pagination: Pagination;
};

export type PaginatedRowsPageOptions<Item> = {
  createCursor?: (item: Item) => string | undefined;
  total?: number;
};

/**
 * Returns the SQL offset for one-based page pagination.
 */
export function getPageOffset(pagination: {
  limit: number;
  page: number;
}): number {
  return (pagination.page - 1) * pagination.limit;
}

/**
 * Converts rows fetched with `limit + 1` into a stable pagination payload.
 *
 * @example
 * ```ts
 * const page = toPaginatedRowsPage(rows, input.pagination, {
 *   createCursor: (record) => createReferenceCursor(record),
 *   total,
 * });
 * ```
 */
export function toPaginatedRowsPage<Item>(
  rows: Item[],
  paginationInput: PaginationInput,
  options: PaginatedRowsPageOptions<Item> = {},
): PaginatedRowsPage<Item> {
  const items = rows.slice(0, paginationInput.limit);
  const hasNext = rows.length > paginationInput.limit;

  if (paginationInput.mode === "page") {
    return {
      items,
      pagination: createPagePagination({
        hasNext,
        limit: paginationInput.limit,
        page: paginationInput.page,
        total: options.total ?? items.length,
      }),
    };
  }

  const next = hasNext ? items.at(-1) : undefined;

  return {
    items,
    pagination: createCursorPagination({
      hasNext,
      limit: paginationInput.limit,
      nextCursor: next ? options.createCursor?.(next) : undefined,
    }),
  };
}
