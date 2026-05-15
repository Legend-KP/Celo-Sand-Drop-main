import { useAccount } from "wagmi";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "./lib/wagmi";
import { useAutoConnect } from "./hooks/useAutoConnect";

const queryClient = new QueryClient();

function AppContent() {
  useAutoConnect();

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Arrow Celo Mini App</h1>
      <WalletStatus />
    </div>
  );
}

function WalletStatus() {
  const { address, isConnected, isConnecting } = useAccount();

  if (isConnecting) return <p>Connecting to MiniPay...</p>;
  if (!isConnected || !address) return <p>Not connected. Open this app inside MiniPay.</p>;

  return (
    <div>
      <p>✅ Connected!</p>
      <p>Address: {address}</p>
    </div>
  );
}

export default function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </WagmiProvider>
  );
}