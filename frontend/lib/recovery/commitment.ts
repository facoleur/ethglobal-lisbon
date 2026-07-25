import { encodePacked, keccak256, toHex, type Address, type Hex } from "viem";

type RecoveryCommitmentParameters = {
  addressToRecover: Address;
  broadcasterAddress: Address;
  pubKeyX: Hex;
  pubKeyY: Hex;
  salt: Hex;
};

export function generateRecoverySalt(): Hex {
  return toHex(crypto.getRandomValues(new Uint8Array(32)), { size: 32 });
}

export function computeRecoveryCommitment({
  addressToRecover,
  broadcasterAddress,
  pubKeyX,
  pubKeyY,
  salt,
}: RecoveryCommitmentParameters): Hex {
  return keccak256(
    encodePacked(
      ["address", "address", "uint256", "uint256", "bytes32"],
      [
        addressToRecover,
        broadcasterAddress,
        BigInt(pubKeyX),
        BigInt(pubKeyY),
        salt,
      ],
    ),
  );
}
