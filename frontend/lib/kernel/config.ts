import { createPublicClient, getAddress, http, type Address } from "viem";
import { sepolia } from "viem/chains";
import { entryPoint07Address } from "viem/account-abstraction";

export const chain = sepolia;
export const entryPoint = {
  address: entryPoint07Address,
  version: "0.7",
} as const;
export const kernelVersion = "0.3.1" as const;

// WebAuthn validator shared by newly created and restored Kernel accounts.
const defaultWebAuthnValidatorAddress =
  "0x7ab16Ff354AcB328452F1D445b3Ddee9a91e9e69";

export const webAuthnValidatorAddress = getAddress(
  process.env.NEXT_PUBLIC_WEBAUTHN_VALIDATOR_ADDRESS?.trim() ||
    defaultWebAuthnValidatorAddress,
);

const configuredTarRecoveryExecutorAddress =
  process.env.NEXT_PUBLIC_TAR_RECOVERY_EXECUTOR_ADDRESS?.trim();

export const tarRecoveryExecutorAddress: Address | null =
  configuredTarRecoveryExecutorAddress
    ? getAddress(configuredTarRecoveryExecutorAddress)
    : null;

export const sepoliaRpcUrl =
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

  if (!window.isSecureContext) {
    throw new Error("Passkeys require a secure HTTPS connection.");
  }

  if (!("PublicKeyCredential" in window)) {
    throw new Error("This browser does not support passkeys.");
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

  const rpId =
    process.env.NEXT_PUBLIC_PASSKEY_RP_ID?.trim() || window.location.hostname;
  const hostname = window.location.hostname;
  if (hostname !== rpId && !hostname.endsWith(`.${rpId}`)) {
    throw new Error(
      `Passkey RP ID ${rpId} does not match the current domain ${hostname}.`,
    );
  }

  return {
    passkeyServerUrl: passkeyServerUrl.replace(/\/$/, ""),
    pimlicoUrl:
      configuredPimlicoUrl ||
      `https://api.pimlico.io/v2/${chain.id}/rpc?apikey=${pimlicoApiKey}`,
    rpId,
  };
}
