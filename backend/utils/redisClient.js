/**
 * Redis Client for production rate limiting
 * 
 * Provides Redis-based rate limiting with graceful fallback to in-memory.
 * 
 * Usage:
 *   import { checkRateLimit } from './redisClient.js';
 *   const allowed = await checkRateLimit('report:user:123', 5, 60);
 */

// In-memory fallback store
const memoryStore = new Map();
const MEMORY_PREFIX = 'rl:mem:';

// Cleanup interval for memory store
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

let redisClient = null;
let redisAvailable = false;

/**
 * Attempt to initialize Redis connection
 * Falls back gracefully to in-memory if Redis is unavailable
 */
export const initRedis = async () => {
  try {
    // Dynamic import to avoid crash if ioredis is not installed
    const Redis = (await import('ioredis')).default;
    
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryStrategy: (times) => {
        if (times > 3) {
          console.warn('[Redis] Max retries reached. Falling back to in-memory rate limiter.');
          redisAvailable = false;
          return null; // Stop retrying
        }
        return Math.min(times * 200, 2000);
      },
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      lazyConnect: true
    });

    redisClient.on('connect', () => {
      console.log('[Redis] Connected successfully.');
      redisAvailable = true;
    });

    redisClient.on('error', (err) => {
      console.warn('[Redis] Connection error:', err.message);
      redisAvailable = false;
    });

    redisClient.on('close', () => {
      redisAvailable = false;
    });

    // Try to connect
    await redisClient.connect();
    redisAvailable = true;
    console.log('[Redis] Rate limiter initialized with Redis.');
    return true;
  } catch (err) {
    console.warn('[Redis] Not available. Using in-memory rate limiter fallback.');
    console.warn('[Redis] Error:', err.message);
    redisAvailable = false;
    return false;
  }
};

/**
 * Check rate limit for a given key
 * 
 * @param {string} key - Unique identifier (e.g., 'report:user:123')
 * @param {number} maxRequests - Maximum requests allowed in window
 * @param {number} windowSeconds - Time window in seconds
 * @returns {Promise<{allowed: boolean, remaining: number, resetIn: number}>}
 */
export const checkRateLimit = async (key, maxRequests = 5, windowSeconds = 60) => {
  if (redisAvailable && redisClient) {
    return checkRateLimitRedis(key, maxRequests, windowSeconds);
  }
  return checkRateLimitMemory(key, maxRequests, windowSeconds);
};

/**
 * Redis-based rate limit check
 */
const checkRateLimitRedis = async (key, maxRequests, windowSeconds) => {
  try {
    const redisKey = `rl:${key}`;
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const clearBefore = now - windowMs;

    // Remove old entries
    await redisClient.zremrangebyscore(redisKey, 0, clearBefore);

    // Count current entries
    const count = await redisClient.zcard(redisKey);

    if (count >= maxRequests) {
      // Get TTL for oldest entry
      const oldest = await redisClient.zrange(redisKey, 0, 0, 'WITHSCORES');
      const resetIn = oldest[1] ? Math.ceil((parseInt(oldest[1]) + windowMs - now) / 1000) : windowSeconds;
      
      return {
        allowed: false,
        remaining: 0,
        resetIn
      };
    }

    // Add current request
    await redisClient.zadd(redisKey, now, `${now}-${Math.random()}`);
    await redisClient.expire(redisKey, windowSeconds);

    return {
      allowed: true,
      remaining: maxRequests - count - 1,
      resetIn: windowSeconds
    };
  } catch (err) {
    console.warn('[Redis] Rate limit check failed, falling back to memory:', err.message);
    redisAvailable = false;
    return checkRateLimitMemory(key, maxRequests, windowSeconds);
  }
};

/**
 * In-memory rate limit check (fallback)
 */
const checkRateLimitMemory = (key, maxRequests, windowSeconds) => {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const memKey = `${MEMORY_PREFIX}${key}`;
  
  const entries = memoryStore.get(memKey) || [];
  const valid = entries.filter(t => now - t < windowMs);

  if (valid.length >= maxRequests) {
    const oldest = valid[0];
    const resetIn = Math.ceil((oldest + windowMs - now) / 1000);
    memoryStore.set(memKey, valid);
    
    return {
      allowed: false,
      remaining: 0,
      resetIn: Math.max(resetIn, 1)
    };
  }

  valid.push(now);
  memoryStore.set(memKey, valid);

  return {
    allowed: true,
    remaining: maxRequests - valid.length,
    resetIn: windowSeconds
  };
};

// Periodic cleanup of memory store
setInterval(() => {
  const now = Date.now();
  for (const [key, entries] of memoryStore.entries()) {
    const valid = entries.filter(t => now - t < 60000);
    if (valid.length === 0) {
      memoryStore.delete(key);
    } else {
      memoryStore.set(key, valid);
    }
  }
}, CLEANUP_INTERVAL);

export default {
  initRedis,
  checkRateLimit
};