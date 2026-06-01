/**
 * Trims all prefix and suffix characters from the given
 * string. Like the builtin trim function but accepts
 * other characters you would like to trim and trims
 * multiple characters.
 *
 * ```typescript
 * trim('  hello ') // => 'hello'
 * trim('__hello__', '_') // => 'hello'
 * trim('/repos/:owner/:repo/', '/') // => 'repos/:owner/:repo'
 * trim('222222__hello__1111111', '12_') // => 'hello'
 * ```
 */
// export const trim = (str: string | null | undefined, charsToTrim = ' ') => {
//   if (!str) return '';
//   const toTrim = charsToTrim.replaceAll(/\W/g, '\\$&');
//   const regex = new RegExp(`^[${toTrim}]+|[${toTrim}]+$`, 'g');
//   return str.replace(regex, '');
// };

/**
 * Ensure prefix of a string
 *
 * @category String
 */
export function ensurePrefix(prefix: string, str: string) {
  if (!str.startsWith(prefix)) return prefix + str;
  return str;
}

/**
 * Ensure suffix of a string
 *
 * @category String
 */
export function ensureSuffix(suffix: string, str: string) {
  if (!str.endsWith(suffix)) return str + suffix;
  return str;
}
