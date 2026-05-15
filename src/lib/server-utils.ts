import { Redis } from '@upstash/redis';
import { APP_NAME } from './constants';

/**
 * Server-side utility functions
 * These functions can be used in API routes and server components
 */

// Cache for leaderboard data
const useRedis = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
const redis = useRedis
  ? new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    })
  : null;

// In-memory cache fallback
const leaderboardCache = new Map<string, { data: any; cachedAt: number }>();
const LEADERBOARD_CACHE_TTL = 60; // 1 minute (rank changes more frequently)

/**
 * Calculate user's rank in the leaderboard using Firebase REST API
 * This is a server-side version that doesn't require Firebase client SDK
 * Uses caching to reduce Firebase API calls
 */
export async function calculateUserRankServerSide(
  fid: number,
  userFlowPoints: number
): Promise<{
  rank: number;
  total: number;
  percentile: number;
}> {
  const databaseUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
  if (!databaseUrl) {
    //console.warn('Firebase database URL not configured');
    return { rank: 0, total: 0, percentile: 0 };
  }

  try {
    // Check cache for leaderboard data
    const cacheKey = `${APP_NAME}:leaderboard:all`;
    let usersData;
    
    if (redis) {
      try {
        const cached = await redis.get<{ data: any; cachedAt: number }>(cacheKey);
        if (cached) {
          const age = Date.now() - cached.cachedAt;
          if (age < LEADERBOARD_CACHE_TTL * 1000) {
            usersData = cached.data;
          }
        }
      } catch (error) {
        //console.warn('Redis leaderboard cache read error:', error);
      }
    } else {
      const cached = leaderboardCache.get(cacheKey);
      if (cached) {
        const age = Date.now() - cached.cachedAt;
        if (age < LEADERBOARD_CACHE_TTL * 1000) {
          usersData = cached.data;
        }
      }
    }
    
    // Fetch from Firebase if cache miss
    if (!usersData) {
      // Fetch all users from Firebase REST API
      // Using users format as per firebase.ts structure (lowercase 'users')
      const usersUrl = `${databaseUrl}/users.json`;
      const response = await fetch(usersUrl, {
        next: { revalidate: 60 }, // Cache for 60 seconds
      });

      if (!response.ok) {
        //console.warn('Failed to fetch users from Firebase');
        return { rank: 0, total: 0, percentile: 0 };
      }

      usersData = await response.json();
      if (!usersData) {
        return { rank: 0, total: 0, percentile: 0 };
      }
      
      // Cache the leaderboard data
      const cacheData = { data: usersData, cachedAt: Date.now() };
      if (redis) {
        try {
          await redis.setex(cacheKey, LEADERBOARD_CACHE_TTL, cacheData);
        } catch (error) {
          //console.warn('Redis leaderboard cache write error:', error);
          leaderboardCache.set(cacheKey, cacheData);
        }
      } else {
        leaderboardCache.set(cacheKey, cacheData);
      }
    }

    // Count users with more points
    let rank = 1;
    let total = 0;

    Object.keys(usersData).forEach((uid) => {
      const data = usersData[uid];
      const userPoints = data.points?.total || 0;

      total++;
      if (userPoints > userFlowPoints) {
        rank++;
      }
    });

    const percentile = total > 0 ? ((rank / total) * 100) : 0;

    return {
      rank,
      total,
      percentile: parseFloat(percentile.toFixed(1)),
    };
  } catch (error) {
    //console.error(`Error calculating rank for user ${fid}:`, error);
    return { rank: 0, total: 0, percentile: 0 };
  }
}

