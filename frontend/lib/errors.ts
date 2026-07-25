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
