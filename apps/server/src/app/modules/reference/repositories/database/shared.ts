import { AppError } from "@/shared/models";
import { toPaginatedRowsPage } from "@/utils/pagination";
import type {
  ReferenceListInput,
  ReferenceRecord,
  ReferencesPage,
} from "../../types";

export { getPageOffset } from "@/utils/pagination";

type ReferenceCursor = Pick<ReferenceRecord, "code" | "id" | "sortOrder">;

export function toReferencesPage(
  rows: ReferenceRecord[],
  input: ReferenceListInput,
  total?: number,
): ReferencesPage {
  const page = toPaginatedRowsPage(rows, input.pagination, {
    createCursor: createReferenceCursor,
    total,
  });

  return {
    pagination: page.pagination,
    references: page.items,
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
