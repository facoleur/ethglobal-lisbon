import {
  concatHex,
  encodeAbiParameters,
  keccak256,
  stringToBytes,
  type Address,
  type Hex,
} from "viem";

export const MODULE_TYPE_EXECUTOR = 2n;

export type P256PublicKey = {
  x: bigint;
  y: bigint;
};

export type NewPasskey = P256PublicKey & {
  credentialIdHash: Hex;
};

export function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");

  const binary = window.atob(base64);
  return Uint8Array.from(binary, (character) =>
    character.charCodeAt(0),
  );
}

export function hashCredentialId(credentialId: string): Hex {
  return keccak256(base64UrlToBytes(credentialId));
}

export function encodeInitialValidatorData(args: {
  publicKey: P256PublicKey;
  credentialIdHash: Hex;
}): Hex {
  return encodeAbiParameters(
    [
      {
        name: "publicKey",
        type: "tuple",
        components: [
          { name: "pubKeyX", type: "uint256" },
          { name: "pubKeyY", type: "uint256" },
        ],
      },
      {
        name: "credentialIdHash",
        type: "bytes32",
      },
    ],
    [
      {
        pubKeyX: args.publicKey.x,
        pubKeyY: args.publicKey.y,
      },
      args.credentialIdHash,
    ],
  );
}

export function encodeNewPasskey(passkey: NewPasskey): Hex {
  if (passkey.x === 0n || passkey.y === 0n) {
    throw new Error("Invalid P-256 public key");
  }

  return encodeAbiParameters(
    [
      { name: "pubKeyX", type: "uint256" },
      { name: "pubKeyY", type: "uint256" },
      { name: "credentialIdHash", type: "bytes32" },
    ],
    [
      passkey.x,
      passkey.y,
      passkey.credentialIdHash,
    ],
  );
}

export function encodeTarExecutorData(args: {
  validator: Address;
  vetoer: Address;
}): Hex {
  return encodeAbiParameters(
    [
      { name: "validator", type: "address" },
      { name: "vetoer", type: "address" },
    ],
    [args.validator, args.vetoer],
  );
}

/**
 * Kernel v0.3.1 executor install format:
 * address hook (20 bytes) || abi.encode(executorData, hookData)
 *
 * address(0) means no custom hook in the current integration.
 */
export function encodeKernelExecutorInitData(
  executorData: Hex,
): Hex {
  const noHook =
    "0x0000000000000000000000000000000000000000" as Hex;

  return concatHex([
    noHook,
    encodeAbiParameters(
      [
        { name: "executorData", type: "bytes" },
        { name: "hookData", type: "bytes" },
      ],
      [executorData, "0x"],
    ),
  ]);
}

export function generateRecoverySalt(): Hex {
  const bytes = crypto.getRandomValues(
    new Uint8Array(32),
  );

  return (`0x${Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")}`) as Hex;
}

export function computeRecoveryCommitment(args: {
  chainId: bigint;
  timelockRecovery: Address;
  account: Address;
  claimant: Address;
  newValidator: Address;
  newValidatorData: Hex;
  salt: Hex;
  nonce: bigint;
}): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { name: "chainId", type: "uint256" },
        { name: "timelockRecovery", type: "address" },
        { name: "account", type: "address" },
        { name: "claimant", type: "address" },
        { name: "newValidator", type: "address" },
        { name: "newValidatorDataHash", type: "bytes32" },
        { name: "salt", type: "bytes32" },
        { name: "nonce", type: "uint64" },
      ],
      [
        args.chainId,
        args.timelockRecovery,
        args.account,
        args.claimant,
        args.newValidator,
        keccak256(args.newValidatorData),
        args.salt,
        args.nonce,
      ],
    ),
  );
}

export const recoveryStatus = {
  0: "none",
  1: "committed",
  2: "pending",
  3: "vetoed",
  4: "finalized",
  5: "expired",
} as const;
