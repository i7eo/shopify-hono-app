/**
 * Value that may be returned directly or as a PromiseLike.
 */
export type Awaitable<T> = T | PromiseLike<T>;

/**
 * Value that may be null or undefined.
 */
export type Nullable<T> = T | null | undefined;

/**
 * Value that may be a single item or an array of items.
 */
export type Arrayable<T> = T | Array<T>;

/**
 * String-keyed object record.
 */
export type Recordable<T = any> = Record<string, T>;

/**
 * Zero-argument function type.
 */
export type Fn<T = void> = () => T;

/**
 * Constructor type for class-like values.
 */
export type Constructor<T = void> = new (...args: any[]) => T;

/**
 * Distribute keys across union members.
 * @example
 * type keys = Keys<keyof {}>
 */
export type Keys<T> = T extends any ? T : never;

/**
 * Infer the element type of an array.
 */
export type ElementOf<T> = T extends (infer E)[] ? E : never;

/**
 * Infer the argument tuple type of a function.
 */
export type ArgumentsOf<T> = T extends (...args: infer A) => any ? A : never;

/**
 * Infer the resolved return type of a function.
 */
export type ReturnOf<T extends (...args: any[]) => any> =
  ReturnType<T> extends Promise<infer R> ? R : ReturnType<T>;

/**
 * Merge two record types by key.
 */
export type MergeRecord<T extends Recordable, V extends Recordable> = {
  [PK in keyof (T & V)]: PK extends keyof T
    ? T[PK]
    : PK extends keyof V
      ? V[PK]
      : never;
};

/**
 * Defines an intersection type of all union items.
 *
 * @param U Union of any types that will be intersected.
 * @returns U items intersected
 * @see https://stackoverflow.com/a/50375286/9259330
 */
export type UnionToIntersection<U> = (
  U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

/**
 * Recursively expand mapped object intersections for better type display.
 */
export type MergeInsertions<T> = T extends object
  ? { [K in keyof T]: MergeInsertions<T[K]> }
  : T;

/**
 * Deeply merge two object types.
 */
export type DeepMerge<F, S> = MergeInsertions<{
  [K in keyof F | keyof S]: K extends keyof S & keyof F
    ? DeepMerge<F[K], S[K]>
    : K extends keyof S
      ? S[K]
      : K extends keyof F
        ? F[K]
        : never;
}>;

/**
 * Map with typed key/value access for a known object shape.
 */
export interface CustomMap<T> extends Map<keyof T, T[keyof T]> {
  get: <Key extends keyof T>(key: Key) => T[Key];
  set: <Key extends keyof T>(key: Key, value: T[Key]) => this;
  // Override selected Map methods with key-aware signatures.
}
