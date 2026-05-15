import { createConfig, http, WagmiProvider } from "wagmi";
import { base, degen, mainnet, optimism, unichain, celo } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { farcasterFrame } from "@farcaster/miniapp-wagmi-connector";
import { coinbaseWallet, metaMask } from 'wagmi/connectors';
import { APP_NAME, APP_ICON_URL, APP_URL } from "~/lib/constants";
import { useEffect, useState } from "react";
import { useConnect, useAccount } from "wagmi";
import React from "react";

// Custom hook for wallet auto-connection (prioritizes Farcaster, then Coinbase Wallet)
function useWalletAutoConnect() {
  const [isCoinbaseWallet, setIsCoinbaseWallet] = useState(false);
  const { connect, connectors } = useConnect();
  const { isConnected } = useAccount();

  useEffect(() => {
    // Check if we're running in Coinbase Wallet
    const checkCoinbaseWallet = () => {
      const isInCoinbaseWallet = window.ethereum?.isCoinbaseWallet || 
        window.ethereum?.isCoinbaseWalletExtension ||
        window.ethereum?.isCoinbaseWalletBrowser;
      setIsCoinbaseWallet(!!isInCoinbaseWallet);
    };
    
    checkCoinbaseWallet();
    window.addEventListener('ethereum#initialized', checkCoinbaseWallet);
    
    return () => {
      window.removeEventListener('ethereum#initialized', checkCoinbaseWallet);
    };
  }, []);

  useEffect(() => {
    // Check if we're in a Farcaster client (prioritize Farcaster connector)
    const isInFarcasterClient = typeof window !== 'undefined' && 
      (window.location.href.includes('warpcast.com') || 
       window.location.href.includes('farcaster') ||
       window.ethereum?.isFarcaster);
    
    // Prioritize Farcaster Frame connector when in Farcaster client
    if (isInFarcasterClient && !isConnected && connectors.length > 0) {
      const farcasterConnector = connectors.find(c => 
        c.name.toLowerCase().includes('farcaster') || 
        c.id === 'farcasterFrame'
      ) || connectors[0]; // Farcaster Frame should be first
      
      if (farcasterConnector) {
        try {
          connect({ connector: farcasterConnector });
          return; // Don't proceed to Coinbase Wallet connection
        } catch (error) {
          console.error("Farcaster auto-connection failed:", error);
        }
      }
    }
    
    // Auto-connect if in Coinbase Wallet and not already connected (and not in Farcaster)
    if (isCoinbaseWallet && !isConnected && !isInFarcasterClient) {
      const coinbaseConnector = connectors.find(c => 
        c.name.toLowerCase().includes('coinbase')
      ) || connectors[1]; // Coinbase Wallet connector
      
      if (coinbaseConnector) {
        connect({ connector: coinbaseConnector });
      }
    }
  }, [isCoinbaseWallet, isConnected, connect, connectors]);

  return isCoinbaseWallet;
}

export const config = createConfig({
  chains: [base, optimism, mainnet, degen, unichain, celo],
  transports: {
    [base.id]: http(),
    [optimism.id]: http(),
    [mainnet.id]: http(),
    [degen.id]: http(),
    [unichain.id]: http(),
    [celo.id]: http(),
  },
  connectors: [
    farcasterFrame(),
    coinbaseWallet({
      appName: APP_NAME,
      appLogoUrl: APP_ICON_URL,
      preference: 'all',
    }),
    metaMask({
      dappMetadata: {
        name: APP_NAME,
        url: APP_URL,
      },
    }),
  ],
});

const queryClient = new QueryClient();

// Wrapper component that provides wallet auto-connection (prioritizes Farcaster)
function WalletAutoConnect({ children }: { children: React.ReactNode }) {
  useWalletAutoConnect();
  return <>{children}</>;
}

export default function Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <WalletAutoConnect>
          {children}
        </WalletAutoConnect>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
