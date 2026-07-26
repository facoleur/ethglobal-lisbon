import { startRegistration } from "@simplewebauthn/browser";
import { bytesToBigInt } from "viem";

type RegistrationOptions = Parameters<typeof startRegistration>[0];

type RegistrationOptionsWithPrf = RegistrationOptions & {
  extensions: NonNullable<RegistrationOptions["extensions"]> & {
    prf: {
      eval: {
        first: BufferSource;
      };
    };
  };
};

type PrfRegistrationResult = {
  prf?: {
    enabled?: boolean;
  };
};

type RegisterOptionsResponse = {
  options: RegistrationOptions;
  userId: string;
};

export class PasskeyPrfRegistrationError extends Error {
  constructor() {
    super("This device cannot create a PRF-enabled passkey.");
    this.name = "PasskeyPrfRegistrationError";
  }
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function registerPrfPasskey(
  passkeyName: string,
  passkeyServerUrl: string,
  rpId: string,
) {
  const optionsResponse = await fetch(`${passkeyServerUrl}/register/options`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: passkeyName, rpID: rpId }),
    credentials: "include",
  });
  if (!optionsResponse.ok) {
    throw new Error("Could not create passkey registration options.");
  }
  const registerOptions =
    (await optionsResponse.json()) as RegisterOptionsResponse;
  const prfOptions: RegistrationOptionsWithPrf = {
    ...registerOptions.options,
    extensions: {
      ...registerOptions.options.extensions,
      prf: {
        eval: { first: crypto.getRandomValues(new Uint8Array(32)) },
      },
    },
  };
  const credential = await startRegistration(prfOptions);
  const extensionResults =
    credential.clientExtensionResults as typeof credential.clientExtensionResults &
      PrfRegistrationResult;
  if (extensionResults.prf?.enabled !== true) {
    throw new PasskeyPrfRegistrationError();
  }

  const verifyResponse = await fetch(`${passkeyServerUrl}/register/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: registerOptions.userId,
      username: passkeyName,
      cred: credential,
      rpID: rpId,
    }),
    credentials: "include",
  });
  if (!verifyResponse.ok) {
    throw new Error("Could not verify passkey registration.");
  }
  const verification = (await verifyResponse.json()) as { verified?: boolean };
  if (!verification.verified) {
    throw new Error("Passkey registration was not verified.");
  }

  const encodedPublicKey = credential.response.publicKey;
  if (!encodedPublicKey) {
    throw new Error("No public key returned from passkey registration.");
  }
  const importedPublicKey = await crypto.subtle.importKey(
    "spki",
    decodeBase64Url(encodedPublicKey),
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"],
  );
  const rawPublicKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", importedPublicKey),
  );
  if (rawPublicKey.byteLength !== 65 || rawPublicKey[0] !== 4) {
    throw new Error("Invalid P-256 passkey public key.");
  }

  return {
    authenticatorId: credential.id,
    pubX: bytesToBigInt(rawPublicKey.slice(1, 33)),
    pubY: bytesToBigInt(rawPublicKey.slice(33, 65)),
  };
}
