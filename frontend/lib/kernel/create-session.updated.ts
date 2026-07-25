import {
  toWebAuthnKey,
  WebAuthnMode,
} from "@zerodev/webauthn-key";
import { createSmartAccountClient } from "permissionless";
import { toKernelSmartAccount } from "permissionless/accounts";
import {
  createPimlicoClient,
} from "permissionless/clients/pimlico";
import {
  concatHex,
  http,
  toHex,
  type Address,
  type Hex,
} from "viem";
import {
  toWebAuthnAccount,
} from "viem/account-abstraction";

import {
  chain,
  entryPoint,
  getBrowserWalletConfig,
  kernelVersion,
  publicClient,
} from "@/lib/kernel/config";
import { getTarAddresses } from "@/lib/tar/config";

export type PasskeyMode = "register" | "login";

async function buildKernelSession(args: {
  credentialId: string;
  publicKey: Hex;
  existingKernelAddress?: Address;
}) {
  const {
    pimlicoUrl,
    rpId,
  } = getBrowserWalletConfig();

  const {
    rotatableWebAuthnValidator,
  } = getTarAddresses();

  const owner = toWebAuthnAccount({
    credential: {
      id: args.credentialId,
      publicKey: args.publicKey,
    },
    rpId,
  });

  const account = await toKernelSmartAccount({
    client: publicClient,
    entryPoint,
    version: kernelVersion,
    owners: [owner],

    // Required: use the custom rotatable validator
    // instead of the permissionless.js default address.
    validatorAddress:
      rotatableWebAuthnValidator,

    // Required after recovery: preserve the existing
    // Kernel address instead of recalculating one from
    // the new passkey.
    ...(args.existingKernelAddress
      ? { address: args.existingKernelAddress }
      : {}),
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
        (
          await pimlicoClient
            .getUserOperationGasPrice()
        ).fast,
    },
  });

  return {
    account,
    client,
    authenticatorId: args.credentialId,
    publicKey: args.publicKey,
  };
}

export async function createKernelSession(
  mode: PasskeyMode,
  passkeyName: string,
) {
  const {
    passkeyServerUrl,
    rpId,
  } = getBrowserWalletConfig();

  const webAuthnKey = await toWebAuthnKey({
    passkeyName,
    passkeyServerUrl,
    rpID: rpId,
    mode:
      mode === "register"
        ? WebAuthnMode.Register
        : WebAuthnMode.Login,
    passkeyServerHeaders: {},
  });

  const publicKey = concatHex([
    toHex(webAuthnKey.pubX, { size: 32 }),
    toHex(webAuthnKey.pubY, { size: 32 }),
  ]);

  return buildKernelSession({
    credentialId:
      webAuthnKey.authenticatorId,
    publicKey,
  });
}

/// @notice Normal restore or post-recovery restore.
///
/// After recovery, existingKernelAddress is mandatory.
/// Without it, permissionless.js may derive a different
/// counterfactual address from the new passkey.
export async function restoreKernelSession(
  credentialId: string,
  publicKey: Hex,
  existingKernelAddress: Address,
) {
  return buildKernelSession({
    credentialId,
    publicKey,
    existingKernelAddress,
  });
}

export type KernelSession = Awaited<
  ReturnType<typeof createKernelSession>
>;
