import { NextResponse } from 'next/server';

/**
 * This endpoint is disabled.
 * 
 * Firebase data is now fetched directly from the browser (client-side)
 * where anonymous authentication works properly.
 * 
 * Use the Firebase client SDK from the browser instead:
 * ```typescript
 * import { getLeaderboard } from '~/lib/firebase';
 * const leaderboard = await getLeaderboard(100);
 * ```
 */
export async function GET() {
  return NextResponse.json({
    error: 'This endpoint is disabled',
    message: 'Data is fetched client-side using the Firebase client SDK.',
    reason: 'Anonymous authentication only works in the browser, not on the server.',
    solution: 'Use getLeaderboard() directly from your client-side components.'
  }, { status: 410 }); // 410 Gone
}


