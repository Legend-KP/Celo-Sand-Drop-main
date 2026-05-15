import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { 
  getDatabase, 
  ref, 
  get, 
  onValue
} from "firebase/database";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

// ==========================================
// FIREBASE CONFIGURATION
// ==========================================

const environment = process.env.NEXT_PUBLIC_FIREBASE_ENV || 'development';



// Load configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
};

// Validate critical configuration
if (!firebaseConfig.databaseURL) {
  const isVercel = process.env.VERCEL === '1';
  const errorMsg = isVercel
    ? '❌ Firebase Database URL is missing in Vercel!\n' +
      'Go to Vercel Dashboard → Your Project → Settings → Environment Variables\n' +
      'Add: NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://flowtrency-97f3a-default-rtdb.asia-southeast1.firebasedatabase.app\n' +
      'Make sure to enable it for Production, Preview, and Development environments.'
    : '❌ Firebase Database URL is missing!\n' +
      'Make sure .env.local exists and contains:\n' +
      'NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://flowtrency-97f3a-default-rtdb.asia-southeast1.firebasedatabase.app';
  throw new Error(errorMsg);
}

if (!firebaseConfig.apiKey) {
  const isVercel = process.env.VERCEL === '1';
  const errorMsg = isVercel
    ? '❌ Firebase API Key is missing in Vercel!\n' +
      'Go to Vercel Dashboard → Your Project → Settings → Environment Variables\n' +
      'Add all NEXT_PUBLIC_FIREBASE_* variables from your .env.local file.\n' +
      'Make sure to enable them for Production, Preview, and Development environments.'
    : '❌ Firebase API Key is missing!\n' +
      'Make sure .env.local contains all required NEXT_PUBLIC_FIREBASE_* variables';
  throw new Error(errorMsg);
}

// Initialize Firebase
let app;
try {
  app = initializeApp(firebaseConfig);
  //console.log('✅ Firebase initialized successfully');
  //console.log(`📊 Project: ${firebaseConfig.projectId}`);
} catch (error) {
  //console.error('❌ Firebase initialization failed:', error);
  throw error;
}

// Initialize Realtime Database
export const db = getDatabase(app);

// Initialize Auth
export const auth = getAuth(app);

// Initialize Analytics (only in browser)
let analytics;
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch (error) {
    //console.warn('Analytics initialization failed:', error);
  }
}

export { analytics };
export const firebaseEnvironment = environment;

// ==========================================
// SIMPLE USERNAME CACHE (5 minutes TTL)
// ==========================================

interface CachedUsername {
  username: string;
  displayName?: string;
  pfpUrl?: string;
  cachedAt: number;
}

const usernameCache = new Map<number, CachedUsername>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Clean expired entries periodically
if (typeof window !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [fid, cached] of usernameCache.entries()) {
      if (now - cached.cachedAt > CACHE_TTL) {
        usernameCache.delete(fid);
      }
    }
  }, 60000); // Clean every minute
}

// ==========================================
// AUTHENTICATION - CLIENT-SIDE ONLY
// ==========================================

let resolveAuthReady: (() => void) | null = null;
let rejectAuthReady: ((error: Error) => void) | null = null;

export const authReady = new Promise<void>((resolve, reject) => {
  resolveAuthReady = resolve;
  rejectAuthReady = reject;
});

// Only run authentication in browser
if (typeof window !== 'undefined') {
  //console.log('🔐 Starting anonymous authentication...');
  
  signInAnonymously(auth)
    .then(() => {
      //console.log('🔐 Anonymous sign-in initiated');
    })
    .catch((error) => {
      //console.error('❌ Anonymous auth failed:', error);
      if (rejectAuthReady) {
        rejectAuthReady(error as Error);
      }
    });

  // Set timeout for auth
  const authTimeout = setTimeout(() => {
    //console.warn('⚠️ Authentication taking too long, proceeding anyway...');
    if (resolveAuthReady) {
      resolveAuthReady();
    }
  }, 10000); // 10 seconds

  // Listen for auth state changes
  onAuthStateChanged(auth, (user) => {
    if (user) {
      clearTimeout(authTimeout);
      //console.log('✅ Firebase Auth Ready → UID:', user.uid);
      if (resolveAuthReady) {
        resolveAuthReady();
      }
    }
  });
} else {
  // On server, auth is not available - this is fine for client-side operations
  //console.log('⚠️ Running on server - auth not initialized');
}

// ==========================================
// TYPES
// ==========================================

export interface UserFlowData {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  coins: number;
  flowPoints: number;
  gamesPlayed?: number;
  timeSpent?: string;
  streak?: number;
  lastUpdated?: string;
  dailyReward?: {
    claimedToday: boolean;
    lastClaimTime: string;
  };
  points?: {
    total: number;
  };
  spin?: {
    dailyChancesLeft: number;
    lastResetTime: string;
  };
}

export interface LeaderboardEntry {
  rank: number;
  fid: number;
  username: string;
  avatar: string;
  points: number;
}

// ==========================================
// HELPER: CHECK IF CLIENT-SIDE
// ==========================================

function isClient(): boolean {
  return typeof window !== 'undefined';
}

// ==========================================
// USER FUNCTIONS (CLIENT-SIDE ONLY)
// ==========================================

/**
 * Get user data by FID from Realtime Database
 * Always fetches username, displayName, and pfpUrl from Farcaster/Neynar API
 */
export async function getUserByFid(fid: number): Promise<UserFlowData | null> {
  if (!isClient()) {
    throw new Error('getUserByFid can only be called from the browser');
  }

  // Wait for authentication
  await authReady;
  
  try {
    //console.log(`📖 Fetching user ${fid} from ${environment} database...`);
    
    const userRef = ref(db, `users/${fid}`);
    const snapshot = await get(userRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      // Get points from snapshot - same logic as minified code: (null == (t = r.points) ? void 0 : t.total) || 0
      const flowPoints = data?.points?.total ?? 0;
      
      //console.log(`✅ User ${fid} found - ${flowPoints} Flow Points`);
      
      // Always fetch username, displayName, and pfpUrl from Farcaster/Neynar
      let username = `user${fid}`; // Fallback
      let displayName: string | undefined;
      let pfpUrl: string | undefined;
      
      try {
        const response = await fetch(`/api/users?fids=${fid}`);
        if (response.ok) {
          const neynarData = await response.json();
          if (neynarData.users && neynarData.users[0]) {
            const neynarUser = neynarData.users[0];
            username = neynarUser.username || username;
            displayName = neynarUser.display_name;
            pfpUrl = neynarUser.pfp_url;
          }
        } else {
          //console.warn(`Failed to fetch Neynar user for FID ${fid}: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        //console.warn(`Error fetching Neynar user for FID ${fid}:`, error);
      }
      
      return {
        fid,
        username,
        displayName,
        pfpUrl,
        coins: data.coins ?? 0,
        flowPoints,
        gamesPlayed: data.gamesPlayed ?? 0,
        timeSpent: data.timeSpent ?? '0h 0m',
        streak: data.streak ?? 0,
        lastUpdated: data.lastUpdated,
        dailyReward: data.dailyReward,
        points: data.points ?? { total: flowPoints },
        spin: data.spin
      };
    }
    
    //console.log(`⚠️ User ${fid} not found`);
    return null;
  } catch (error) {
    //console.error(`❌ Error fetching user ${fid}:`, error);
    return null;
  }
}

/**
 * Get multiple users by FIDs
 */
export async function getUsersByFids(fids: number[]): Promise<UserFlowData[]> {
  if (!isClient()) {
    throw new Error('getUsersByFids can only be called from the browser');
  }

  // Wait for authentication
  await authReady;
  
  try {
    const users: UserFlowData[] = [];
    
    for (const fid of fids) {
      const user = await getUserByFid(fid);
      if (user) {
        users.push(user);
      }
    }
    
    return users;
  } catch (error) {
    //console.error('Error fetching users:', error);
    return [];
  }
}

// ==========================================
// LEADERBOARD FUNCTIONS (CLIENT-SIDE ONLY)
// ==========================================

/**
 * Fetch usernames from Neynar API for multiple FIDs via API route
 * WITH CACHING: Only fetches uncached FIDs, reduces API calls significantly
 */
async function fetchUsernamesFromNeynar(fids: number[]): Promise<Map<number, { username: string; displayName?: string; pfpUrl?: string }>> {
  const usernameMap = new Map<number, { username: string; displayName?: string; pfpUrl?: string }>();
  
  if (!fids || fids.length === 0) {
    return usernameMap;
  }
  
  const now = Date.now();
  
  // Step 1: Check cache and separate cached vs uncached FIDs
  const uncached: number[] = [];
  const cached: number[] = [];
  
  for (const fid of fids) {
    const cachedData = usernameCache.get(fid);
    if (cachedData && (now - cachedData.cachedAt) < CACHE_TTL) {
      // Cache hit - use cached data
      cached.push(fid);
      usernameMap.set(fid, {
        username: cachedData.username,
        displayName: cachedData.displayName,
        pfpUrl: cachedData.pfpUrl
      });
    } else {
      // Cache miss or expired - need to fetch
      uncached.push(fid);
      // Remove expired entry
      if (cachedData) {
        usernameCache.delete(fid);
      }
    }
  }
  
  // Step 2: Only fetch uncached FIDs (reduces API calls significantly!)
  if (uncached.length === 0) {
    // All cached! Return immediately
    return usernameMap;
  }
  
  try {
    // Batch fetch users from Neynar API via API route (max 100 at a time)
    const batchSize = 100;
    for (let i = 0; i < uncached.length; i += batchSize) {
      const batch = uncached.slice(i, i + batchSize);
      const fidsParam = batch.join(',');
      
      try {
        const response = await fetch(`/api/users?fids=${fidsParam}`);
        if (response.ok) {
          const data = await response.json();
          if (data.users && Array.isArray(data.users)) {
            data.users.forEach((user: any) => {
              if (user && user.fid) {
                const userData = {
                  username: user.username || `user${user.fid}`,
                  displayName: user.display_name,
                  pfpUrl: user.pfp_url
                };
                
                // Store in cache
                usernameCache.set(user.fid, {
                  ...userData,
                  cachedAt: now
                });
                
                // Add to result map
                usernameMap.set(user.fid, userData);
              }
            });
          }
        } else {
          // Log error but continue with fallback usernames
          const errorText = await response.text().catch(() => 'Unknown error');
          //console.warn(`Failed to fetch usernames for batch (${response.status}):`, errorText);
          
          // Use fallback for failed batch
          batch.forEach(fid => {
            if (!usernameMap.has(fid)) {
              usernameMap.set(fid, { username: `user${fid}` });
            }
          });
        }
      } catch (error) {
        // If API fetch fails, use fallback - don't throw, just log
        //console.warn(`Error fetching usernames for batch:`, error);
        
        // Use fallback for failed batch
        batch.forEach(fid => {
          if (!usernameMap.has(fid)) {
            usernameMap.set(fid, { username: `user${fid}` });
          }
        });
      }
    }
  } catch (error) {
    //console.error('Error in fetchUsernamesFromNeynar:', error);
  }
  
  // Step 3: Ensure all requested FIDs are in the map (with fallback if needed)
  for (const fid of fids) {
    if (!usernameMap.has(fid)) {
      usernameMap.set(fid, { username: `user${fid}` });
    }
  }
  
  return usernameMap;
}

/**
 * Get leaderboard - top users by Flow Points
 * Always fetches usernames from Farcaster/Neynar API
 */
export async function getLeaderboard(limitCount: number = 100): Promise<LeaderboardEntry[]> {
  if (!isClient()) {
    throw new Error('getLeaderboard can only be called from the browser');
  }

  // Wait for authentication
  await authReady;
  
  try {
    //console.log(`📖 Fetching leaderboard (top ${limitCount}) from ${environment}...`);
    
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    
    if (!snapshot.exists()) {
      //console.log('⚠️ No users found in database');
      return [];
    }
    
    const usersData = snapshot.val();
    
    // Convert to array and extract flow points
    const usersWithPoints: Array<{
      fid: number;
      flowPoints: number;
    }> = [];
    
    Object.keys(usersData).forEach((fid) => {
      const data = usersData[fid];
      const flowPoints = data.points?.total || 0;
      
      usersWithPoints.push({
        fid: Number(fid),
        flowPoints
      });
    });
    
    // Sort by flow points descending
    usersWithPoints.sort((a, b) => b.flowPoints - a.flowPoints);
    
    // Take top N
    const topUsers = usersWithPoints.slice(0, limitCount);
    
    // Always fetch usernames from Farcaster/Neynar
    const fids = topUsers.map(u => u.fid);
    const usernameMap = await fetchUsernamesFromNeynar(fids);
    
    // Create leaderboard with ranks
    const leaderboard: LeaderboardEntry[] = topUsers.map((user, index) => {
      // Get username and pfpUrl from Neynar, fallback to user{fid}
      const neynarData = usernameMap.get(user.fid);
      const username = neynarData?.username || `user${user.fid}`;
      const pfpUrl = neynarData?.pfpUrl;
      
      return {
        rank: index + 1,
        fid: user.fid,
        username,
        avatar: pfpUrl || '🌀',
        points: user.flowPoints
      };
    });
    
    //console.log(`✅ Leaderboard loaded: ${leaderboard.length} users`);
    //if (leaderboard.length > 0) {
    //  console.log(`   🥇 Top: ${leaderboard[0].username} with ${leaderboard[0].points} FP`);
    //}
    
    return leaderboard;
  } catch (error) {
    //console.error('❌ Error fetching leaderboard:', error);
    return [];
  }
}

/**
 * Get user's rank in the global leaderboard
 */
export async function getUserRank(fid: number): Promise<{
  rank: number;
  total: number;
  percentile: number;
}> {
  if (!isClient()) {
    throw new Error('getUserRank can only be called from the browser');
  }

  // Wait for authentication
  await authReady;
  
  try {
    //console.log(`📊 Calculating rank for user ${fid}...`);
    
    const user = await getUserByFid(fid);
    if (!user) {
      //console.log(`⚠️ User ${fid} not found, cannot calculate rank`);
      return { rank: 0, total: 0, percentile: 0 };
    }
    
    const targetPoints = user.flowPoints;
    
    // Get all users
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    
    if (!snapshot.exists()) {
      return { rank: 0, total: 0, percentile: 0 };
    }
    
    const usersData = snapshot.val();
    
    // Count users with more points
    let rank = 1;
    let total = 0;
    
    Object.keys(usersData).forEach((uid) => {
      const data = usersData[uid];
      const userPoints = data.points?.total || 0;
      
      total++;
      if (userPoints > targetPoints) {
        rank++;
      }
    });
    
    const percentile = total > 0 ? ((rank / total) * 100) : 0;
    
    //console.log(`✅ User ${fid} rank: #${rank} out of ${total} (Top ${percentile.toFixed(1)}%)`);
    
    return {
      rank,
      total,
      percentile: parseFloat(percentile.toFixed(1))
    };
  } catch (error) {
    //console.error(`❌ Error calculating rank for user ${fid}:`, error);
    return { rank: 0, total: 0, percentile: 0 };
  }
}

// ==========================================
// REAL-TIME SUBSCRIPTIONS (CLIENT-SIDE ONLY)
// ==========================================

/**
 * Enrich leaderboard entries with real usernames from Neynar
 */
export async function enrichLeaderboardWithUsernames(
  leaderboard: LeaderboardEntry[]
): Promise<LeaderboardEntry[]> {
  if (!isClient()) {
    throw new Error('enrichLeaderboardWithUsernames can only be called from the browser');
  }

  try {
    const fids = leaderboard.map(entry => entry.fid);
    const usernameMap = await fetchUsernamesFromNeynar(fids);
    
    return leaderboard.map(entry => {
      const neynarData = usernameMap.get(entry.fid);
      if (neynarData) {
        return {
          ...entry,
          username: neynarData.username || entry.username,
          avatar: neynarData.pfpUrl || entry.avatar
        };
      }
      return entry;
    });
  } catch (error) {
    //console.error('Error enriching leaderboard with usernames:', error);
    return leaderboard;
  }
}

/**
 * Subscribe to real-time leaderboard updates
 * Note: Real-time updates use fallback usernames initially, then enrich with Neynar data.
 * Use enrichLeaderboardWithUsernames() to fetch real usernames when needed.
 */
export function subscribeToLeaderboard(
  limitCount: number,
  callback: (leaderboard: LeaderboardEntry[]) => void
): () => void {
  if (!isClient()) {
    //console.warn('subscribeToLeaderboard can only be called from the browser');
    return () => {};
  }

  //console.log(`📡 Subscribing to leaderboard updates (${environment})...`);
  
  let unsubscribe: (() => void) | null = null;
  
  authReady.then(() => {
    const usersRef = ref(db, 'users');
    
    unsubscribe = onValue(usersRef, async (snapshot) => {
      if (!snapshot.exists()) {
        callback([]);
        return;
      }
      
      const usersData = snapshot.val();
      
      const usersWithPoints: Array<{
        fid: number;
        flowPoints: number;
      }> = [];
      
      Object.keys(usersData).forEach((fid) => {
        const data = usersData[fid];
        const flowPoints = data.points?.total || 0;
        
        usersWithPoints.push({
          fid: Number(fid),
          flowPoints
        });
      });
      
      // Sort by flow points
      usersWithPoints.sort((a, b) => b.flowPoints - a.flowPoints);
      
      // Create initial leaderboard with fallback usernames
      const initialLeaderboard: LeaderboardEntry[] = usersWithPoints
        .slice(0, limitCount)
        .map((user, index) => ({
          rank: index + 1,
          fid: user.fid,
          username: `user${user.fid}`, // Temporary fallback
          avatar: '🌀',
          points: user.flowPoints
        }));
      
      // Immediately enrich with real usernames from Neynar
      const fids = initialLeaderboard.map(e => e.fid);
      const usernameMap = await fetchUsernamesFromNeynar(fids);
      
      const enrichedLeaderboard = initialLeaderboard.map(entry => {
        const neynarData = usernameMap.get(entry.fid);
        return {
          ...entry,
          username: neynarData?.username || entry.username,
          avatar: neynarData?.pfpUrl || entry.avatar
        };
      });
      
      //console.log(`🔄 Leaderboard updated: ${enrichedLeaderboard.length} users`);
      callback(enrichedLeaderboard);
    }, (error) => {
      //console.error('❌ Leaderboard subscription error:', error);
    });
  });
  
  // Return cleanup function
  return () => {
    if (unsubscribe) {
      unsubscribe();
    }
    //console.log('📡 Unsubscribing from leaderboard');
  };
}

/**
 * Subscribe to real-time user data
 * Always fetches username from Farcaster/Neynar
 */
export function subscribeToUser(
  fid: number,
  callback: (user: UserFlowData | null) => void
): () => void {
  if (!isClient()) {
    //console.warn('subscribeToUser can only be called from the browser');
    return () => {};
  }

  //console.log(`📡 Subscribing to user ${fid} updates (${environment})...`);
  
  let unsubscribe: (() => void) | null = null;
  
  authReady.then(() => {
    const userRef = ref(db, `users/${fid}`);
    
    unsubscribe = onValue(userRef, async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const flowPoints = data.points?.total || 0;
        
        // Fetch username from Farcaster/Neynar
        let username = `user${fid}`; // Fallback
        let displayName: string | undefined;
        let pfpUrl: string | undefined;
        
        try {
          const response = await fetch(`/api/users?fids=${fid}`);
          if (response.ok) {
            const neynarData = await response.json();
            if (neynarData.users && neynarData.users[0]) {
              const neynarUser = neynarData.users[0];
              username = neynarUser.username || username;
              displayName = neynarUser.display_name;
              pfpUrl = neynarUser.pfp_url;
            }
          }
        } catch (error) {
          //console.warn(`Failed to fetch Neynar user for FID ${fid}:`, error);
        }
        
        callback({
          fid,
          username,
          displayName,
          pfpUrl,
          coins: data.coins || 0,
          flowPoints,
          gamesPlayed: data.gamesPlayed || 0,
          timeSpent: data.timeSpent || '0h 0m',
          streak: data.streak || 0,
          lastUpdated: data.lastUpdated,
          dailyReward: data.dailyReward,
          points: data.points,
          spin: data.spin
        });
        
        //console.log(`🔄 User ${fid} data updated: ${flowPoints} FP`);
      } else {
        //console.log(`⚠️ User ${fid} no longer exists`);
        callback(null);
      }
    }, (error) => {
      //console.error(`❌ User ${fid} subscription error:`, error);
    });
  });
  
  // Return cleanup function
  return () => {
    if (unsubscribe) {
      unsubscribe();
    }
    //console.log(`📡 Unsubscribing from user ${fid}`);
  };
}
