import { NextRequest, NextResponse } from 'next/server';
import { getNeynarUser } from '~/lib/neynar';

export const dynamic = 'force-dynamic';
export const revalidate = 60; // Cache for 60 seconds

/**
 * Server-side API route to fetch user data from Firebase
 * This route can be called from server components and API routes
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fid: string }> }
) {
  try {
    const resolvedParams = await params;
    const fidParam = resolvedParams?.fid;
    
    if (!fidParam) {
      return NextResponse.json({ error: 'FID parameter is required' }, { status: 400 });
    }
    
    const fid = Number(fidParam);

    if (!Number.isFinite(fid)) {
      return NextResponse.json({ error: 'Invalid FID' }, { status: 400 });
    }

    const databaseUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
    if (!databaseUrl) {
      return NextResponse.json(
        { error: 'Firebase database URL not configured' },
        { status: 500 }
      );
    }

    // Fetch user data from Firebase Realtime Database REST API
    // Using users/FID format as per firebase.ts structure (lowercase 'users')
    const userUrl = `${databaseUrl}/users/${fid}.json`;
    const response = await fetch(userUrl, {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const data = await response.json();
    
    // Firebase returns null if user doesn't exist (even with 200 status)
    if (data === null) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const flowPoints = data.points?.total ?? 0;

    // Fetch user profile from Neynar
    let username = `user${fid}`;
    let displayName: string | undefined;
    let pfpUrl: string | undefined;

    try {
      const neynarUser = await getNeynarUser(fid);
      if (neynarUser) {
        username = neynarUser.username ?? username;
        displayName = neynarUser.display_name;
        pfpUrl = neynarUser.pfp_url;
      }
    } catch (error) {
      //console.warn(`Failed to fetch Neynar user for FID ${fid}:`, error);
    }

    return NextResponse.json({
      fid,
      username,
      displayName,
      pfpUrl,
      flowPoints,
    });
  } catch (error) {
    //console.error('Error fetching user data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

