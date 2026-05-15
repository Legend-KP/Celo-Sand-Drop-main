import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

/**
 * Firebase Admin SDK for server-side operations
 * Used for OG image generation and other server-side Firebase access
 * 
 * Requires environment variables:
 * - FIREBASE_PROJECT_ID
 * - FIREBASE_PRIVATE_KEY (from service account JSON)
 * - FIREBASE_CLIENT_EMAIL (from service account JSON)
 * - NEXT_PUBLIC_FIREBASE_DATABASE_URL
 */

let _adminDbInstance: ReturnType<typeof getDatabase> | null = null;

function initializeAdminApp() {
  // Check if already initialized
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;

  if (!projectId || !privateKey || !clientEmail || !databaseURL) {
    //console.warn('⚠️ Firebase Admin: Missing credentials. Using REST API fallback.');
    return null;
  }

  try {
    const app = initializeApp({
      credential: cert({
        projectId,
        privateKey,
        clientEmail,
      }),
      databaseURL,
    }, 'admin');

    //console.log('✅ Firebase Admin initialized');
    return app;
  } catch (error) {
    //console.error('❌ Firebase Admin initialization failed:', error);
    return null;
  }
}

/**
 * Get Firebase Admin Database instance
 * Returns null if credentials are not configured (falls back to REST API)
 */
export function getAdminDb() {
  if (_adminDbInstance) {
    return _adminDbInstance;
  }

  const app = initializeAdminApp();
  if (!app) {
    return null;
  }

  _adminDbInstance = getDatabase(app);
  return _adminDbInstance;
}

/**
 * Admin Database reference (lazy-loaded)
 * Use this in API routes that need authenticated Firebase access
 * Returns null if credentials are not configured
 * 
 * Usage:
 *   const db = adminDb;
 *   if (db) {
 *     const snapshot = await db.ref('users/123').once('value');
 *   }
 */
export const adminDb: ReturnType<typeof getDatabase> | null = (() => {
  // Lazy initialization - only called when accessed
  return getAdminDb();
})();

