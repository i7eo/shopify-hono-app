type ElementLike = {
  nodeType: number;
  nodeName: string;
};

type WindowLike = {
  window: unknown;
};

/**
 * Shared Object.prototype.toString reference for type checks.
 */
export const objectToString = Object.prototype.toString;

/**
 * Check whether a value has the given Object.prototype.toString type name.
 */
export const is = (value: unknown, type: string): boolean =>
  objectToString.call(value) === `[object ${type}]`;

/**
 * Check whether a value is an array.
 */
export const isArray = Array.isArray;

// export const isMap = (val: unknown): val is Map<any, any> => is(val, 'Map');

// export const isSet = (val: unknown): val is Set<any> => is(val, 'Set');

// export const isBoolean = (val: unknown): val is Boolean => is(val, 'Boolean')

// export const isNumber = (val: unknown): val is number => is(val, "Number");

// export const isDate = (val: unknown): val is Date => is(val, 'Date');

// export const isFunction = (val: unknown): val is Function =>
//   typeof val === 'function'

// export const isString = (val: unknown): val is string => typeof val === 'string'

// export const isSymbol = (val: unknown): val is symbol => typeof val === 'symbol'

/**
 * Check whether a value is a non-null object.
 */
export const isObject = (val: unknown): val is Record<any, any> =>
  val !== null && typeof val === "object";

// export const isPlainObject = (val: unknown): val is object => is(val, 'Object')

/**
 * Check whether a value has the Object toString tag.
 */
export const isObjectLike = (val: unknown) => {
  return val != null && is(val, "Object");
};

// export const isPromise = <T = any>(val: unknown): val is Promise<T> =>
//   isObject(val) && isFunction(val.then) && isFunction(val.catch);

/**
 * Check whether a value is not undefined.
 */
export const isDef = <T = any>(val?: T): val is T => val !== undefined;

/**
 * Check whether a value is undefined.
 */
export const isUndef = (val: any): val is undefined => val === undefined;

// export const isRegExp = (val: unknown): val is RegExp => is(val, 'RegExp');

/**
 * Check whether a value is empty, including empty arrays and plain objects.
 */
export const isEmpty = (val: unknown) =>
  (!val && val !== 0) ||
  (isArray(val) && val.length === 0) ||
  (isObject(val) && !Object.keys(val).length);

/**
 * Check whether a value is a DOM-like Element without requiring DOM lib types.
 */
export const isElement = (value: unknown): value is ElementLike => {
  const scope = globalThis as typeof globalThis & {
    Element?: new (...args: any[]) => unknown;
  };

  return scope.Element !== undefined && value instanceof scope.Element;
};

/**
 * Check whether a string looks like an absolute URL.
 */
export function isUrl(path: string): boolean {
  const reg =
    /^(?:https?:(?:\/\/)?(?:[\w$&+,:;=-]+@)?[\d.A-Za-z-]+(?::\d+)?|(?:www\.|[\w$&+,:;=-]+@)[\d.A-Za-z-]+)(?:\/[%+./~\w-]*)?(?:\?[\w%&+.;=@-]*)?(?:#\w*)?$/;
  return reg.test(path);
}

/**
 * Check whether a value is the current global window object.
 */
export const isWindow = (value: unknown): value is WindowLike => {
  const scope = globalThis as typeof globalThis & {
    window?: unknown;
  };

  return scope.window !== undefined && value === scope.window;
};

/**
 * Check whether the current runtime has no global window object.
 */
export const isServer = () =>
  (globalThis as typeof globalThis & { window?: unknown }).window === undefined;

/**
 * Check whether the current runtime has a global window object.
 */
export const isClient = () => !isServer();
