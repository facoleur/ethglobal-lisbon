"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { useState } from "react";

function makeWagmiConfig() {
  return createConfig({
    chains: [sepolia],
    transports: {
      [sepolia.id]: http(),
    },
    // No wallet connectors — used only for contract reads
    connectors: [],
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  // useState ensures config and queryClient are created once per mount
  const [wagmiConfig] = useState(makeWagmiConfig);
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
