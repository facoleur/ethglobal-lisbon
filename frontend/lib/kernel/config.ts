import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { entryPoint07Address } from "viem/account-abstraction";

export const chain = sepolia;
export const entryPoint = {
  address: entryPoint07Address,
  version: "0.7",
} as const;
export const kernelVersion = "0.3.1" as const;

const sepoliaRpcUrl =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL?.trim() ||
  "https://ethereum-sepolia-rpc.publicnode.com";

export const publicClient = createPublicClient({
  chain,
  transport: http(sepoliaRpcUrl),
});

export function getBrowserWalletConfig() {
  if (typeof window === "undefined") {
    throw new Error("Passkey authentication is only available in the browser.");
  }

  const passkeyServerUrl =
    process.env.NEXT_PUBLIC_ZERODEV_PASSKEY_SERVER_URL?.trim();
  const configuredPimlicoUrl = process.env.NEXT_PUBLIC_PIMLICO_RPC_URL?.trim();
  const pimlicoApiKey = process.env.NEXT_PUBLIC_PIMLICO_API_KEY?.trim();

  if (!passkeyServerUrl) {
    throw new Error(
      "NEXT_PUBLIC_ZERODEV_PASSKEY_SERVER_URL is not configured.",
    );
  }

  if (!configuredPimlicoUrl && !pimlicoApiKey) {
    throw new Error(
      "Configure NEXT_PUBLIC_PIMLICO_API_KEY or NEXT_PUBLIC_PIMLICO_RPC_URL.",
    );
  }

  return {
    passkeyServerUrl: passkeyServerUrl.replace(/\/$/, ""),
    pimlicoUrl:
      configuredPimlicoUrl ||
      `https://api.pimlico.io/v2/${chain.id}/rpc?apikey=${pimlicoApiKey}`,
    rpId:
      process.env.NEXT_PUBLIC_PASSKEY_RP_ID?.trim() || window.location.hostname,
  };
}
