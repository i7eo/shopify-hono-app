type RandomOptions = {
  count?: number; // 生成数量（默认1）
  min?: number; // 最小值（默认0）
  max?: number; // 最大值（默认1）
  integer?: boolean; // 是否整数（默认false）
  unique?: boolean; // 是否去重（默认false）
};

export function generateRandom(options: RandomOptions = {}) {
  const {
    count = 1,
    min = 0,
    max = 1,
    integer = false,
    unique = false,
  } = options;

  if (min > max) {
    throw new Error("min 不能大于 max");
  }

  if (unique && integer && max - min + 1 < count) {
    throw new Error("范围内的整数数量不足以生成唯一值");
  }

  const result = new Set<number>();

  const getRandom = () => {
    const rand = Math.random() * (max - min) + min;
    return integer ? Math.floor(rand) : rand;
  };

  while (result.size < count) {
    const value = getRandom();

    if (unique) {
      result.add(value);
    } else {
      result.add(Symbol() as unknown as number); // 占位避免 Set 去重
      (result as any).add(value);
      break;
    }
  }

  // 非 unique 时直接返回数组
  if (!unique) {
    return Array.from({ length: count }, getRandom);
  }

  return Array.from(result);
}
