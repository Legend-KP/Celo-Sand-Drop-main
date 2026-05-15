"use client";

import { useState, useEffect, useMemo } from "react";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { useConnect } from "wagmi";
import { base } from "wagmi/chains";
import { config } from "../../providers/WagmiProvider";
import { renderError } from "../../../lib/errorUtils";
import { Gift, Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import { encodeFunctionData } from "viem";
import { useMiniApp } from "@neynar/react";
import { APP_URL } from "~/lib/constants";

// NFT Contract Details
const NFT_CONTRACT_ADDRESS = "0x24600d13e6f5946bac6a8583625574ec635B4710" as `0x${string}`;
const METADATA_BASE_URI = "https://scarlet-voluntary-angelfish-357.mypinata.cloud/ipfs/bafybeib2t7nswskummb5zjetzyd3fp5rvtplj2dhtyycpddjfvxckcckue/";
const TOTAL_NFTS = 14;

// Contract ABI - Only the functions we need
const CONTRACT_ABI = [
  {
    inputs: [
      { internalType: "address", name: "_receiver", type: "address" },
      { internalType: "uint256", name: "_tokenId", type: "uint256" },
      { internalType: "uint256", name: "_quantity", type: "uint256" },
      { internalType: "address", name: "_currency", type: "address" },
      { internalType: "uint256", name: "_pricePerToken", type: "uint256" },
      {
        components: [
          { internalType: "bytes32[]", name: "proof", type: "bytes32[]" },
          { internalType: "uint256", name: "quantityLimitPerWallet", type: "uint256" },
          { internalType: "uint256", name: "pricePerToken", type: "uint256" },
          { internalType: "address", name: "currency", type: "address" },
        ],
        internalType: "struct IDrop1155.AllowlistProof",
        name: "_allowlistProof",
        type: "tuple",
      },
      { internalType: "bytes", name: "_data", type: "bytes" },
    ],
    name: "claim",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }, { internalType: "uint256", name: "id", type: "uint256" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_tokenId", type: "uint256" }],
    name: "getActiveClaimConditionId",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "_tokenId", type: "uint256" },
      { internalType: "uint256", name: "_conditionId", type: "uint256" },
    ],
    name: "getClaimConditionById",
    outputs: [
      {
        components: [
          { internalType: "uint256", name: "startTimestamp", type: "uint256" },
          { internalType: "uint256", name: "maxClaimableSupply", type: "uint256" },
          { internalType: "uint256", name: "supplyClaimed", type: "uint256" },
          { internalType: "uint256", name: "quantityLimitPerWallet", type: "uint256" },
          { internalType: "bytes32", name: "merkleRoot", type: "bytes32" },
          { internalType: "uint256", name: "pricePerToken", type: "uint256" },
          { internalType: "address", name: "currency", type: "address" },
          { internalType: "string", name: "metadata", type: "string" },
        ],
        internalType: "struct IClaimCondition.ClaimCondition",
        name: "condition",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

interface NFTMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
}

/**
 * FlowStateTab component displays the NFT minting interface for the Flow State campaign.
 * 
 * This component allows users to mint NFTs from a 14-day campaign, with 1 NFT available per day.
 * It integrates with wagmi for wallet interactions and displays NFT metadata.
 */
export function FlowStateTab() {
  const { address, isConnected, chainId } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { context, actions } = useMiniApp();
  const [nftMetadata, setNftMetadata] = useState<NFTMetadata | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [userBalance, setUserBalance] = useState<bigint | null>(null);
  const [claimCondition, setClaimCondition] = useState<{
    pricePerToken: bigint;
    currency: `0x${string}`;
  } | null>(null);

  // Calculate which NFT token ID is available today (0-13 for 14 NFTs)
  // Campaign starts on Jan 16, 2026 11:45 PM and shows 1 NFT per day sequentially
  const todayTokenId = useMemo(() => {
    // Campaign start date: Jan 16, 2026 11:45 PM
    const campaignStartDate = new Date("2026-01-16T23:45:00");
    const now = new Date();
    
    // Calculate milliseconds since campaign start
    const msSinceStart = now.getTime() - campaignStartDate.getTime();
    
    // Calculate days since start (using 24-hour periods)
    const daysSinceStart = Math.floor(msSinceStart / (1000 * 60 * 60 * 24));
    
    // Sequential progression: Day 0 = NFT 0, Day 1 = NFT 1, etc.
    // After 14 days, campaign ends (or show last NFT)
    const tokenId = Math.min(daysSinceStart, TOTAL_NFTS - 1);
    
    // Only show NFTs if campaign has started
    if (daysSinceStart < 0) {
      return null; // Campaign hasn't started yet
    }
    
    return BigInt(Math.max(0, tokenId));
  }, []);

  // Read active claim condition ID
  const { data: activeConditionId } = useReadContract({
    address: NFT_CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getActiveClaimConditionId",
    args: todayTokenId !== null ? [todayTokenId] : undefined,
    chainId: base.id,
    query: {
      enabled: todayTokenId !== null,
    },
  });

  // Read claim condition details
  const { data: conditionData } = useReadContract({
    address: NFT_CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getClaimConditionById",
    args: todayTokenId !== null && activeConditionId !== undefined 
      ? [todayTokenId, activeConditionId] 
      : undefined,
    chainId: base.id,
    query: {
      enabled: todayTokenId !== null && activeConditionId !== undefined,
    },
  });

  // Update claim condition state
  useEffect(() => {
    if (conditionData) {
      setClaimCondition({
        pricePerToken: conditionData.pricePerToken,
        currency: conditionData.currency,
      });
    }
  }, [conditionData]);

  // Read user's balance for today's NFT
  const { data: balanceData, refetch: refetchBalance } = useReadContract({
    address: NFT_CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "balanceOf",
    args: address && todayTokenId !== null ? [address, todayTokenId] : undefined,
    chainId: base.id,
    query: {
      enabled: !!address && isConnected && todayTokenId !== null,
    },
  });

  useEffect(() => {
    if (balanceData !== undefined) {
      setUserBalance(balanceData);
    }
  }, [balanceData]);

  // Fetch NFT metadata
  useEffect(() => {
    if (todayTokenId === null) {
      setMetadataLoading(false);
      setNftMetadata(null);
      return;
    }

    const fetchMetadata = async () => {
      try {
        setMetadataLoading(true);
        // Prioritize local metadata files first (they have correct quotes)
        const localMetadataUrl = `/flow-reminders-metadata/${todayTokenId.toString()}.json`;
        const localResponse = await fetch(localMetadataUrl);
        if (localResponse.ok) {
          const metadata = await localResponse.json();
          setNftMetadata(metadata);
        } else {
          // ✅ NEW: Fallback to IPFS proxy instead of direct Pinata
          const metadataCid = `bafybeib2t7nswskummb5zjetzyd3fp5rvtplj2dhtyycpddjfvxckcckue/${todayTokenId.toString()}`;
          const proxyUrl = `/api/ipfs?cid=${metadataCid}`;
          console.log(`📥 Fallback: Fetching from IPFS proxy: ${proxyUrl}`);
          
          const response = await fetch(proxyUrl);
          if (response.ok) {
            const metadata = await response.json();
            
            // ✅ Convert image URLs to use proxy
            if (metadata.image) {
              if (metadata.image.includes('scarlet-voluntary-angelfish-357.mypinata.cloud/ipfs/')) {
                const cidMatch = metadata.image.match(/\/ipfs\/(.+)$/);
                if (cidMatch) {
                  metadata.image = `/api/ipfs?cid=${cidMatch[1]}`;
                }
              } else if (metadata.image.startsWith('ipfs://')) {
                const cid = metadata.image.replace('ipfs://', '').replace(/^ipfs\//, '');
                metadata.image = `/api/ipfs?cid=${cid}`;
              }
            }
            
            setNftMetadata(metadata);
          } else {
            console.error(`❌ IPFS proxy fetch failed: ${response.status}`);
          }
        }
      } catch (error) {
        console.error("Error fetching NFT metadata:", error);
      } finally {
        setMetadataLoading(false);
      }
    };

    fetchMetadata();
  }, [todayTokenId]);

  // Send transaction for minting
  const {
    sendTransaction,
    data: hash,
    error: writeError,
    isPending: isWritePending,
  } = useSendTransaction();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({
    hash,
    chainId: base.id,
  });

  // Handle mint
  const handleMint = async () => {
    if (!isConnected || !address) {
      // Wait a moment for connectors to initialize if they're not ready yet
      if (connectors.length === 0) {
        alert("Wallet connectors are loading. Please wait a moment and try again.");
        return;
      }

      try {
        // Find the appropriate connector
        // Prioritize Farcaster Frame if available, otherwise use first ready connector
        const farcasterConnector = connectors.find(
          (c) => c.name.toLowerCase().includes('farcaster') || c.id === 'farcasterFrame'
        );
        
        // Use Farcaster if available, otherwise find a ready connector, or use first available
        const connectorToUse = farcasterConnector || 
          connectors.find(c => c.ready !== false) || 
          connectors[0];
        
        if (!connectorToUse) {
          alert("No wallet connector available. Please refresh the page.");
          return;
        }

        // Connect with the selected connector
        await connectAsync({
          chainId: base.id,
          connector: connectorToUse,
        });
        return;
      } catch (error: any) {
        console.error("Failed to connect wallet:", error);
        // Show user-friendly error
        const errorMessage = error?.message || "Failed to connect wallet";
        alert(`Connection error: ${errorMessage}. Please try again or refresh the page.`);
        return;
      }
    }

    if (chainId !== base.id) {
      alert("Please switch to Base network to mint");
      return;
    }

    if (todayTokenId === null) {
      alert("Campaign has not started yet or has ended");
      return;
    }

    if (!claimCondition) {
      alert("Loading claim conditions... Please try again in a moment.");
      return;
    }

    // Prepare claim parameters using actual claim condition from contract
    const claimParams = {
      _receiver: address,
      _tokenId: todayTokenId,
      _quantity: BigInt(1),
      _currency: claimCondition.currency,
      _pricePerToken: claimCondition.pricePerToken,
      _allowlistProof: {
        proof: [] as `0x${string}`[],
        quantityLimitPerWallet: BigInt(0),
        pricePerToken: claimCondition.pricePerToken,
        currency: claimCondition.currency,
      },
      _data: "0x" as `0x${string}`,
    };

    try {
      // Encode the function call data
      const data = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: "claim",
        args: [
          claimParams._receiver,
          claimParams._tokenId,
          claimParams._quantity,
          claimParams._currency,
          claimParams._pricePerToken,
          claimParams._allowlistProof,
          claimParams._data,
        ],
      });

      sendTransaction({
        to: NFT_CONTRACT_ADDRESS,
        data,
        value: claimCondition.pricePerToken, // Send ETH if price > 0
        chainId: base.id,
      });
    } catch (error) {
      console.error("Mint error:", error);
    }
  };

  // Refetch balance after successful mint
  useEffect(() => {
    if (isConfirmed) {
      refetchBalance();
    }
  }, [isConfirmed, refetchBalance]);

  const hasMinted = userBalance !== null && userBalance > 0n;
  const isMinting = isWritePending || isConfirming;
  const mintSuccess = isConfirmed;
  const isLoadingClaimCondition = todayTokenId !== null && claimCondition === null && conditionData === undefined;

  // Calculate campaign status
  const campaignStartDate = new Date("2026-01-16T15:11:00");
  const now = new Date();
  const msSinceStart = now.getTime() - campaignStartDate.getTime();
  const daysSinceStart = Math.floor(msSinceStart / (1000 * 60 * 60 * 24));
  const campaignHasStarted = daysSinceStart >= 0;
  const campaignHasEnded = daysSinceStart >= TOTAL_NFTS;

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gradient-to-br from-pink-300 via-purple-300 to-blue-300 px-4 py-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-br from-white/80 via-white/60 to-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
          <div className="text-center mb-2">
            <h2 className="text-2xl font-extrabold text-black whitespace-nowrap">Reminder to Flow</h2>
          </div>
          {todayTokenId !== null ? (
            <p className="text-gray-600 text-sm mt-2 font-semibold text-center">
              Day {Number(todayTokenId) + 1} of 14
            </p>
          ) : campaignHasEnded ? (
            <p className="text-red-600 text-sm mt-2 font-semibold text-center">
              Campaign has ended
            </p>
          ) : (
            <p className="text-gray-600 text-sm mt-2 text-center">
              Campaign starts: Jan 16, 2026 03:11 PM
            </p>
          )}
        </div>

        {/* NFT Display */}
        {todayTokenId === null ? (
          <div className="bg-gradient-to-br from-white/80 via-white/60 to-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg text-center">
            <p className={campaignHasEnded ? "text-red-600" : "text-gray-500"}>
              {campaignHasEnded 
                ? "Campaign has ended. All 14 NFTs have been released." 
                : "Campaign has not started yet. Check back on Jan 16, 2026 03:11 PM"}
            </p>
          </div>
        ) : metadataLoading ? (
          <div className="bg-gradient-to-br from-white/80 via-white/60 to-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg flex items-center justify-center">
            <Loader2 className="animate-spin text-purple-500" size={32} />
          </div>
        ) : nftMetadata ? (
          <div className="bg-gradient-to-br from-white/80 via-white/60 to-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
            <div className="flex flex-col items-center space-y-4">
              {nftMetadata.image && (
                <img
                  src={nftMetadata.image}
                  alt={nftMetadata.name || "NFT"}
                  className="w-full max-w-sm rounded-xl shadow-lg"
                />
              )}
              <div className="text-center w-full">
                {nftMetadata.description && (
                  <p className="text-gray-600 text-base font-medium mb-4">{nftMetadata.description}</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-white/80 via-white/60 to-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg text-center">
            <p className="text-gray-500">NFT metadata not available</p>
          </div>
        )}

        {/* Mint Status - Show if user has already minted */}
        {todayTokenId !== null && isConnected && address && hasMinted && (
          <div className="bg-gradient-to-br from-white/80 via-white/60 to-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg">
            <div className="flex items-center justify-center gap-2 text-green-600">
              <CheckCircle2 size={16} />
              <span className="text-sm font-medium text-center">You&apos;ve already minted this NFT!</span>
            </div>
          </div>
        )}

        {/* Mint Button - Only show if user hasn't minted yet */}
        {todayTokenId !== null && !hasMinted && (
          <div className="space-y-3">
            {isLoadingClaimCondition ? (
              <div className="bg-gradient-to-br from-white/80 via-white/60 to-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg flex items-center justify-center gap-2">
                <Loader2 className="animate-spin text-purple-500" size={20} />
                <span className="text-sm text-gray-600 text-center">Loading claim conditions...</span>
              </div>
            ) : !isConnected ? (
              <button
                onClick={handleMint}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-4 px-6 rounded-2xl shadow-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                Connect Wallet to Mint
              </button>
            ) : chainId !== base.id ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
                <p className="text-sm text-yellow-800 text-center">
                  Please switch to Base network to mint
                </p>
              </div>
            ) : (
              <>
                <button
                  onClick={handleMint}
                  disabled={isMinting || mintSuccess || !claimCondition}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-4 px-6 rounded-2xl shadow-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                >
                  {isMinting ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      <span>{isConfirming ? "Confirming..." : "Minting..."}</span>
                    </>
                  ) : mintSuccess ? (
                    <>
                      <CheckCircle2 size={20} />
                      <span>Minted Successfully!</span>
                    </>
                  ) : (
                    "Free Mint"
                  )}
                </button>
                {/* Show BaseScan link after successful mint */}
                {mintSuccess && hash && (
                  <a
                    href={`https://basescan.org/tx/${hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 text-sm text-purple-600 hover:text-purple-700"
                  >
                    View on BaseScan
                    <ExternalLink size={14} />
                  </a>
                )}
              </>
            )}
          </div>
        )}

        {/* Error Display */}
        {writeError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
            {renderError(writeError)}
          </div>
        )}

        {/* Action Buttons - Share, Tap to Flow, OpenSea */}
        {todayTokenId !== null && (
          <div className="space-y-3">
            {/* Share Button - Show when user has minted */}
            {hasMinted && nftMetadata?.image && context?.user?.fid && (
              <button
                onClick={async () => {
                  if (!actions || !nftMetadata?.image) return;
                  
                  try {
                    // ✅ CRITICAL: Convert relative image URL to absolute before sharing
                    let imageUrl = nftMetadata.image;
                    
                    // If it's a relative URL, convert to absolute
                    if (imageUrl.startsWith('/api/ipfs')) {
                      imageUrl = `${APP_URL}${imageUrl}`;
                    }
                    // If it's already a full URL, use it as-is
                    else if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
                      // If it's neither relative nor absolute, assume it needs APP_URL prefix
                      imageUrl = `${APP_URL}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
                    }
                    
                    console.log(`📤 Sharing NFT with image URL: ${imageUrl}`);
                    
                    const shareUrl = `${APP_URL}/share/nft/${todayTokenId.toString()}?image=${encodeURIComponent(imageUrl)}&day=${Number(todayTokenId) + 1}&t=${Date.now()}`;
                    
                    // Directly open cast composer for NFT share (no prepare-share needed)
                    await actions.composeCast({
                      text: `Just got my 'Daily Reminder to Flow' NFT by @trenchverse\nGet yours...`,
                      embeds: [shareUrl],
                    });
                  } catch (error) {
                    console.error('Failed to share NFT:', error);
                  }
                }}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold text-base py-4 px-6 rounded-2xl shadow-lg transition-all transform hover:scale-[1.02] text-center"
              >
                Share NFT (+50 FP)
              </button>
            )}

            {/* Tap to Flow Button */}
            <button
              onClick={() => {
                if (actions) {
                  actions.openUrl('https://farcaster.xyz/miniapps/0JqfZe0oRgF8/flow');
                }
              }}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-4 px-6 rounded-2xl shadow-lg transition-all transform hover:scale-[1.02]"
            >
              Tap to Flow
            </button>

            {/* OpenSea Link */}
            <div className="bg-gradient-to-br from-white/80 via-white/60 to-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg text-center">
              <a
                href={`https://opensea.io/assets/base/${NFT_CONTRACT_ADDRESS}/${todayTokenId.toString()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                View on OpenSea
                <ExternalLink size={14} />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
