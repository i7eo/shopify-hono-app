type TraverseOptions<T> = {
  /**
   * 获取子节点的函数，默认从 `node.children` 读取
   */
  getChildren?: (node: T) => T[] | undefined;
  /**
   * 最大遍历深度，超过则不再递归（不含根层，根层 depth=0）
   * @default Infinity
   */
  maxDepth?: number;
};

type TraverseControl = {
  /** 为 true 时立即终止整个遍历 */
  stop?: boolean;
  /** 为 true 时跳过当前节点的子节点 */
  skipChildren?: boolean;
};

type TraverseContext<T> = {
  /** 父节点，根节点时为 null */
  parent: T | null;
  /** 当前深度，根层为 0 */
  depth: number;
  /** 从根到当前节点的路径（只读副本，惰性求值，仅在访问时拷贝） */
  path: readonly T[];
};

/**
 * 遍历回调函数
 *
 * 返回值中：
 * - `match`: 为 true 时将该节点加入结果集
 * - `result`: 匹配时使用的值，缺省则用 node 本身
 * - `stop` / `skipChildren`: 控制遍历行为
 */
type TraverseCallback<T, R> = (
  node: T,
  ctx: TraverseContext<T>,
) => {
  match?: boolean;
  result?: R;
} & TraverseControl;

const DEFAULT_GET_CHILDREN = <T>(node: T) =>
  (node as { children?: T[] }).children;

/**
 * 深度优先遍历树，收集所有匹配的节点
 *
 * @param nodes - 根节点数组（支持多棵树）
 * @param callback - 每个节点调用一次，通过返回值控制匹配与遍历行为
 * @param options - 可选配置
 * @returns 所有 match 为 true 的节点对应的 result（或 node 本身）
 *
 * @example
 * // 1. 查找所有叶子节点
 * const tree = [{ id: 1, children: [{ id: 2, children: [] }, { id: 3, children: [] }] }];
 * const leaves = traverseTree(tree, (node) => ({
 *   match: !node.children?.length,
 * }));
 * // => [{ id: 2, children: [] }, { id: 3, children: [] }]
 *
 * @example
 * // 2. 按条件过滤并转换
 * const ids = traverseTree(tree, (node) => ({
 *   match: node.type === 'file',
 *   result: node.id,
 * }));
 *
 * @example
 * // 3. 查找第一个匹配后终止
 * const first = traverseTree(tree, (node) => ({
 *   match: node.id === targetId,
 *   result: node,
 *   stop: node.id === targetId,
 * }))[0];
 *
 * @example
 * // 4. 跳过某类节点的子树
 * traverseTree(tree, (node) => ({
 *   match: node.visible,
 *   skipChildren: node.collapsed,
 * }));
 *
 * @example
 * // 5. 获取从根到匹配节点的路径
 * const paths = traverseTree(tree, (node, ctx) => ({
 *   match: node.id === targetId,
 *   result: [...ctx.path],
 * }));
 *
 * @example
 * // 6. 自定义子节点字段 + 限制深度
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
 * 查找树中第一个匹配的节点
 *
 * @param nodes - 根节点数组
 * @param predicate - 判断是否匹配的函数
 * @param options - 可选配置
 * @returns 第一个匹配的节点，未找到返回 undefined
 *
 * @example
 * // 按 id 查找
 * const tree = [{ id: 1, children: [{ id: 2, name: 'B', children: [] }] }];
 * const node = traverseFind(tree, (n) => n.id === 2);
 * // => { id: 2, name: 'B', children: [] }
 *
 * @example
 * // 结合上下文（depth、path）查找
 * const node = traverseFind(tree, (n, { depth }) => depth === 1 && n.type === 'file');
 *
 * @example
 * // 自定义子节点字段
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
