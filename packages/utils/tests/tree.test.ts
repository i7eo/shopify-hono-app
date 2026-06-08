import { describe, expect, it } from "vitest";
import {
  filter,
  findChildrens,
  findNode,
  findNodeAll,
  findParents,
  findPath,
  findPathAll,
  forEach,
  listToTree,
  treeMap,
  treeMapEach,
  treeToList,
} from "../src/tree";

type Node = {
  id: number;
  pid: number;
  name: string;
  children?: Node[];
};

function createTree(): Node[] {
  return [
    {
      id: 1,
      pid: 0,
      name: "root",
      children: [
        {
          id: 2,
          pid: 1,
          name: "branch",
          children: [{ id: 4, pid: 2, name: "leaf", children: [] }],
        },
        { id: 3, pid: 1, name: "sibling", children: [] },
      ],
    },
  ];
}

describe("tree utilities", () => {
  it("converts a list to a tree with default and custom field mappings", () => {
    const list = [
      { id: 1, pid: 0, name: "root" },
      { id: 2, pid: 1, name: "child" },
    ];

    expect(listToTree<Node>(list)).toEqual([
      {
        id: 1,
        pid: 0,
        name: "root",
        children: [{ id: 2, pid: 1, name: "child", children: [] }],
      },
    ]);

    expect(
      listToTree(
        [
          { key: "a", parentKey: null },
          { key: "b", parentKey: "a" },
        ],
        { id: "key", pid: "parentKey", children: "nodes" },
      ),
    ).toEqual([
      {
        key: "a",
        parentKey: null,
        nodes: [{ key: "b", parentKey: "a", nodes: [] }],
      },
    ]);
  });

  it("flattens a tree in breadth-first order and can clear parent children", () => {
    const tree = createTree();

    expect(treeToList<Node>(tree).map((node) => node.id)).toEqual([1, 2, 3, 4]);

    const cleared = createTree();
    treeToList<Node>(cleared, {}, true);
    expect(cleared[0].children).toEqual([]);
  });

  it("finds nodes and paths", () => {
    const tree = createTree();

    expect(findNode<Node>(tree, (node: Node) => node.id === 4)?.name).toBe(
      "leaf",
    );
    expect(findNode(tree, (node: Node) => node.id === 9)).toBeNull();
    expect(
      findNodeAll<Node>(tree, (node: Node) => !node.children?.length).map(
        (node) => node.id,
      ),
    ).toEqual([4, 3]);
    expect(
      findPath<Node>(tree, (node: Node) => node.id === 4)?.map(
        (node) => node.id,
      ),
    ).toEqual([1, 2, 4]);
    expect(findPath(tree, (node: Node) => node.id === 9)).toBeNull();
    expect(
      findPathAll(tree, (node: Node) => !node.children?.length).map((path) =>
        path.map((node) => node.id),
      ),
    ).toEqual([
      [1, 2, 4],
      [1, 3],
    ]);
  });

  it("filters trees while preserving matching ancestors", () => {
    const tree = createTree();
    const result = filter<Node>(tree, (node) => node.name === "leaf");

    expect(result.map((node) => node.id)).toEqual([1]);
    expect(result[0].children?.map((node) => node.id)).toEqual([2]);
    expect(result[0].children?.[0].children?.map((node) => node.id)).toEqual([
      4,
    ]);
    expect(result[0]).not.toBe(tree[0]);
  });

  it("iterates depth-first and stops when the callback returns truthy", () => {
    const visited: number[] = [];

    forEach<Node>(createTree(), (node) => {
      visited.push(node.id);
      return node.id === 2;
    });

    expect(visited).toEqual([1, 2]);
  });

  it("maps trees and individual nodes", () => {
    const tree = createTree();

    expect(
      treeMap(tree, {
        conversion: (node: Node) => ({ label: node.name, value: node.id }),
      }),
    ).toEqual([
      {
        label: "root",
        value: 1,
        children: [
          {
            label: "branch",
            value: 2,
            children: [{ label: "leaf", value: 4 }],
          },
          { label: "sibling", value: 3 },
        ],
      },
    ]);
    expect(
      treeMapEach(
        { key: "a", items: [{ key: "b", items: [] }] },
        {
          children: "items",
          conversion: (node: { key: string }) => ({ value: node.key }),
        },
      ),
    ).toEqual({ value: "a", items: [{ value: "b" }] });
  });

  it("finds children and parents", () => {
    const tree = createTree();

    expect(findChildrens<Node>(tree, 2, (node) => String(node.id))).toEqual([
      "2",
      "4",
    ]);
    expect(findParents<Node>(tree, 4, (node) => String(node.id))).toEqual([
      "4",
      "2",
      "1",
    ]);
  });
});
