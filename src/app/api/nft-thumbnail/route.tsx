import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const nftImageUrl = searchParams.get('image');
    const tokenId = searchParams.get('tokenId') || '0';
    const day = searchParams.get('day') || '1';

    if (!nftImageUrl || nftImageUrl.trim() === '') {
      console.error('❌ Missing NFT image URL');
      return generateFallbackImage('Missing NFT image URL', day);
    }

    let decodedImageUrl = decodeURIComponent(nftImageUrl);
    
    console.log(`🖼️ Generating thumbnail - Day ${day}, Token ID: ${tokenId}`);
    console.log(`📸 Original image URL: ${nftImageUrl}`);
    console.log(`📸 Decoded image URL: ${decodedImageUrl}`);
    
    // ✅ FIX: Handle relative URLs
    if (decodedImageUrl.startsWith('/api/ipfs')) {
      // Get the origin from the request
      const origin = new URL(request.url).origin;
      decodedImageUrl = `${origin}${decodedImageUrl}`;
      console.log(`🔄 Converted relative URL to absolute: ${decodedImageUrl}`);
    }
    
    // Convert IPFS URLs
    if (decodedImageUrl.startsWith('ipfs://')) {
      decodedImageUrl = decodedImageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
      console.log(`🔄 Converted ipfs:// to HTTP: ${decodedImageUrl}`);
    }
    
    // Validate URL format
    try {
      new URL(decodedImageUrl);
    } catch (urlError) {
      console.error(`❌ Invalid URL format: ${decodedImageUrl}`);
      return generateFallbackImage(`Invalid image URL`, day);
    }
    
    // ✅ Try to use image URL directly first (ImageResponse supports external URLs in Edge Runtime)
    // If that fails, we'll fetch and convert to base64
    let imageSrc: string = decodedImageUrl;
    let useDirectUrl = true;
    
    // Verify the URL is accessible by doing a quick HEAD request
    try {
      console.log(`📥 Verifying image URL: ${decodedImageUrl}`);
      
      const headResponse = await fetch(decodedImageUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NFT-Thumbnail-Generator)',
          'Accept': 'image/*',
        },
        signal: AbortSignal.timeout(5000), // Quick check
      });
      
      if (!headResponse.ok) {
        console.warn(`⚠️ HEAD request failed (${headResponse.status}), will try fetching full image`);
        useDirectUrl = false;
      } else {
        console.log(`✅ Image URL is accessible, using direct URL`);
      }
    } catch (verifyError: any) {
      console.warn(`⚠️ URL verification failed: ${verifyError.message}, will try fetching full image`);
      useDirectUrl = false;
    }
    
    // If direct URL doesn't work, fetch and convert to base64
    if (!useDirectUrl) {
      try {
        console.log(`📥 Fetching NFT image for base64 conversion: ${decodedImageUrl}`);
        
        const imageResponse = await fetch(decodedImageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; NFT-Thumbnail-Generator)',
            'Accept': 'image/*',
          },
          signal: AbortSignal.timeout(15000), // 15 second timeout for IPFS
        });
        
        if (imageResponse.ok) {
          const arrayBuffer = await imageResponse.arrayBuffer();
          const contentType = imageResponse.headers.get('content-type') || 'image/png';
          
          // Convert to base64 using Buffer (works in Edge Runtime)
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          imageSrc = `data:${contentType};base64,${base64}`;
          
          console.log(`✅ Successfully fetched and converted image (${arrayBuffer.byteLength} bytes, ${contentType})`);
        } else {
          const errorText = await imageResponse.text().catch(() => 'Unknown error');
          console.error(`❌ Image fetch failed: ${imageResponse.status} ${imageResponse.statusText}`);
          console.error(`❌ Error response: ${errorText.substring(0, 200)}`);
          return generateFallbackImage(`Image fetch failed (${imageResponse.status})`, day);
        }
      } catch (fetchError: any) {
        console.error('❌ Error fetching image:', fetchError);
        console.error('❌ Error name:', fetchError?.name);
        console.error('❌ Error message:', fetchError?.message);
        return generateFallbackImage(`Failed to load image: ${fetchError?.message || 'Unknown error'}`, day);
      }
    }

    // Generate thumbnail
    const ogImage = new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000000',
            position: 'relative',
          }}
        >
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={`Day ${day}`}
              width="1200"
              height="630"
              style={{
                objectFit: 'contain',
                maxWidth: '100%',
                maxHeight: '100%',
              }}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>🎨</div>
              <div style={{ fontSize: '32px' }}>Flow State NFT</div>
              <div style={{ fontSize: '24px', marginTop: '10px', opacity: 0.7 }}>
                Day {day}
              </div>
            </div>
          )}
          
          {/* Day badge */}
          <div
            style={{
              position: 'absolute',
              top: '30px',
              right: '30px',
              backgroundColor: 'rgba(147, 51, 234, 0.95)',
              color: 'white',
              padding: '16px 32px',
              borderRadius: '16px',
              fontSize: '28px',
              fontWeight: 'bold',
              display: 'flex',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
            }}
          >
            Day {day}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );

    return new Response(ogImage.body, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
    
  } catch (error) {
    console.error('❌ Thumbnail generation error:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    return generateFallbackImage('Error generating thumbnail', '?');
  }
}

function generateFallbackImage(message: string, day: string): Response {
  console.log(`⚠️ Generating fallback image: ${message}`);
  
  const imageResponse = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a1a1a',
          backgroundImage: 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)',
        }}
      >
        <div
          style={{
            fontSize: '80px',
            marginBottom: '30px',
          }}
        >
          🧘
        </div>
        <div
          style={{
            fontSize: '56px',
            fontWeight: 'bold',
            color: '#ffffff',
            marginBottom: '20px',
          }}
        >
          Flow State NFT
        </div>
        <div
          style={{
            fontSize: '32px',
            color: '#a855f7',
            marginBottom: '40px',
          }}
        >
          Day {day}
        </div>
        <div
          style={{
            fontSize: '20px',
            color: '#9ca3af',
            textAlign: 'center',
            maxWidth: '700px',
            padding: '0 40px',
          }}
        >
          {message}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );

  return new Response(imageResponse.body, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=60, s-maxage=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
