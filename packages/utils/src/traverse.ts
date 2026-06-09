type TraverseOptions<T> = {
  /**
   * Returns child nodes. Defaults to reading `node.children`.
   */
  getChildren?: (node: T) => T[] | undefined;
  /**
   * Maximum traversal depth. The root level is depth 0.
   * @default Infinity
   */
  maxDepth?: number;
};

type TraverseControl = {
  /** Stops the entire traversal when true. */
  stop?: boolean;
  /** Skips the current node's children when true. */
  skipChildren?: boolean;
};

type TraverseContext<T> = {
  /** Parent node. Root nodes use null. */
  parent: T | null;
  /** Current depth. Root nodes use 0. */
  depth: number;
  /** Path from the root to the current node. Copied lazily on access. */
  path: readonly T[];
};

/**
 * Callback used by traverseTree.
 *
 * Return values:
 * - `match`: Adds this node to the result set when true.
 * - `result`: Value pushed for a match. Defaults to the node itself.
 * - `stop` / `skipChildren`: Controls traversal flow.
 */
type TraverseCallback<T, R> = (
  node: T,
  ctx: TraverseContext<T>,
) => {
  match?: boolean;
  result?: R;
} & TraverseControl;

/** Default child reader used by traversal helpers. */
const DEFAULT_GET_CHILDREN = <T>(node: T) =>
  (node as { children?: T[] }).children;

/**
 * Traverse trees in depth-first order and collect matching results.
 *
 * @param nodes - Root nodes. Multiple trees are supported.
 * @param callback - Called once for each node to match results and control traversal.
 * @param options - Optional traversal settings.
 * @returns Result values for every node where match is true, or the node itself.
 *
 * @example
 * // 1. Find all leaf nodes.
 * const tree = [{ id: 1, children: [{ id: 2, children: [] }, { id: 3, children: [] }] }];
 * const leaves = traverseTree(tree, (node) => ({
 *   match: !node.children?.length,
 * }));
 * // => [{ id: 2, children: [] }, { id: 3, children: [] }]
 *
 * @example
 * // 2. Filter by condition and map results.
 * const ids = traverseTree(tree, (node) => ({
 *   match: node.type === 'file',
 *   result: node.id,
 * }));
 *
 * @example
 * // 3. Stop after the first match.
 * const first = traverseTree(tree, (node) => ({
 *   match: node.id === targetId,
 *   result: node,
 *   stop: node.id === targetId,
 * }))[0];
 *
 * @example
 * // 4. Skip a specific node's subtree.
 * traverseTree(tree, (node) => ({
 *   match: node.visible,
 *   skipChildren: node.collapsed,
 * }));
 *
 * @example
 * // 5. Collect the path from the root to the matching node.
 * const paths = traverseTree(tree, (node, ctx) => ({
 *   match: node.id === targetId,
 *   result: [...ctx.path],
 * }));
 *
 * @example
 * // 6. Use a custom child field and limit traversal depth.
 * traverseTree(nodes, cb, { getChildren: (n) => n.items, maxDepth: 2 });
 */
export function traverseTree<T, R = T>(
  nodes: T[],
  callback: TraverseCallback<T, R>,
  options: TraverseOptions<T> = {},
): R[] {
  const results: R[] = [];
  const getChildren = options.getChildren ?? DEFAULT_GET_CHILDREN;
  const maxDepth = options.maxDepth ?? Infinity;

  const path: T[] = [];
  const ctx: TraverseContext<T> = {
    parent: null,
    depth: 0,
    get path() {
      return path.slice();
    },
  };

  const stack: (T[] | number | T | null)[] = [];
  let list: T[] = nodes;
  let index = 0;
  let parent: T | null = null;
  let depth = 0;

  while (true) {
    if (index < list.length) {
      const node = list[index];
      path.push(node);

      ctx.parent = parent;
      ctx.depth = depth;
      const res = callback(node, ctx);

      if (res.match) {
        results.push((res.result ?? node) as R);
      }
      if (res.stop) {
        path.pop();
        break;
      }

      const children =
        !res.skipChildren && depth < maxDepth ? getChildren(node) : undefined;

      if (children?.length) {
        stack.push(list, index + 1, parent, depth);
        list = children;
        index = 0;
        parent = node;
        depth++;
        continue;
      }

      path.pop();
      index++;
    } else {
      if (stack.length === 0) break;
      depth = stack.pop() as number;
      parent = stack.pop() as T | null;
      index = stack.pop() as number;
      list = stack.pop() as T[];
      path.pop();
    }
  }

  return results;
}

/**
 * Find the first tree node that matches the predicate.
 *
 * @param nodes - Root nodes.
 * @param predicate - Predicate used to match a node.
 * @param options - Optional traversal settings.
 * @returns The first matching node, or undefined when no node matches.
 *
 * @example
 * // Find by id.
 * const tree = [{ id: 1, children: [{ id: 2, name: 'B', children: [] }] }];
 * const node = traverseFind(tree, (n) => n.id === 2);
 * // => { id: 2, name: 'B', children: [] }
 *
 * @example
 * // Match with context values such as depth and path.
 * const node = traverseFind(tree, (n, { depth }) => depth === 1 && n.type === 'file');
 *
 * @example
 * // Use a custom child field.
 * traverseFind(nodes, (n) => n.key === target, { getChildren: (n) => n.items });
 */
export function traverseFind<T>(
  nodes: T[],
  predicate: (node: T, ctx: TraverseContext<T>) => boolean,
  options: TraverseOptions<T> = {},
): T | undefined {
  const found = traverseTree(
    nodes,
    (node, ctx) => {
      const matched = predicate(node, ctx);
      return { match: matched, result: node, stop: matched };
    },
    options,
  );
  return found[0] as T | undefined;
}
