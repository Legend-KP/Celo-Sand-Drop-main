import { NextRequest, NextResponse } from 'next/server';
import { getUserByFid, getUserRank } from '~/lib/firebase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fid: string }> }
) {
  try {
    const { fid: fidParam } = await params;
    const fid = parseInt(fidParam);
    
    if (isNaN(fid)) {
      return NextResponse.json({ error: 'Invalid FID' }, { status: 400 });
    }

    const user = await getUserByFid(fid);
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const rankData = await getUserRank(fid);

    return NextResponse.json({
      ...user,
      ...rankData
    });
  } catch (error) {
    //console.error('Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

