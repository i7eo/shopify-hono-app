import { throwError } from "./error";

type RandomOptions = {
  /** Number of values to generate. Defaults to 1. */
  count?: number;
  /** Minimum generated value. Defaults to 0. */
  min?: number;
  /** Maximum generated value. Defaults to 1. */
  max?: number;
  /** Generate integers when true. Defaults to false. */
  integer?: boolean;
  /** Deduplicate generated values when true. Defaults to false. */
  unique?: boolean;
};

/**
 * Generate random numbers within a configurable range.
 */
export function generateRandom(options: RandomOptions = {}) {
  const {
    count = 1,
    min = 0,
    max = 1,
    integer = false,
    unique = false,
  } = options;

  if (min > max) {
    throwError("generateRandom", "'min' cannot be greater than 'max'");
  }

  if (unique && integer && max - min + 1 < count) {
    throwError(
      "generateRandom",
      "The number of integers within the range is insufficient to generate a unique value.",
    );
  }

  const result = new Set<number>();

  /** Generate one random value according to the configured range and mode. */
  const getRandom = () => {
    const rand = Math.random() * (max - min) + min;
    return integer ? Math.floor(rand) : rand;
  };

  while (result.size < count) {
    const value = getRandom();

    if (unique) {
      result.add(value);
    } else {
      result.add(Symbol() as unknown as number); // Placeholder to avoid Set deduplication.
      (result as any).add(value);
      break;
    }
  }

  // Return an array directly when unique values are not required.
  if (!unique) {
    return Array.from({ length: count }, getRandom);
  }

  return Array.from(result);
}
