// MOCK — delete this file and replace with permissionless.js + Pimlico
// Ref: https://docs.pimlico.io/permissionless/how-to/accounts/use-kernel-account

export type PasskeyResult = {
  credentialId: string;
  accountAddress: `0x${string}`;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function registerPasskey(_name: string): Promise<PasskeyResult> {
  await new Promise((r) => setTimeout(r, 800));
  return {
    credentialId: "mock-credential-id",
    accountAddress: "0x000000000000000000000000000000000000dEaD",
  };
}

export async function loginPasskey(): Promise<PasskeyResult> {
  await new Promise((r) => setTimeout(r, 600));
  return {
    credentialId: "mock-credential-id",
    accountAddress: "0x000000000000000000000000000000000000dEaD",
  };
}
