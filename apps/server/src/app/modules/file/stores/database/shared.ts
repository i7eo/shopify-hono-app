import {
  createCursorPagination,
  createPagePagination,
  createSeekCursor,
  readSeekCursor,
  type SeekCursor,
} from "@/shared/models";
import type { FileListInput, FileRecord, FilesPage } from "../../types";

export function toFilesPage(
  rows: FileRecord[],
  input: FileListInput,
  total?: number,
): FilesPage {
  if (input.pagination.mode === "page") {
    const files = rows.slice(0, input.pagination.limit);

    return {
      files,
      pagination: createPagePagination({
        hasNext: rows.length > input.pagination.limit,
        limit: input.pagination.limit,
        page: input.pagination.page,
        total: total ?? files.length,
      }),
    };
  }

  const files = rows.slice(0, input.pagination.limit);
  const hasNext = rows.length > input.pagination.limit;

  return {
    files,
    pagination: createCursorPagination({
      hasNext,
      limit: input.pagination.limit,
      nextCursor: hasNext ? createFileCursor(files.at(-1)) : undefined,
    }),
  };
}

export function createFileCursor(file?: FileRecord): string | undefined {
  if (!file) return undefined;

  return createSeekCursor({
    createdAt: file.createdAt,
    id: file.id,
  });
}

export function getPageOffset(pagination: {
  limit: number;
  page: number;
}): number {
  return (pagination.page - 1) * pagination.limit;
}

export function getListCursor(input: FileListInput): SeekCursor | null {
  if (input.pagination.mode !== "cursor") return null;

  return readSeekCursor(input.pagination.cursor);
}
