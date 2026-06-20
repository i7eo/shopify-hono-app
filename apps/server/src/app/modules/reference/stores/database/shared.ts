import {
  AppError,
  createCursorPagination,
  createPagePagination,
} from "@/shared/models";
import type {
  ReferenceListInput,
  ReferenceRecord,
  ReferencesPage,
} from "../../types";

type ReferenceCursor = Pick<ReferenceRecord, "code" | "id" | "sortOrder">;

export function toReferencesPage(
  rows: ReferenceRecord[],
  input: ReferenceListInput,
  total?: number,
): ReferencesPage {
  if (input.pagination.mode === "page") {
    const references = rows.slice(0, input.pagination.limit);

    return {
      pagination: createPagePagination({
        hasNext: rows.length > input.pagination.limit,
        limit: input.pagination.limit,
        page: input.pagination.page,
        total: total ?? references.length,
      }),
      references,
    };
  }

  const references = rows.slice(0, input.pagination.limit);
  const next =
    rows.length > input.pagination.limit ? references.at(-1) : undefined;

  return {
    pagination: createCursorPagination({
      hasNext: Boolean(next),
      limit: input.pagination.limit,
      nextCursor: createReferenceCursor(next),
    }),
    references,
  };
}

export function createReferenceCursor(
  record?: ReferenceRecord,
): string | undefined {
  if (!record) return undefined;

  return [
    encodeURIComponent(String(record.sortOrder)),
    encodeURIComponent(record.code),
    encodeURIComponent(record.id),
  ].join(":");
}

export function getPageOffset(pagination: {
  limit: number;
  page: number;
}): number {
  return (pagination.page - 1) * pagination.limit;
}

export function getReferenceListCursor(
  input: ReferenceListInput,
): ReferenceCursor | null {
  if (input.pagination.mode !== "cursor" || !input.pagination.cursor) {
    return null;
  }

  const cursor = parseReferenceCursor(input.pagination.cursor);
  if (cursor) return cursor;

  throw new AppError({
    status: 400,
    message: "Invalid cursor.",
    expose: true,
  });
}

function parseReferenceCursor(cursor: string): ReferenceCursor | null {
  const [sortOrderValue, codeValue, idValue, ...rest] = cursor.split(":");
  if (!sortOrderValue || !codeValue || !idValue || rest.length > 0) {
    return null;
  }

  const sortOrder = Number(decodeURIComponent(sortOrderValue));
  const code = decodeURIComponent(codeValue);
  const id = decodeURIComponent(idValue);

  if (!Number.isSafeInteger(sortOrder) || !code || !id) {
    return null;
  }

  return { code, id, sortOrder };
}
