import { traverseTree } from "./traverse";

/** Field mapping used to adapt helpers to different tree node shapes. */
interface TreeHelperConfig {
  /** Field name for the unique node identifier. */
  id: string;
  /** Field name that stores child nodes. */
  children: string;
  /** Field name for the parent node identifier. */
  pid: string;
}

interface Fn<T = any, R = T> {
  (...arg: T[]): R;
}

const DEFAULT_CONFIG: TreeHelperConfig = {
  id: "id",
  children: "children",
  pid: "pid",
};

/** Merge user field mapping with the default tree field mapping. */
const getConfig = (config: Partial<TreeHelperConfig>) =>
  Object.assign({}, DEFAULT_CONFIG, config);

/**
 * Convert a flat node list into a tree.
 *
 * @param list - Flat node list. Each item must contain id and pid fields.
 * @param config - Field mapping. Defaults to { id, children, pid }.
 * @returns Root nodes of the generated tree.
 * @remarks Mutates nodes in list by adding the children field.
 *
 * @example
 * const list = [
 *   { id: 1, pid: 0, name: 'A' },
 *   { id: 2, pid: 1, name: 'B' },
 *   { id: 3, pid: 1, name: 'C' },
 * ];
 * listToTree(list);
 * // => [{ id: 1, pid: 0, name: 'A', children: [
 * //      { id: 2, pid: 1, name: 'B', children: [] },
 * //      { id: 3, pid: 1, name: 'C', children: [] },
 * //    ]}]
 */
export function listToTree<T = any>(
  list: any[],
  config: Partial<TreeHelperConfig> = {},
): T[] {
  const conf = getConfig(config) as TreeHelperConfig;
  const nodeMap = new Map();
  const result: T[] = [];
  const { id, children, pid } = conf;

  for (const node of list) {
    node[children] = node[children] || [];
    nodeMap.set(node[id], node);
  }
  for (const node of list) {
    const parent = nodeMap.get(node[pid]);
    (parent ? parent[children] : result).push(node);
  }
  return result;
}

/**
 * Flatten a tree into a breadth-first list.
 *
 * @param tree - Root nodes of the tree.
 * @param config - Field mapping.
 * @param clearParentChildren - Clears each visited node's children when true.
 * @returns Flat node list in BFS order using the same object references.
 *
 * @example
 * const tree = [{ id: 1, children: [{ id: 2, children: [] }, { id: 3, children: [] }] }];
 * treeToList(tree);
 * // => [{ id: 1, ... }, { id: 2, ... }, { id: 3, ... }]
 */
export function treeToList<T = any>(
  tree: any,
  config: Partial<TreeHelperConfig> = {},
  clearParentChildren = false,
): T[] {
  const conf = getConfig(config) as TreeHelperConfig;
  const { children } = conf;
  const result: any[] = [];
  const queue = [...tree];
  let i = 0;

  while (i < queue.length) {
    const node = queue[i++];
    result.push(node);
    if (node[children]?.length) {
      queue.push(...node[children]);
      if (clearParentChildren) node[children] = [];
    }
  }
  return result;
}

/**
 * Find the first tree node that matches the predicate.
 *
 * @param tree - Root nodes of the tree.
 * @param func - Predicate that returns true for a match.
 * @param config - Field mapping.
 * @returns The matched node, or null when no node matches.
 *
 * @example
 * const tree = [{ id: 1, children: [{ id: 2, name: 'B', children: [] }] }];
 * findNode(tree, (n) => n.id === 2);
 * // => { id: 2, name: 'B', children: [] }
 */
export function findNode<T = any>(
  tree: any,
  func: Fn,
  config: Partial<TreeHelperConfig> = {},
): T | null {
  const conf = getConfig(config) as TreeHelperConfig;
  const { children } = conf;
  const found = traverseTree(
    tree,
    (node) => {
      const matched = !!func(node);
      return { match: matched, result: node, stop: matched };
    },
    { getChildren: (n: any) => n[children] },
  );
  return (found[0] ?? null) as T | null;
}

/**
 * Find all tree nodes that match the predicate.
 *
 * @param tree - Root nodes of the tree.
 * @param func - Predicate used to match nodes.
 * @param config - Field mapping.
 * @returns All matching nodes.
 *
 * @example
 * const tree = [{ id: 1, children: [{ id: 2, children: [] }, { id: 3, children: [] }] }];
 * findNodeAll(tree, (n) => !n.children?.length);
 * // => [{ id: 2, children: [] }, { id: 3, children: [] }]  // all leaf nodes
 */
export function findNodeAll<T = any>(
  tree: any,
  func: Fn,
  config: Partial<TreeHelperConfig> = {},
): T[] {
  const conf = getConfig(config) as TreeHelperConfig;
  const { children } = conf;
  return traverseTree(tree, (node) => ({ match: !!func(node), result: node }), {
    getChildren: (n: any) => n[children],
  }) as T[];
}

/**
 * Find the path from a root node to the first matching node.
 *
 * @param tree - Root nodes of the tree.
 * @param func - Predicate used to match the target node.
 * @param config - Field mapping.
 * @returns Path nodes [root, ..., target], or null when no node matches.
 *
 * @example
 * const tree = [{ id: 1, children: [{ id: 2, children: [{ id: 4, children: [] }] }] }];
 * findPath(tree, (n) => n.id === 4);
 * // => [node1, node2, node4]
 */
export function findPath<T = any>(
  tree: any,
  func: Fn,
  config: Partial<TreeHelperConfig> = {},
): T[] | null {
  const conf = getConfig(config) as TreeHelperConfig;
  const { children } = conf;
  const found = traverseTree(
    tree,
    (node, ctx) => {
      const matched = !!func(node);
      return {
        match: matched,
        result: [...ctx.path] as T[],
        stop: matched,
      };
    },
    { getChildren: (n: any) => n[children] },
  );
  return (found[0] ?? null) as T[] | null;
}

/**
 * Find paths from root nodes to every matching node.
 *
 * @param tree - Root nodes of the tree.
 * @param func - Predicate used to match nodes.
 * @param config - Field mapping.
 * @returns An array of paths. Each path is [root, ..., target].
 *
 * @example
 * const tree = [{ id: 1, children: [{ id: 2, children: [] }, { id: 3, children: [] }] }];
 * findPathAll(tree, (n) => !n.children?.length);
 * // => [[node1, node2], [node1, node3]]
 */
export function findPathAll(
  tree: any,
  func: Fn,
  config: Partial<TreeHelperConfig> = {},
): any[][] {
  const conf = getConfig(config) as TreeHelperConfig;
  const { children } = conf;
  return traverseTree(
    tree,
    (node, ctx) => ({
      match: !!func(node),
      result: [...ctx.path],
    }),
    { getChildren: (n: any) => n[children] },
  );
}

/**
 * Filter a tree while preserving matching nodes and their ancestors.
 *
 * @param tree - Root nodes of the tree.
 * @param func - Filter callback. A truthy return value keeps the node.
 * @param config - Field mapping.
 * @returns A filtered tree with shallow-copied nodes.
 * @remarks Keeps unmatched ancestors when they contain matching descendants.
 *
 * @example
 * const tree = [{ id: 1, name: 'A', children: [{ id: 2, name: 'B', children: [] }] }];
 * filter(tree, (n) => n.name === 'B');
 * // => [{ id: 1, name: 'A', children: [{ id: 2, name: 'B', children: [] }] }]
 */
export function filter<T = any>(
  tree: T[],
  func: (n: T) => boolean | string,
  config: Partial<TreeHelperConfig> = {},
): T[] {
  const conf = getConfig(config) as TreeHelperConfig;
  const { children } = conf;

  function listFilter(list: T[]): T[] {
    return list
      .map((node: any) => ({ ...node }))
      .filter((node) => {
        node[children] = node[children]?.length
          ? listFilter(node[children])
          : [];
        return func(node) || node[children].length > 0;
      });
  }
  return listFilter(tree);
}

/**
 * Traverse a tree in depth-first order.
 *
 * @param tree - Root nodes of the tree.
 * @param func - Callback called for each node. Return true to stop traversal.
 * @param config - Field mapping.
 * @remarks Useful when large trees can stop early after a match.
 *
 * @example
 * const tree = [{ id: 1, children: [{ id: 2, children: [] }] }];
 * forEach(tree, (n) => { console.log(n.id); return n.id === 2; });
 * // logs 1 and 2, then stops
 */
export function forEach<T = any>(
  tree: T[],
  func: (n: T) => any,
  config: Partial<TreeHelperConfig> = {},
): void {
  const conf = getConfig(config) as TreeHelperConfig;
  const { children } = conf;
  const list: any[] = [...tree];
  let i = 0;

  while (i < list.length) {
    if (func(list[i])) return;
    if (list[i][children]?.length) {
      list.splice(i + 1, 0, ...list[i][children]);
    }
    i++;
  }
}

/**
 * Map an entire tree into a new node shape.
 *
 * @param treeData - Tree data.
 * @param opt - Mapping options.
 * @param opt.children - Child node field name.
 * @param opt.conversion - Converts each source node into the new node fields.
 * @returns The mapped tree.
 *
 * @example
 * const tree = [{ id: 1, name: 'A', children: [{ id: 2, name: 'B', children: [] }] }];
 * treeMap(tree, { conversion: (n) => ({ label: n.name, value: n.id }) });
 * // => [{ label: 'A', value: 1, children: [{ label: 'B', value: 2, children: [] }] }]
 */
export function treeMap<T = any>(
  treeData: T[],
  opt: { children?: string; conversion: Fn },
): T[] {
  return treeData.map((item) => treeMapEach(item, opt));
}

/**
 * Map a single node and its subtree.
 *
 * @example
 * treeMapEach({ id: 1, name: 'A', children: [] }, { conversion: (n) => ({ key: n.id }) });
 * // => { key: 1 }
 */
export function treeMapEach(
  data: any,
  { children = "children", conversion }: { children?: string; conversion: Fn },
) {
  const haveChildren =
    Array.isArray(data[children]) && data[children].length > 0;
  const conversionData = conversion(data) || {};
  if (haveChildren) {
    return {
      ...conversionData,
      [children]: data[children].map((item: any) =>
        treeMapEach(item, { children, conversion }),
      ),
    };
  }
  return { ...conversionData };
}

/**
 * Find all nodes in the subtree rooted at childrenId, including the root node.
 *
 * @param tree - Root nodes of the tree.
 * @param childrenId - Root node id of the target subtree.
 * @param func - Optional mapper. Returned values replace original nodes.
 * @param config - Field mapping.
 * @returns Nodes inside the target subtree.
 *
 * @example
 * const tree = [{ id: 1, children: [{ id: 2, children: [{ id: 4, children: [] }] }] }];
 * findChildrens(tree, 1, (n) => n);
 * // => [node1, node2, node4]
 */
export function findChildrens<T = any>(
  tree: T[],
  childrenId: string | number,
  func: (n: T) => boolean | string,
  config: Partial<TreeHelperConfig> = {},
): T[] {
  const conf = getConfig(config) as TreeHelperConfig;
  const { children, id, pid } = conf;
  const childrens: any[] = [];

  function traverse(
    list: T[],
    targetId: string | number,
    parentId?: string | number,
  ) {
    for (const element of list) {
      const item = element as any;
      if (item[id] === targetId || item[pid] === parentId) {
        childrens.push(func(item) ?? item);
        if (item[children]?.length) {
          traverse(item[children], targetId, item[id]);
        }
      } else if (item[children]?.length) {
        traverse(item[children], targetId);
      }
    }
  }
  traverse(tree, childrenId);
  return childrens;
}

/**
 * Find a node and all of its ancestors up to the root.
 *
 * @param tree - Root nodes of the tree.
 * @param parentId - Target node id. The parameter name is kept for compatibility.
 * @param func - Optional mapper.
 * @param config - Field mapping.
 * @returns Ancestor list [node itself, parent, grandparent, ...].
 *
 * @example
 * const tree = [{ id: 1, pid: 0, children: [{ id: 2, pid: 1, children: [{ id: 4, pid: 2, children: [] }] }] }];
 * findParents(tree, 4, (n) => n);
 * // => [node4, node2, node1]
 */
export function findParents<T = any>(
  tree: T[],
  parentId: string | number,
  func: (n: T) => boolean | string,
  config: Partial<TreeHelperConfig> = {},
): T[] {
  const conf = getConfig(config) as TreeHelperConfig;
  const { children, pid, id } = conf;
  const nodeMap = new Map<string | number, any>();

  function buildMap(list: any[]) {
    for (const node of list) {
      nodeMap.set(node[id], node);
      if (node[children]?.length) buildMap(node[children]);
    }
  }
  buildMap(tree);

  const parents: any[] = [];
  let currentId: string | number | undefined = parentId;
  while (currentId !== undefined && currentId !== null) {
    const node = nodeMap.get(currentId);
    if (!node) break;
    parents.push(func(node) ?? node);
    currentId = node[pid];
  }
  return parents;
}
