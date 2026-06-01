import { traverseTree } from "./traverse";

/** 树形结构字段配置，用于适配不同数据结构 */
interface TreeHelperConfig {
  /** 节点唯一标识字段名 */
  id: string;
  /** 子节点数组字段名 */
  children: string;
  /** 父节点 ID 字段名 */
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

const getConfig = (config: Partial<TreeHelperConfig>) =>
  Object.assign({}, DEFAULT_CONFIG, config);

/**
 * 扁平列表转树形结构
 *
 * @param list - 扁平节点列表，每项需包含 id 和 pid
 * @param config - 字段映射，缺省使用 { id, children, pid }
 * @returns 树形结构根节点数组
 * @remarks 会原地修改 list 中的节点，添加 children 字段
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
 * 树形结构转扁平列表（BFS 广度优先）
 *
 * @param tree - 树形结构根节点数组
 * @param config - 字段映射
 * @param clearParentChildren - 为 true 时清空各节点的 children，减少引用
 * @returns 按 BFS 顺序的扁平节点数组（同一批对象引用）
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
 * 查找树中第一个满足条件的节点
 *
 * @param tree - 树形结构
 * @param func - 断言函数，返回 true 表示匹配
 * @param config - 字段映射
 * @returns 匹配的节点或 null
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
 * 查找树中所有满足条件的节点
 *
 * @param tree - 树形结构
 * @param func - 断言函数
 * @param config - 字段映射
 * @returns 匹配节点数组
 *
 * @example
 * const tree = [{ id: 1, children: [{ id: 2, children: [] }, { id: 3, children: [] }] }];
 * findNodeAll(tree, (n) => !n.children?.length);
 * // => [{ id: 2, children: [] }, { id: 3, children: [] }]  // 所有叶子节点
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
 * 查找从根到第一个匹配节点的路径
 *
 * @param tree - 树形结构
 * @param func - 断言函数
 * @param config - 字段映射
 * @returns 路径节点数组 [root, ..., target]，未找到返回 null
 *
 * @example
 * const tree = [{ id: 1, children: [{ id: 2, children: [{ id: 4, children: [] }] }] }];
 * findPath(tree, (n) => n.id === 4);
 * // => [节点1, 节点2, 节点4]
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
 * 查找所有满足条件节点的路径
 *
 * @param tree - 树形结构
 * @param func - 断言函数
 * @param config - 字段映射
 * @returns 路径数组，每项为 [root, ..., target]
 *
 * @example
 * const tree = [{ id: 1, children: [{ id: 2, children: [] }, { id: 3, children: [] }] }];
 * findPathAll(tree, (n) => !n.children?.length);
 * // => [[节点1, 节点2], [节点1, 节点3]]
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
 * 按条件过滤树，保留匹配节点及其祖先（以保证路径完整）
 *
 * @param tree - 树形结构
 * @param func - 过滤函数，返回 truthy 表示保留该节点
 * @param config - 字段映射
 * @returns 过滤后的新树（浅拷贝节点）
 * @remarks 若节点不匹配但存在匹配的子节点，该节点仍会保留
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
 * 深度优先遍历树
 *
 * @param tree - 树形结构
 * @param func - 回调，返回 true 时终止遍历
 * @param config - 字段映射
 * @remarks 适用于大量节点时提前终止，避免无效遍历
 *
 * @example
 * const tree = [{ id: 1, children: [{ id: 2, children: [] }] }];
 * forEach(tree, (n) => { console.log(n.id); return n.id === 2; });
 * // 输出 1, 2 后终止
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
 * 按 conversion 转换整棵树的结构
 *
 * @param treeData - 树形数据
 * @param opt - 配置项
 * @param opt.children - 子节点字段名
 * @param opt.conversion - 转换函数 (node) => 新节点字段
 * @returns 转换后的新树
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
 * 转换单个节点及其子树（供 treeMap 内部使用）
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
 * 查找以 childrenId 为根的子树中所有节点（含该节点）
 *
 * @param tree - 树形结构
 * @param childrenId - 目标子树根节点 id
 * @param func - 可选转换，返回新值则用新值替代原节点
 * @param config - 字段映射
 * @returns 子树节点数组
 *
 * @example
 * const tree = [{ id: 1, children: [{ id: 2, children: [{ id: 4, children: [] }] }] }];
 * findChildrens(tree, 1, (n) => n);
 * // => [节点1, 节点2, 节点4]
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
 * 查找指定节点的所有祖先（从该节点到根）
 *
 * @param tree - 树形结构
 * @param parentId - 目标节点 id（注意参数名为 parentId 实为节点 id）
 * @param func - 可选转换
 * @param config - 字段映射
 * @returns 祖先节点数组 [节点自身, 父, 祖父, ...]
 *
 * @example
 * const tree = [{ id: 1, pid: 0, children: [{ id: 2, pid: 1, children: [{ id: 4, pid: 2, children: [] }] }] }];
 * findParents(tree, 4, (n) => n);
 * // => [节点4, 节点2, 节点1]
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
