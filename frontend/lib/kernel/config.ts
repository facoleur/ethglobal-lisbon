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
const configuredTarRecoveryExecutorV2Address =
  process.env.NEXT_PUBLIC_TAR_RECOVERY_EXECUTOR_V2_ADDRESS?.trim();

export const tarRecoveryExecutorV2Address: Address | null =
  configuredTarRecoveryExecutorV2Address
    ? getAddress(configuredTarRecoveryExecutorV2Address)
    : null;

// V2 preserves the V1 recovery interface, so it becomes the active executor when configured.
export const tarRecoveryExecutorAddress: Address | null =
  tarRecoveryExecutorV2Address ??
  (configuredTarRecoveryExecutorAddress
    ? getAddress(configuredTarRecoveryExecutorAddress)
    : null);

export const semaphoreAddress = getAddress(
  "0x1e0d7FF1610e480fC93BdEC510811ea2Ba6d7c2f",
);

const configuredTarRecoveryExecutorV2DeploymentBlock =
  process.env.NEXT_PUBLIC_TAR_RECOVERY_EXECUTOR_V2_DEPLOYMENT_BLOCK?.trim();

export const tarRecoveryExecutorV2DeploymentBlock =
  configuredTarRecoveryExecutorV2DeploymentBlock
    ? BigInt(configuredTarRecoveryExecutorV2DeploymentBlock)
    : BigInt(0);

export const sepoliaRpcUrl =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL?.trim() ||
  "https://ethereum-sepolia-rpc.publicnode.com";

export const publicClient = createPublicClient({
  chain,
  transport: http(sepoliaRpcUrl),
});

export function getBrowserPasskeyRpId(): string {
  if (typeof window === "undefined") {
    throw new Error("Passkey authentication is only available in the browser.");
  }

  return (
    process.env.NEXT_PUBLIC_PASSKEY_RP_ID?.trim() || window.location.hostname
  );
}

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
    rpId: getBrowserPasskeyRpId(),
  };
}
