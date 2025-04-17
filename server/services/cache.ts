import { createClient } from 'redis';

// Create Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Connect to Redis
redisClient.connect().catch(console.error);

// Handle Redis errors
redisClient.on('error', (err) => console.error('Redis Client Error:', err));

export const cacheService = {
  /**
   * Get value from cache
   * @param key Cache key
   * @returns Parsed value or null if not found
   */
  async get(key: string) {
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      // Fail gracefully in production
      return null;
    }
  },
  
  /**
   * Set value in cache
   * @param key Cache key
   * @param value Value to cache (will be JSON stringified)
   * @param expireSeconds Expiration time in seconds (default: 60)
   */
  async set(key: string, value: any, expireSeconds: number = 60) {
    try {
      await redisClient.set(key, JSON.stringify(value), {
        EX: expireSeconds
      });
    } catch (error) {
      console.error('Redis set error:', error);
      // Fail gracefully in production
    }
  },
  
  /**
   * Invalidate cache entries by pattern
   * @param pattern Redis key pattern to match (e.g. "events:*")
   */
  async invalidate(pattern: string) {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    } catch (error) {
      console.error('Redis invalidate error:', error);
      // Fail gracefully in production
    }
  }
};

/**
 * Higher-order function that wraps a function with caching
 * @param fn Function to cache
 * @param keyPrefix Prefix for cache key
 * @param expireSeconds Expiration time in seconds
 * @returns Wrapped function with caching
 */
export function withCache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyPrefix: string,
  expireSeconds: number = 60
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const cacheKey = `${keyPrefix}:${JSON.stringify(args)}`;
    
    // Try to get from cache
    const cachedResult = await cacheService.get(cacheKey);
    if (cachedResult !== null) {
      return cachedResult as ReturnType<T>;
    }
    
    // If not in cache, call original function
    const result = await fn(...args);
    
    // Cache the result
    await cacheService.set(cacheKey, result, expireSeconds);
    
    return result;
  }) as T;
}