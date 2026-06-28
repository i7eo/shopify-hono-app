import { describe, expect, it } from "vitest";
import { toPaginatedRowsPage } from "@/utils/pagination";

describe("pagination utils", () => {
  it("creates page pagination from one extra row", () => {
    const page = toPaginatedRowsPage(
      [{ id: "first" }, { id: "second" }, { id: "third" }],
      {
        limit: 2,
        mode: "page",
        page: 3,
      },
      {
        total: 7,
      },
    );

    expect(page).toEqual({
      items: [{ id: "first" }, { id: "second" }],
      pagination: {
        hasNext: true,
        limit: 2,
        mode: "page",
        page: 3,
        total: 7,
      },
    });
  });

  it("creates cursor pagination with a custom next cursor", () => {
    const page = toPaginatedRowsPage(
      [{ id: "first" }, { id: "second" }, { id: "third" }],
      {
        cursor: "before",
        limit: 2,
        mode: "cursor",
      },
      {
        createCursor: (item) => `after:${item.id}`,
      },
    );

    expect(page).toEqual({
      items: [{ id: "first" }, { id: "second" }],
      pagination: {
        hasNext: true,
        limit: 2,
        mode: "cursor",
        nextCursor: "after:second",
      },
    });
  });
});
