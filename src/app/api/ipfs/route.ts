import { NextRequest } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Multiple IPFS gateways with fallback
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://dweb.link/ipfs/',
  'https://scarlet-voluntary-angelfish-357.mypinata.cloud/ipfs/', // Your Pinata (works after reset)
];

async function fetchFromIPFS(cid: string): Promise<Response> {
  const errors: string[] = [];
  
  for (const gateway of IPFS_GATEWAYS) {
    const url = `${gateway}${cid}`;
    
    try {
      console.log(`📥 Trying: ${gateway}`);
      
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
      
      if (response.ok) {
        console.log(`✅ Success from: ${gateway}`);
        return response;
      }
      
      errors.push(`${gateway}: HTTP ${response.status}`);
      
    } catch (error: any) {
      errors.push(`${gateway}: ${error.message}`);
      // Continue to next gateway
    }
  }
  
  throw new Error(`All gateways failed: ${errors.join(', ')}`);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cid = searchParams.get('cid');
    
    if (!cid) {
      return new Response('Missing CID parameter', { 
        status: 400,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    console.log(`🔍 Fetching CID: ${cid}`);
    
    // Try gateways with fallback
    const response = await fetchFromIPFS(cid);
    
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const data = await response.arrayBuffer();
    
    console.log(`✅ Fetched ${data.byteLength} bytes (${contentType})`);
    
    // Cache forever on Vercel Edge
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
        'CDN-Cache-Control': 'max-age=31536000',
        'Vercel-CDN-Cache-Control': 'max-age=31536000',
        'Access-Control-Allow-Origin': '*',
        'X-IPFS-Gateway': response.url, // Show which gateway was used
      },
    });
    
  } catch (error: any) {
    console.error('❌ Error:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch from IPFS',
        message: error.message,
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
