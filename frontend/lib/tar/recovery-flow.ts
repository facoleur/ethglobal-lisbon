import {
  encodeNewPasskey,
  generateRecoverySalt,
  hashCredentialId,
  computeRecoveryCommitment,
  type P256PublicKey,
} from "@/lib/tar/encoding";
import type { Address, Hex } from "viem";

export type StoredRecoverySecret = {
  account: Address;
  claimant: Address;
  validator: Address;
  validatorData: Hex;
  salt: Hex;
  nonce: bigint;
  commitment: Hex;
};

export function prepareRecovery(args: {
  chainId: bigint;
  timelockRecovery: Address;
  account: Address;
  claimant: Address;
  validator: Address;
  publicKey: P256PublicKey;
  credentialId: string;
  nonce: bigint;
}): StoredRecoverySecret {
  const validatorData = encodeNewPasskey({
    ...args.publicKey,
    credentialIdHash: hashCredentialId(
      args.credentialId,
    ),
  });

  const salt = generateRecoverySalt();

  const commitment = computeRecoveryCommitment({
    chainId: args.chainId,
    timelockRecovery: args.timelockRecovery,
    account: args.account,
    claimant: args.claimant,
    newValidator: args.validator,
    newValidatorData: validatorData,
    salt,
    nonce: args.nonce,
  });

  return {
    account: args.account,
    claimant: args.claimant,
    validator: args.validator,
    validatorData,
    salt,
    nonce: args.nonce,
    commitment,
  };
}

export function saveRecoverySecret(
  secret: StoredRecoverySecret,
): void {
  localStorage.setItem(
    `tar-recovery:${secret.account.toLowerCase()}`,
    JSON.stringify(secret, (_, value) =>
      typeof value === "bigint"
        ? value.toString()
        : value,
    ),
  );
}

export function loadRecoverySecret(
  account: Address,
): StoredRecoverySecret | null {
  const raw = localStorage.getItem(
    `tar-recovery:${account.toLowerCase()}`,
  );

  if (!raw) return null;

  const parsed = JSON.parse(raw) as Omit<
    StoredRecoverySecret,
    "nonce"
  > & { nonce: string };

  return {
    ...parsed,
    nonce: BigInt(parsed.nonce),
  };
}
