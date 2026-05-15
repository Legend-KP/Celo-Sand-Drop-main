import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { 
  getDatabase, 
  ref, 
  get, 
  set, 
  update,
  onValue
} from "firebase/database";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCTC83lTvWOlbKCo-_w4w4qvcN-AkGoeEg",
  authDomain: "flow-points.firebaseapp.com",
  projectId: "flow-points",
  storageBucket: "flow-points.firebasestorage.app",
  messagingSenderId: "201593876194",
  appId: "1:201593876194:web:df44623ed0d31383d678bb",
  measurementId: "G-YTPPVEBYF0",
  databaseURL: "https://flow-points-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database
export const db = getDatabase(app);

// Initialize Analytics
let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

export { analytics };

// ==========================================
// TYPES
// ==========================================

export interface UserFlowData {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  coins: number;
  flowPoints: number;  // points.total
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
// USER FUNCTIONS
// ==========================================

/**
 * Get user data by FID from Realtime Database
 * Always fetches username, displayName, and pfpUrl from Farcaster/Neynar API
 */
export async function getUserByFid(fid: number): Promise<UserFlowData | null> {
  try {
    const userRef = ref(db, `users/${fid}`);
    const snapshot = await get(userRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      
      // Extract flow points from points.total
      const flowPoints = data.points?.total || 0;
      
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
          console.warn(`Failed to fetch Neynar user for FID ${fid}: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.warn(`Error fetching Neynar user for FID ${fid}:`, error);
      }
      
      return {
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
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

/**
 * Get multiple users by FIDs
 */
export async function getUsersByFids(fids: number[]): Promise<UserFlowData[]> {
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
    console.error('Error fetching users:', error);
    return [];
  }
}

// ==========================================
// LEADERBOARD FUNCTIONS
// ==========================================

/**
 * Fetch usernames from Neynar API for multiple FIDs via API route
 */
async function fetchUsernamesFromNeynar(fids: number[]): Promise<Map<number, { username: string; displayName?: string; pfpUrl?: string }>> {
  const usernameMap = new Map<number, { username: string; displayName?: string; pfpUrl?: string }>();
  
  if (!fids || fids.length === 0) {
    return usernameMap;
  }
  
  try {
    // Batch fetch users from Neynar API via API route (max 100 at a time)
    const batchSize = 100;
    for (let i = 0; i < fids.length; i += batchSize) {
      const batch = fids.slice(i, i + batchSize);
      const fidsParam = batch.join(',');
      
      try {
        const response = await fetch(`/api/users?fids=${fidsParam}`);
        if (response.ok) {
          const data = await response.json();
          if (data.users && Array.isArray(data.users)) {
            data.users.forEach((user: any) => {
              if (user && user.fid) {
                usernameMap.set(user.fid, {
                  username: user.username || `user${user.fid}`,
                  displayName: user.display_name,
                  pfpUrl: user.pfp_url
                });
              }
            });
          }
        } else {
          // Log error but continue with fallback usernames
          const errorText = await response.text().catch(() => 'Unknown error');
          console.warn(`Failed to fetch usernames for batch (${response.status}):`, errorText);
        }
      } catch (error) {
        // If API fetch fails, use fallback - don't throw, just log
        console.warn(`Error fetching usernames for batch:`, error);
      }
    }
  } catch (error) {
    console.error('Error in fetchUsernamesFromNeynar:', error);
  }
  
  return usernameMap;
}

/**
 * Get leaderboard - top users by Flow Points
 * Always fetches usernames from Farcaster/Neynar API
 */
export async function getLeaderboard(limitCount: number = 100): Promise<LeaderboardEntry[]> {
  try {
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    
    if (!snapshot.exists()) {
      console.log('No users found in database');
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
    
    return leaderboard;
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
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
  try {
    const user = await getUserByFid(fid);
    if (!user) {
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
    
    return {
      rank,
      total,
      percentile: parseFloat(percentile.toFixed(1))
    };
  } catch (error) {
    console.error('Error getting user rank:', error);
    return { rank: 0, total: 0, percentile: 0 };
  }
}

// ==========================================
// REAL-TIME SUBSCRIPTIONS
// ==========================================

/**
 * Enrich leaderboard entries with real usernames from Neynar
 */
export async function enrichLeaderboardWithUsernames(
  leaderboard: LeaderboardEntry[]
): Promise<LeaderboardEntry[]> {
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
    console.error('Error enriching leaderboard with usernames:', error);
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
  const usersRef = ref(db, 'users');
  
  const unsubscribe = onValue(usersRef, async (snapshot) => {
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
    
    callback(enrichedLeaderboard);
  }, (error) => {
    console.error('Leaderboard subscription error:', error);
  });
  
  return unsubscribe;
}

/**
 * Subscribe to real-time user data
 * Always fetches username from Farcaster/Neynar
 */
export function subscribeToUser(
  fid: number,
  callback: (user: UserFlowData | null) => void
): () => void {
  const userRef = ref(db, `users/${fid}`);
  
  const unsubscribe = onValue(userRef, async (snapshot) => {
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
        console.warn(`Failed to fetch Neynar user for FID ${fid}:`, error);
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
    } else {
      callback(null);
    }
  }, (error) => {
    console.error('User subscription error:', error);
  });
  
  return unsubscribe;
}

// ==========================================
// UPDATE FUNCTIONS
// ==========================================

/**
 * Update user's flow points
 */
export async function updateUserFlowPoints(
  fid: number,
  flowPoints: number
): Promise<void> {
  try {
    const userRef = ref(db, `users/${fid}`);
    
    // Get current user data to preserve existing points structure
    const snapshot = await get(userRef);
    const currentData = snapshot.exists() ? snapshot.val() : {};
    
    await update(userRef, {
      points: {
        ...(currentData.points || {}),
        total: flowPoints
      },
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating flow points:', error);
    throw error;
  }
}

/**
 * Increment user's flow points
 */
export async function incrementFlowPoints(
  fid: number,
  pointsToAdd: number
): Promise<void> {
  try {
    const user = await getUserByFid(fid);
    if (!user) {
      throw new Error('User not found');
    }
    
    const newPoints = user.flowPoints + pointsToAdd;
    await updateUserFlowPoints(fid, newPoints);
  } catch (error) {
    console.error('Error incrementing flow points:', error);
    throw error;
  }
}

/**
 * Create or update user
 */
export async function createOrUpdateUser(
  fid: number,
  userData: Partial<UserFlowData>
): Promise<void> {
  try {
    const userRef = ref(db, `users/${fid}`);
    
    await set(userRef, {
      ...userData,
      fid,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error creating/updating user:', error);
    throw error;
  }
}
