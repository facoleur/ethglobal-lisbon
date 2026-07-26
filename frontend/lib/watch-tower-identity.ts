import { Identity } from "@semaphore-protocol/identity";
import { getAddress, type Address } from "viem";

export const WATCH_TOWER_IDENTITY_COUNT = 100;

const PRF_DOMAIN = "tar-watchtower-prf-v1";
const IDENTITY_DOMAIN = "tar-watchtower-identity-v1";

type PrfExtensionInput = {
  prf: {
    eval: {
      first: BufferSource;
    };
  };
};

type PrfExtensionOutput = {
  prf?: {
    results?: {
      first?: ArrayBuffer;
    };
  };
};

export type WatchTowerIdentityContext = {
  chainId: number;
  credentialId: string;
  protectedWallet: Address;
  relationshipId: string;
  rpId: string;
};

export class PasskeyPrfUnavailableError extends Error {
  constructor() {
    super("This passkey does not support WebAuthn PRF.");
    this.name = "PasskeyPrfUnavailableError";
  }
}

function encodeUtf8(value: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(value);
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function normalizeContext(
  context: WatchTowerIdentityContext,
): WatchTowerIdentityContext {
  if (!Number.isSafeInteger(context.chainId) || context.chainId <= 0) {
    throw new Error("Invalid watch tower chain ID.");
  }
  if (!context.credentialId || !context.rpId || !context.relationshipId) {
    throw new Error("Incomplete watch tower identity context.");
  }

  return {
    ...context,
    protectedWallet: getAddress(context.protectedWallet),
  };
}

function encodeContext(
  context: WatchTowerIdentityContext,
): Uint8Array<ArrayBuffer> {
  const normalized = normalizeContext(context);
  return encodeUtf8(
    [
      PRF_DOMAIN,
      normalized.chainId.toString(),
      normalized.protectedWallet.toLowerCase(),
      normalized.relationshipId,
    ].join(":"),
  );
}

async function sha256(value: BufferSource): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", value));
}

export function createWatchTowerRelationshipId(): string {
  return crypto.randomUUID();
}

export async function requestPasskeyPrf(
  context: WatchTowerIdentityContext,
): Promise<Uint8Array<ArrayBuffer>> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    throw new PasskeyPrfUnavailableError();
  }

  const normalized = normalizeContext(context);
  const prfSalt = await sha256(encodeContext(normalized));
  const extensions: AuthenticationExtensionsClientInputs & PrfExtensionInput = {
    prf: { eval: { first: prfSalt } },
  };
  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    rpId: normalized.rpId,
    allowCredentials: [
      {
        id: decodeBase64Url(normalized.credentialId),
        type: "public-key",
      },
    ],
    userVerification: "required",
    extensions,
  };

  const credential = await navigator.credentials.get({ publicKey });
  if (!(credential instanceof PublicKeyCredential)) {
    throw new PasskeyPrfUnavailableError();
  }

  const extensionResults =
    credential.getClientExtensionResults() as AuthenticationExtensionsClientOutputs &
      PrfExtensionOutput;
  const output = extensionResults.prf?.results?.first;
  if (!output) throw new PasskeyPrfUnavailableError();

  return new Uint8Array(output);
}

export async function deriveWatchTowerIdentitiesFromPrf(
  prfOutput: Uint8Array<ArrayBuffer>,
  context: Omit<WatchTowerIdentityContext, "credentialId" | "rpId">,
  count = WATCH_TOWER_IDENTITY_COUNT,
): Promise<Identity[]> {
  if (prfOutput.byteLength !== 32) {
    throw new Error("Invalid WebAuthn PRF output.");
  }
  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new Error("Invalid Semaphore identity count.");
  }

  const normalized = normalizeContext({
    ...context,
    credentialId: "derived",
    rpId: "derived",
  });
  const key = await crypto.subtle.importKey("raw", prfOutput, "HKDF", false, [
    "deriveBits",
  ]);
  const salt = await sha256(encodeContext(normalized));

  return Promise.all(
    Array.from({ length: count }, async (_, index) => {
      const privateKey = await crypto.subtle.deriveBits(
        {
          name: "HKDF",
          hash: "SHA-256",
          salt,
          info: encodeUtf8(`${IDENTITY_DOMAIN}:${index}`),
        },
        key,
        256,
      );

      return new Identity(new Uint8Array(privateKey));
    }),
  );
}

export async function deriveWatchTowerIdentityPool(
  context: WatchTowerIdentityContext,
): Promise<Identity[]> {
  const normalized = normalizeContext(context);
  const prfOutput = await requestPasskeyPrf(normalized);

  return deriveWatchTowerIdentitiesFromPrf(prfOutput, normalized);
}

export async function deriveWatchTowerCommitments(
  context: WatchTowerIdentityContext,
): Promise<string[]> {
  const identities = await deriveWatchTowerIdentityPool(context);
  return identities.map((identity) => identity.commitment.toString());
}
