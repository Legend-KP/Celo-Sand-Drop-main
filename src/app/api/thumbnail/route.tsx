  import { ImageResponse } from 'next/og';
  import { NextRequest } from 'next/server';
  import { getNeynarUser } from '~/lib/neynar';
  import { APP_NAME } from '~/lib/constants';

  export const dynamic = 'force-dynamic';
  export const runtime = 'nodejs';

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
      const fidParam = searchParams.get('fid');

      if (!fidParam) {
        //console.error('Thumbnail: Missing FID');
        return generateFallbackImage('Missing FID parameter');
      }

      const fid = parseInt(fidParam);
      if (isNaN(fid)) {
        return generateFallbackImage('Invalid FID');
      }

      // Get flowPoints from URL parameter (from client-side data)
      const fpParam = searchParams.get('fp');
      const urlFlowPoints = fpParam ? parseInt(fpParam) : null;

      console.log(`📸 [Thumbnail] Generating for FID ${fid}, URL says fp=${urlFlowPoints}`);

      // ==========================================
      // PRIORITY: Use flowPoints from URL (client-side data)
      // Fallback: Fetch from Firebase if URL doesn't have fp parameter
      // ==========================================
      
      let flowPoints = 0;
      let username = `user${fid}`;
      let displayName: string | undefined;
      let pfpUrl: string | undefined;
      
      // Step 1: Use flowPoints from URL if available (most reliable - from client)
      // Use URL parameter even if 0 (it's the actual value from client)
      if (urlFlowPoints !== null) {
        flowPoints = urlFlowPoints;
        console.log(`✅ [Thumbnail] Using flowPoints from URL: ${flowPoints} FP`);
      } else {
        // Step 2: Fallback to Firebase REST API
        console.log(`⚠️ [Thumbnail] No fp in URL, fetching from Firebase...`);
        
        const databaseUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
        
        if (databaseUrl) {
          try {
            const userUrl = `${databaseUrl}/users/${fid}.json`;
            const response = await fetch(userUrl, {
              headers: { 'Accept': 'application/json' },
              cache: 'no-store',
            });
            
            if (response.ok) {
              const userData = await response.json();
              
              if (userData && userData !== null) {
                // Extract flow points
                if (userData.points?.total !== undefined) {
                  flowPoints = Number(userData.points.total) || 0;
                } else if (userData.flowPoints !== undefined) {
                  flowPoints = Number(userData.flowPoints) || 0;
                } else if (typeof userData.points === 'number') {
                  flowPoints = Number(userData.points) || 0;
                }
                
                username = userData.username || `user${fid}`;
                displayName = userData.displayName;
                pfpUrl = userData.pfpUrl;
                
                console.log(`✅ [Thumbnail] Firebase: ${flowPoints} FP`);
              } else {
                console.warn(`⚠️ [Thumbnail] Firebase returned null for FID ${fid}`);
              }
            } else {
              console.warn(`⚠️ [Thumbnail] Firebase request failed: ${response.status}`);
            }
          } catch (error) {
            console.error(`❌ [Thumbnail] Firebase error:`, error);
          }
        }
      }
      
      // ==========================================
      // Fetch User Profile from Neynar (if not from Firebase)
      // ==========================================
      
      if (!displayName || !pfpUrl || username === `user${fid}`) {
        try {
          const neynarUser = await getNeynarUser(fid);
          if (neynarUser) {
            username = neynarUser.username || username;
            displayName = neynarUser.display_name || displayName;
            pfpUrl = neynarUser.pfp_url || pfpUrl;
          }
        } catch (error) {
          console.warn(`⚠️ Neynar fetch failed for ${fid}:`, error);
        }
      }

      // ==========================================
      // Calculate Rank (if user has points)
      // ==========================================
      
      let rank = 0;
      let percentile = 0;
      let total = 0;

      if (flowPoints > 0) {
        try {
          // Calculate rank using REST API only (no Admin SDK needed)
          let allUsers = null;
          const databaseUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
          if (databaseUrl) {
            const usersUrl = `${databaseUrl}/users.json`;
            const response = await fetch(usersUrl, {
              headers: { 'Accept': 'application/json' },
              cache: 'no-store',
            });
            
            if (response.ok) {
              allUsers = await response.json();
            }
          }
          
          if (allUsers) {
            rank = 1;
            total = 0;
            
            Object.keys(allUsers).forEach((uid) => {
              const userPoints = allUsers[uid].points?.total || 0;
              total++;
              if (userPoints > flowPoints) {
                rank++;
              }
            });
            
            percentile = total > 0 ? parseFloat(((rank / total) * 100).toFixed(1)) : 0;
            //console.log(`✅ Rank: #${rank} out of ${total} (Top ${percentile}%)`);
          } else {
            //console.warn(`⚠️ Could not fetch all users for ranking`);
          }
        } catch (error) {
          //console.error(`❌ Rank calculation error:`, error);
        }
      }

      // ==========================================
      // Generate Thumbnail
      // ==========================================

      // ✅ DEBUG: Verify flowPoints value before generating thumbnail
      //console.log(`🔍 [Thumbnail] DEBUG: flowPoints value = ${flowPoints}, type = ${typeof flowPoints}`);
      //console.log(`🔍 [Thumbnail] DEBUG: username = ${username}, displayName = ${displayName || 'undefined'}`);
      //console.log(`🎨 [Thumbnail] Generating image with: ${flowPoints} FP, Rank #${rank}`);
      //console.log(`📊 [Thumbnail] Final userData:`, JSON.stringify({
      //  hasUserData: !!userData,
      //  hasPoints: !!userData?.points,
      //  pointsTotal: userData?.points?.total
      //}));

      const imageResponse = new ImageResponse(
        (
          <div
            style={{
              height: '100%',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #dbeafe 0%, #e9d5ff 50%, #fce7f3 100%)',
              fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              padding: '80px 60px',
            }}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, #9333ea 0%, #a855f7 50%, #ec4899 100%)',
                borderRadius: '48px',
                padding: '60px 80px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                width: '900px',
              }}
            >
              {/* Profile Picture */}
              <div style={{ display: 'flex', marginBottom: '32px' }}>
                {pfpUrl ? (
                  <img
                    src={pfpUrl}
                    alt={displayName || username}
                    style={{
                      width: '120px',
                      height: '120px',
                      borderRadius: '50%',
                      border: '6px solid rgba(255, 255, 255, 0.3)',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '120px',
                      height: '120px',
                      borderRadius: '50%',
                      background: 'rgba(255, 255, 255, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '64px',
                      border: '6px solid rgba(255, 255, 255, 0.3)',
                    }}
                  >
                    🌀
                  </div>
                )}
              </div>

              {/* Username */}
              <div
                style={{
                  fontSize: '40px',
                  fontWeight: 'bold',
                  color: 'white',
                  marginBottom: '48px',
                  textAlign: 'center',
                  display: 'flex',
                }}
              >
                {`${displayName || username}'s Flow Points`}
              </div>

              {/* Flow Points - ALWAYS render (cache is authoritative, so 0 is real) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px',
                  marginBottom: '48px',
                }}
              >
                <span style={{ fontSize: '32px' }}>✨</span>
                <span
                  style={{
                    fontSize: '96px',
                    fontWeight: 'bold',
                    color: 'white',
                    lineHeight: 1,
                  }}
                >
                  {flowPoints.toLocaleString()}
                </span>
              </div>

              {/* Rank Badge - Only if has rank data */}
              {flowPoints > 0 && rank > 0 && total > 0 && (
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '24px',
                    padding: '20px 48px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '20px',
                      color: 'rgba(255, 255, 255, 0.9)',
                    }}
                  >
                    Top {percentile}%
                  </div>
                  <div
                    style={{
                      fontSize: '32px',
                      fontWeight: 'bold',
                      color: 'white',
                    }}
                  >
                    Rank #{rank}
                  </div>
                </div>
              )}
            </div>

            {/* App Name */}
            <div
              style={{
                marginTop: '48px',
                fontSize: '24px',
                color: '#6b7280',
                fontWeight: '600',
              }}
            >
              {APP_NAME}
            </div>
          </div>
        ),
        {
          width: 1200,
          height: 800,
        }
      );

      // Immutable caching - Each point value gets its own permanent thumbnail
      // Since URL includes ?fp= parameter, each point value has unique URL
      // Cache permanently - thumbnails never auto-update
      imageResponse.headers.set(
        'Cache-Control',
        'public, max-age=31536000, immutable'
      );
      imageResponse.headers.set('Content-Type', 'image/png');
      imageResponse.headers.set('Access-Control-Allow-Origin', '*');

      //console.log(`✅ Thumbnail complete: ${displayName || username} - ${flowPoints} FP`);

      return imageResponse;
    } catch (error) {
      //console.error('❌ Thumbnail error:', error);
      return generateFallbackImage('Error generating image');
    }
  }

  function generateFallbackImage(message: string): Response {
    const imageResponse = new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #dbeafe 0%, #e9d5ff 50%, #fce7f3 100%)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #9333ea 0%, #a855f7 50%, #ec4899 100%)',
              borderRadius: '48px',
              padding: '60px 80px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '24px',
            }}
          >
            <div style={{ fontSize: '80px' }}>🌀</div>
            <div style={{ fontSize: '40px', fontWeight: 'bold', color: 'white' }}>
              {APP_NAME}
            </div>
            <div style={{ fontSize: '24px', color: 'rgba(255, 255, 255, 0.8)' }}>
              {message}
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
      }
    );

    imageResponse.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300');
    imageResponse.headers.set('Content-Type', 'image/png');
    imageResponse.headers.set('Access-Control-Allow-Origin', '*');

    return imageResponse;
  }
