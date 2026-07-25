import { toWebAuthnKey, WebAuthnMode } from "@zerodev/webauthn-key";
import { createSmartAccountClient } from "permissionless";
import { toKernelSmartAccount } from "permissionless/accounts";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import {
  concatHex,
  getAddress,
  http,
  parseAbi,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { toWebAuthnAccount } from "viem/account-abstraction";
import {
  chain,
  entryPoint,
  getBrowserWalletConfig,
  kernelVersion,
  publicClient,
  webAuthnValidatorAddress,
} from "@/lib/kernel/config";

export type PasskeyMode = "register" | "login";

const kernelRootValidatorAbi = parseAbi([
  "function rootValidator() view returns (bytes21)",
]);

async function getDeployedRootValidator(accountAddress: Address) {
  const code = await publicClient.getCode({ address: accountAddress });
  if (!code || code === "0x") return webAuthnValidatorAddress;

  const rootValidator = await publicClient.readContract({
    address: accountAddress,
    abi: kernelRootValidatorAbi,
    functionName: "rootValidator",
  });

  return getAddress(`0x${rootValidator.slice(4)}`);
}

export async function createPasskeyCredential(
  mode: PasskeyMode,
  passkeyName: string,
) {
  const { passkeyServerUrl, rpId } = getBrowserWalletConfig();
  const webAuthnKey = await toWebAuthnKey({
    passkeyName,
    passkeyServerUrl,
    rpID: rpId,
    mode: mode === "register" ? WebAuthnMode.Register : WebAuthnMode.Login,
    passkeyServerHeaders: {},
  });
  const pubKeyX = toHex(webAuthnKey.pubX, { size: 32 });
  const pubKeyY = toHex(webAuthnKey.pubY, { size: 32 });
  const publicKey = concatHex([pubKeyX, pubKeyY]);
  const owner = toWebAuthnAccount({
    credential: { id: webAuthnKey.authenticatorId, publicKey },
    rpId,
  });

  return {
    owner,
    authenticatorId: webAuthnKey.authenticatorId,
    publicKey,
    pubKeyX,
    pubKeyY,
  };
}

export async function createKernelSession(
  mode: PasskeyMode,
  passkeyName: string,
  accountAddress?: Address,
) {
  const { pimlicoUrl } = getBrowserWalletConfig();
  const credential = await createPasskeyCredential(mode, passkeyName);
  const validatorAddress = accountAddress
    ? await getDeployedRootValidator(accountAddress)
    : webAuthnValidatorAddress;

  // Recovery reconnects to a deployed Kernel; onboarding derives a new one.
  const account = await toKernelSmartAccount({
    client: publicClient,
    entryPoint,
    version: kernelVersion,
    owners: [credential.owner],
    validatorAddress,
    ...(accountAddress ? { address: accountAddress } : {}),
  });

  const pimlicoClient = createPimlicoClient({
    chain,
    entryPoint,
    transport: http(pimlicoUrl),
  });

  const client = createSmartAccountClient({
    account,
    chain,
    client: publicClient,
    bundlerTransport: http(pimlicoUrl),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () =>
        (await pimlicoClient.getUserOperationGasPrice()).fast,
    },
  });

  return {
    account,
    client,
    authenticatorId: credential.authenticatorId,
    publicKey: credential.publicKey,
  };
}

export async function restoreKernelSession(
  credentialId: string,
  publicKey: Hex,
  accountAddress: Address,
) {
  const { pimlicoUrl, rpId } = getBrowserWalletConfig();
  const validatorAddress = await getDeployedRootValidator(accountAddress);

  const owner = toWebAuthnAccount({
    credential: { id: credentialId, publicKey },
    rpId,
  });

  // Rebuild the deployed account at its persisted address.
  const account = await toKernelSmartAccount({
    client: publicClient,
    entryPoint,
    version: kernelVersion,
    owners: [owner],
    validatorAddress,
    address: accountAddress,
  });

  const pimlicoClient = createPimlicoClient({
    chain,
    entryPoint,
    transport: http(pimlicoUrl),
  });

  const client = createSmartAccountClient({
    account,
    chain,
    client: publicClient,
    bundlerTransport: http(pimlicoUrl),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () =>
        (await pimlicoClient.getUserOperationGasPrice()).fast,
    },
  });

  return { account, client, authenticatorId: credentialId, publicKey };
}

export type KernelSession = Awaited<ReturnType<typeof createKernelSession>>;
