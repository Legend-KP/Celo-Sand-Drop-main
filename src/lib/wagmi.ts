import { http } from "viem";
import { createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { celo, celoSepolia } from "wagmi/chains";

export const config = createConfig({
  chains: [celo, celoSepolia],
  connectors: [injected()],
  transports: {
    [celo.id]: http(),
    [celoSepolia.id]: http(),
  },
});
