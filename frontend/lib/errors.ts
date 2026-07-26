export function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error("Unexpected wallet error.");
}

export function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "shortMessage" in error &&
    typeof error.shortMessage === "string"
  ) {
    return error.shortMessage;
  }

  return normalizeError(error).message;
}

const REVOKED_PASSKEY_PATTERNS = [
  /AA24/i,
  /invalid\s+signature/i,
  /unauthorized/i,
  /not\s+authorized/i,
  /signature\s+error/i,
  /revoked/i,
];

function extractErrorText(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return normalizeError(error).message;
  }

  const parts: string[] = [];

  if ("shortMessage" in error && typeof error.shortMessage === "string") {
    parts.push(error.shortMessage);
  }
  if ("message" in error && typeof error.message === "string") {
    parts.push(error.message);
  }
  if ("details" in error && typeof error.details === "string") {
    parts.push(error.details);
  }

  return parts.join(" ");
}

export function isRevokedPasskeyError(error: unknown): boolean {
  const text = extractErrorText(error);
  return REVOKED_PASSKEY_PATTERNS.some((pattern) => pattern.test(text));
}

export function getTransactionErrorMessage(
  error: unknown,
  revokedPasskeyMessage: string,
): string {
  if (isRevokedPasskeyError(error)) {
    return revokedPasskeyMessage;
  }
  return getErrorMessage(error);
}
