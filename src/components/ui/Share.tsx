'use client';

import { useCallback, useState, useEffect } from 'react';
import { Button } from './Button';
import { useMiniApp } from '@neynar/react';
import { type ComposeCast } from "@farcaster/miniapp-sdk";
import { APP_URL } from '~/lib/constants';
import { getUserByFid, type UserFlowData } from '~/lib/firebase';

interface EmbedConfig {
  path?: string;
  url?: string;
  imageUrl?: () => Promise<string>;
}

interface CastConfig extends Omit<ComposeCast.Options, 'embeds'> {
  bestFriends?: boolean;
  embeds?: (string | EmbedConfig)[];
}

interface ShareButtonProps {
  buttonText: string;
  cast: CastConfig;
  className?: string;
  isLoading?: boolean;
  userData?: UserFlowData | null;
}

export function ShareButton({ buttonText, cast, className = '', isLoading = false, userData }: ShareButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPreparingShare, setIsPreparingShare] = useState(false);
  const [bestFriends, setBestFriends] = useState<{ fid: number; username: string; }[] | null>(null);
  const [isLoadingBestFriends, setIsLoadingBestFriends] = useState(false);
  const { context, actions } = useMiniApp();

  // Fetch best friends if needed
  useEffect(() => {
    if (cast.bestFriends && context?.user?.fid) {
      setIsLoadingBestFriends(true);
      fetch(`/api/best-friends?fid=${context.user.fid}`)
        .then(res => res.json())
        .then(data => setBestFriends(data.bestFriends))
        .catch(err => {/* console.error('Failed to fetch best friends:', err) */})
        .finally(() => setIsLoadingBestFriends(false));
    }
  }, [cast.bestFriends, context?.user?.fid]);

  const handleShare = useCallback(async () => {
    // Show "Preparing..." state
    setIsPreparingShare(true);
      setIsProcessing(true);
    
    // Safety timeout to ensure spinner stops even if something goes wrong
    const timeoutId = setTimeout(() => {
      setIsPreparingShare(false);
      setIsProcessing(false);
    }, 10000); // 10 second max timeout

    try {
      // Pre-fetch and cache user data when share button is clicked
      // CRITICAL: Cache MUST be set BEFORE opening share dialog
      if (context?.user?.fid) {
        try {
          let dataToCache: UserFlowData | null = userData ?? null;
          
          // If userData is null or has 0 points, fetch fresh from Firebase
          if (!dataToCache || (dataToCache.flowPoints === 0 && dataToCache.points?.total === 0)) {
            try {
              const freshData = await getUserByFid(context.user.fid);
              if (freshData && freshData.flowPoints > 0) {
                dataToCache = freshData;
              }
            } catch (fetchError) {
              // Fetch failed, continue with existing data
            }
          }
          
          // Optional: Cache for prepare-share (backwards compatibility)
          // Thumbnail will fetch fresh from Firebase, so no pre-generation needed
          if (dataToCache && dataToCache.flowPoints > 0) {
            try {
              // Only cache for prepare-share (optional, can be removed)
              await fetch('/api/prepare-share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fid: context.user.fid,
                  flowPoints: dataToCache.flowPoints,
                  username: dataToCache.username,
                  displayName: dataToCache.displayName,
                  pfpUrl: dataToCache.pfpUrl,
                  points: dataToCache.points || { total: dataToCache.flowPoints },
                }),
              }).catch((error) => {
                // Cache is optional, don't fail if it errors
                console.warn('Prepare-share cache failed:', error);
              });
            } catch (error) {
              // Ignore cache errors
            }
          }
          
        } catch (error) {
          // Cache/pre-generation failed, but continue with share
          console.error('❌ [Share] Failed to prepare share:', error);
        }
      }
      
      // Hide "Preparing..." state
      setIsPreparingShare(false);

      let finalText = cast.text || '';

      // Process best friends if enabled and data is loaded
      if (cast.bestFriends) {
        if (bestFriends) {
          // Replace @N with usernames, or remove if no matching friend
          finalText = finalText.replace(/@\d+/g, (match) => {
            const friendIndex = parseInt(match.slice(1)) - 1;
            const friend = bestFriends[friendIndex];
            if (friend) {
              return `@${friend.username}`;
            }
            return ''; // Remove @N if no matching friend
          });
        } else {
          // If bestFriends is not loaded but bestFriends is enabled, remove @N patterns
          finalText = finalText.replace(/@\d+/g, '');
        }
      }

      // Get final flowPoints to use in embed URL
      let finalFlowPoints = userData?.flowPoints || 0;
      if (context?.user?.fid) {
        let dataToUse: UserFlowData | null = userData ?? null;
        
        // Fetch fresh data if needed
        if (!dataToUse || dataToUse.flowPoints === 0) {
          try {
            const freshData = await getUserByFid(context.user.fid);
            if (freshData && freshData.flowPoints > 0) {
              dataToUse = freshData;
              finalFlowPoints = freshData.flowPoints;
            }
          } catch (error) {
            // Use existing data
          }
        } else {
          finalFlowPoints = dataToUse.flowPoints;
        }
      }

      // Process embeds - Update fp parameter with fresh data
      const processedEmbeds = await Promise.all(
        (cast.embeds || []).map(async (embed) => {
          if (typeof embed === 'string') {
            // Update fp parameter in string embed URL
            try {
              const url = new URL(embed);
              url.searchParams.set('fp', finalFlowPoints.toString());
              url.searchParams.set('t', Date.now().toString());
              return url.toString();
            } catch {
              return embed;
            }
          }
          if (embed.path) {
            const baseUrl = APP_URL || window.location.origin;
            const url = new URL(`${baseUrl}${embed.path}`);

            // Update fp parameter with fresh data
            url.searchParams.set('fp', finalFlowPoints.toString());
            url.searchParams.set('t', Date.now().toString());

            // Add UTM parameters
            url.searchParams.set('utm_source', `share-cast-${context?.user?.fid || 'unknown'}`);

            // If custom image generator is provided, use it
            if (embed.imageUrl) {
              const imageUrl = await embed.imageUrl();
              url.searchParams.set('share_image_url', imageUrl);
            }

            return url.toString();
          }
          return embed.url || '';
        })
      );

      // Open cast composer with all supported intents
      // Note: composeCast resolves when the modal opens, not when user shares
      await actions.composeCast({
        text: finalText,
        embeds: processedEmbeds as [string] | [string, string] | undefined,
        parent: cast.parent,
        channelKey: cast.channelKey,
        close: cast.close,
      });
      
      // Clear timeout since we completed successfully
      clearTimeout(timeoutId);
      
      // Reset processing state immediately after modal opens
      // The spinner should stop once the cast composer is shown
      setIsProcessing(false);
    } catch (error) {
      console.error('Failed to share:', error);
      clearTimeout(timeoutId);
      setIsPreparingShare(false);
      setIsProcessing(false);
    }
  }, [cast, bestFriends, context?.user?.fid, actions, userData]);

  return (
    <Button
      onClick={handleShare}
      className={className}
      isLoading={isLoading || isProcessing}
      disabled={isLoadingBestFriends || isPreparingShare}
    >
      {isPreparingShare ? (
        <span className="flex items-center justify-center gap-2">
          <svg 
            className="animate-spin h-5 w-5" 
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Preparing...
        </span>
      ) : (
        buttonText
      )}
    </Button>
  );
}
