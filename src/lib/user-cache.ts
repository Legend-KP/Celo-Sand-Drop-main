import { Redis } from '@upstash/redis';
import { APP_NAME } from './constants';

// User data cache interface
interface CachedUserData {
  fid: number;
  flowPoints: number;
  points?: {
    total: number;
  };
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  cachedAt: number;
}

// In-memory fallback storage (for local dev or when Redis is unavailable)
const localCache = new Map<number, CachedUserData>();

// Use Redis if KV env vars are present, otherwise use in-memory
const useRedis = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
const redis = useRedis
  ? new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    })
  : null;

// Cache TTL: 1 hour (3600 seconds) - longer TTL to prevent thumbnails reverting to 0
const CACHE_TTL = 3600;

function getUserCacheKey(fid: number): string {
  return `${APP_NAME}:user-data:${fid}`;
}

/**
 * Get cached user data
 * Returns null if not cached or expired
 */
export async function getCachedUserData(
  fid: number
): Promise<CachedUserData | null> {
  const key = getUserCacheKey(fid);
  //console.log(`🔍 [Cache] Reading cache for key: ${key} (FID: ${fid})`);
  
  if (redis) {
    try {
      const cached = await redis.get<CachedUserData>(key);
      if (cached) {
        // Return cached data even if expired (better than showing 0)
        // Only delete if extremely old (24 hours) to prevent stale data accumulation
        const age = Date.now() - cached.cachedAt;
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        if (age < maxAge) {
          // Return cached data (even if expired beyond TTL)
          return cached;
        }
        // Cache is extremely old, delete it
        await redis.del(key);
      }
      return null;
    } catch (error) {
      //console.warn('❌ [Cache] Redis read error:', error);
      return null;
    }
  }
  
  // Fallback to in-memory cache
  const cached = localCache.get(fid);
  if (cached) {
    // Return cached data even if expired (better than showing 0)
    // Only delete if extremely old (24 hours)
    const age = Date.now() - cached.cachedAt;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (age < maxAge) {
      // Return cached data (even if expired beyond TTL)
      return cached;
    }
    // Cache is extremely old, delete it
    localCache.delete(fid);
  }
  return null;
}

/**
 * Cache user data
 */
export async function setCachedUserData(
  fid: number,
  userData: Omit<CachedUserData, 'cachedAt'>
): Promise<void> {
  const key = getUserCacheKey(fid);
  const cachedData: CachedUserData = {
    ...userData,
    cachedAt: Date.now(),
  };
  
  //console.log(`💾 [Cache] Setting cache for key: ${key} (FID: ${fid}, Points: ${cachedData.flowPoints})`);
  
  if (redis) {
    try {
      // Store with TTL in Redis
      await redis.setex(key, CACHE_TTL, cachedData);
      //console.log(`✅ [Cache] Stored in Redis: ${cachedData.flowPoints} FP`);
    } catch (error) {
      //console.warn('❌ [Cache] Redis write error:', error);
      // Fallback to in-memory
      localCache.set(fid, cachedData);
      //console.log(`✅ [Cache] Fallback to in-memory: ${cachedData.flowPoints} FP`);
    }
  } else {
    // Use in-memory cache
    localCache.set(fid, cachedData);
    //console.log(`✅ [Cache] Stored in-memory: ${cachedData.flowPoints} FP (cache size: ${localCache.size})`);
  }
}

/**
 * Invalidate cached user data (useful when user data is updated)
 */
export async function invalidateUserCache(fid: number): Promise<void> {
  const key = getUserCacheKey(fid);
  
  if (redis) {
    try {
      await redis.del(key);
    } catch (error) {
      //console.warn('Redis cache delete error:', error);
    }
  }
  
  localCache.delete(fid);
}

/**
 * Clear all user cache (useful for testing or maintenance)
 */
export async function clearAllUserCache(): Promise<void> {
  if (redis) {
    try {
      // Note: This is a simple implementation. For production, you might want
      // to use a pattern-based delete or maintain a list of keys
      const pattern = `${APP_NAME}:user-data:*`;
      // Upstash Redis doesn't support KEYS, so we'd need to track keys separately
      // For now, we'll just clear the in-memory cache
      //console.warn('Redis pattern delete not implemented. Clearing in-memory cache only.');
    } catch (error) {
      //console.warn('Redis cache clear error:', error);
    }
  }
  
  localCache.clear();
}

