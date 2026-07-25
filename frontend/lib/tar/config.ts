import type { Address } from "viem";

function requiredAddress(
  name: string,
  value: string | undefined,
): Address {
  const normalized = value?.trim();

  if (!normalized?.startsWith("0x")) {
    throw new Error(`${name} is not configured`);
  }

  return normalized as Address;
}

export function getTarAddresses() {
  return {
    timelockRecovery: requiredAddress(
      "NEXT_PUBLIC_TIMELOCK_RECOVERY_ADDRESS",
      process.env.NEXT_PUBLIC_TIMELOCK_RECOVERY_ADDRESS,
    ),
    rotatableWebAuthnValidator: requiredAddress(
      "NEXT_PUBLIC_ROTATABLE_WEBAUTHN_VALIDATOR_ADDRESS",
      process.env
        .NEXT_PUBLIC_ROTATABLE_WEBAUTHN_VALIDATOR_ADDRESS,
    ),
  };
}
