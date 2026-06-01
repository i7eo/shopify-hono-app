export enum DEFAULT_CACHE_TYPES {
  MEMORY = "memory",
  REDIS = "redis",
  PLATFORM = "platform",
}
export const DEFAULT_CACHE_TYPE = DEFAULT_CACHE_TYPES.MEMORY;
export const DEFAULT_CACHE_REDIS_URL = "redis://127.0.0.1:6379";
export const DEFAULT_CACHE_MAX_SIZE = 1024 * 1024 * 5; // limit size 5M
export const DEFAULT_CACHE_EXPIRE = 1000 * 60 * 5; // limit 5 minutes
