import { toWebAuthnKey, WebAuthnMode } from "@zerodev/webauthn-key";
import { createSmartAccountClient } from "permissionless";
import { toKernelSmartAccount } from "permissionless/accounts";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { concatHex, http, toHex } from "viem";
import { toWebAuthnAccount } from "viem/account-abstraction";
import {
  chain,
  entryPoint,
  getBrowserWalletConfig,
  kernelVersion,
  publicClient,
} from "@/lib/kernel/config";

export type PasskeyMode = "register" | "login";

export async function createKernelSession(
  mode: PasskeyMode,
  passkeyName: string,
) {
  const { passkeyServerUrl, pimlicoUrl, rpId } = getBrowserWalletConfig();
  const webAuthnKey = await toWebAuthnKey({
    passkeyName,
    passkeyServerUrl,
    rpID: rpId,
    mode: mode === "register" ? WebAuthnMode.Register : WebAuthnMode.Login,
    passkeyServerHeaders: {},
  });

  const owner = toWebAuthnAccount({
    credential: {
      id: webAuthnKey.authenticatorId,
      publicKey: concatHex([
        toHex(webAuthnKey.pubX, { size: 32 }),
        toHex(webAuthnKey.pubY, { size: 32 }),
      ]),
    },
    rpId,
  });

  const account = await toKernelSmartAccount({
    client: publicClient,
    entryPoint,
    version: kernelVersion,
    owners: [owner],
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

  return { account, client, authenticatorId: webAuthnKey.authenticatorId };
}

export type KernelSession = Awaited<ReturnType<typeof createKernelSession>>;
