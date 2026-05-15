import { NextRequest, NextResponse } from 'next/server';
import { setCachedUserData, getCachedUserData } from '~/lib/user-cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Pre-fetch and cache user data when share button is clicked
 * This ensures the thumbnail has the latest data available
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fid, flowPoints, username, displayName, pfpUrl, points } = body;

    //console.log(`📥 [Prepare-Share] Received request for FID: ${fid}`);
    //console.log(`📊 [Prepare-Share] Incoming data:`, {
    //  fid,
    //  flowPoints,
    //  username,
    //  displayName,
    //  hasPfpUrl: !!pfpUrl,
    //  hasPoints: !!points,
    //});

    if (!fid || typeof fid !== 'number') {
      //console.error(`❌ [Prepare-Share] Invalid FID: ${fid}`);
      return NextResponse.json(
        { error: 'FID is required and must be a number' },
        { status: 400 }
      );
    }

    // Use the data passed from the client (already loaded from Firebase subscription)
    // This ensures we use the exact same data visible in the console/UI
    const userFlowPoints = flowPoints ?? 0;
    const userUsername = username ?? `user${fid}`;
    const userDisplayName = displayName;
    const userPfpUrl = pfpUrl;
    const userPoints = points ?? { total: userFlowPoints };

    if (userFlowPoints === 0) {
      //console.warn(`⚠️ [Prepare-Share] Warning: Caching 0 points for FID ${fid}`);
    }

    //console.log(`📦 [Prepare-Share] Caching data (FID: ${fid}, Points: ${userFlowPoints})...`);
    
    // Cache the user data for thumbnail generation
    await setCachedUserData(fid, {
      fid,
      flowPoints: userFlowPoints,
      points: userPoints,
      username: userUsername,
      displayName: userDisplayName,
      pfpUrl: userPfpUrl,
    });

    // CRITICAL: Verify cache was set by reading it back immediately
    const verifyCache = await getCachedUserData(fid);
    if (verifyCache) {
      //console.log(`✅ [Prepare-Share] Cache verified! Stored: ${verifyCache.flowPoints} FP`);
      
      if (verifyCache.flowPoints !== userFlowPoints) {
        //console.error(`❌ [Prepare-Share] Cache mismatch! Expected ${userFlowPoints}, got ${verifyCache.flowPoints}`);
      }
    } else {
      //console.error(`❌ [Prepare-Share] Cache verification FAILED! Data not found after setting.`);
      return NextResponse.json(
        { error: 'Cache verification failed', cached: false },
        { status: 500 }
      );
    }

    //console.log(`✅ [Prepare-Share] Successfully cached user data for FID ${fid}: ${userFlowPoints} FP`);

    return NextResponse.json({
      success: true,
      cached: true,
      fid,
      flowPoints: userFlowPoints,
      username: userUsername,
      displayName: userDisplayName,
      pfpUrl: userPfpUrl,
    });
  } catch (error) {
    //console.error('❌ [Prepare-Share] Error preparing share data:', error);
    return NextResponse.json(
      { error: 'Failed to prepare share data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

