import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
  constants,
  type KernelAccountClient,
} from "@zerodev/sdk";
import {
  toPasskeyValidator,
  toWebAuthnKey,
  WebAuthnMode,
  PasskeyValidatorContractVersion,
} from "@zerodev/passkey-validator";
import { http, type Address, createPublicClient } from "viem";
import { sepolia } from "viem/chains";
import { entryPoint07Address } from "viem/account-abstraction";

const { KERNEL_V3_1 } = constants;

const BUNDLER_URL = process.env.NEXT_PUBLIC_ZERODEV_BUNDLER_URL!;
const PAYMASTER_URL = process.env.NEXT_PUBLIC_ZERODEV_PAYMASTER_URL!;
const PASSKEY_SERVER_URL = process.env.NEXT_PUBLIC_ZERODEV_PASSKEY_SERVER_URL!;

const entryPoint = {
  address: entryPoint07Address,
  version: "0.7",
} as const;

const kernelVersion = KERNEL_V3_1;

type PasskeyResult = {
  credentialId: string;
  accountAddress: Address;
  kernelClient: KernelAccountClient;
};

async function buildKernelClient(
  mode: WebAuthnMode,
  passkeyName?: string,
): Promise<PasskeyResult> {
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(BUNDLER_URL),
  });

  const webAuthnKey = await toWebAuthnKey({
    passkeyName: passkeyName ?? "TAR Wallet",
    passkeyServerUrl: PASSKEY_SERVER_URL,
    mode,
  });

  const passkeyValidator = await toPasskeyValidator(publicClient, {
    webAuthnKey,
    entryPoint,
    kernelVersion,
    validatorContractVersion: PasskeyValidatorContractVersion.V0_0_2_UNPATCHED,
  });

  const kernelAccount = await createKernelAccount(publicClient, {
    plugins: {
      sudo: passkeyValidator,
    },
    entryPoint,
    kernelVersion,
  });

  const paymasterClient = createZeroDevPaymasterClient({
    chain: sepolia,
    transport: http(PAYMASTER_URL),
  });

  const kernelClient = createKernelAccountClient({
    account: kernelAccount,
    chain: sepolia,
    bundlerTransport: http(BUNDLER_URL),
    paymaster: {
      getPaymasterData: (userOperation) =>
        paymasterClient.sponsorUserOperation({ userOperation }),
    },
  });

  return {
    credentialId: webAuthnKey.authenticatorIdHash,
    accountAddress: kernelAccount.address,
    kernelClient,
  };
}

export async function registerPasskey(
  passkeyName: string,
): Promise<PasskeyResult> {
  return buildKernelClient(WebAuthnMode.Register, passkeyName);
}

export async function loginPasskey(): Promise<PasskeyResult> {
  return buildKernelClient(WebAuthnMode.Login);
}
