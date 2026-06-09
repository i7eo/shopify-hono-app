import { describe, expect, it } from "vitest";
import { traverseFind, traverseTree } from "../src/traverse";

type Node = {
  id: number;
  children?: Node[];
  items?: Node[];
};

describe("traverse utilities", () => {
  it("traverses trees depth-first and collects mapped results", () => {
    const tree: Node[] = [
      { id: 1, children: [{ id: 2 }, { id: 3, children: [{ id: 4 }] }] },
    ];

    expect(
      traverseTree(tree, (node) => ({
        match: !node.children?.length,
        result: node.id,
      })),
    ).toEqual([2, 4]);
  });

  it("passes parent, depth, and path context", () => {
    const tree: Node[] = [
      { id: 1, children: [{ id: 2, children: [{ id: 3 }] }] },
    ];

    const context = traverseTree(tree, (node, ctx) => ({
      match: node.id === 3,
      result: {
        parent: ctx.parent?.id,
        depth: ctx.depth,
        path: ctx.path.map((item) => item.id),
      },
    }));

    expect(context).toEqual([{ parent: 2, depth: 2, path: [1, 2, 3] }]);
  });

  it("supports skipping children, stopping traversal, custom children, and max depth", () => {
    const tree: Node[] = [
      {
        id: 1,
        items: [
          { id: 2, items: [{ id: 4 }] },
          { id: 3, items: [{ id: 5 }] },
        ],
      },
    ];

    const visited = traverseTree(
      tree,
      (node) => ({
        match: true,
        result: node.id,
        skipChildren: node.id === 2,
        stop: node.id === 3,
      }),
      { getChildren: (node) => node.items, maxDepth: 1 },
    );

    expect(visited).toEqual([1, 2, 3]);
  });

  it("finds the first matching node", () => {
    const tree: Node[] = [
      { id: 1, children: [{ id: 2 }, { id: 3, children: [{ id: 4 }] }] },
    ];

    expect(traverseFind(tree, (node) => node.id > 2)?.id).toBe(3);
    expect(traverseFind(tree, (node) => node.id === 9)).toBeUndefined();
  });
});
