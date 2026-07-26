import { getAddress, isAddress, type Address } from "viem";
import { WATCH_TOWER_IDENTITY_COUNT } from "@/lib/watch-tower-identity";

export const WATCH_TOWER_ENROLLMENT_VERSION = 1;

const FRAME_PREFIX = "tar-wt1";
const FRAME_CHUNK_SIZE = 450;
const MAX_FRAME_COUNT = 32;
const UINT256_MAX = BigInt(2) ** BigInt(256) - BigInt(1);

type EnrollmentEnvelope = {
  a: Address;
  c: number;
  i: string;
  k: string;
  t: number;
  v: typeof WATCH_TOWER_ENROLLMENT_VERSION;
};

export type WatchTowerEnrollment = {
  chainId: number;
  commitments: string[];
  createdAt: number;
  protectedWallet: Address;
  relationshipId: string;
  version: typeof WATCH_TOWER_ENROLLMENT_VERSION;
};

export type WatchTowerQrCollection = {
  batchId: string | null;
  checksum: string | null;
  chunks: Record<number, string>;
  total: number;
};

type ParsedFrame = {
  batchId: string;
  checksum: string;
  chunk: string;
  index: number;
  total: number;
};

export type WatchTowerQrCollectionResult = {
  collection: WatchTowerQrCollection;
  enrollment: WatchTowerEnrollment | null;
  received: number;
  total: number;
};

export class InvalidWatchTowerQrError extends Error {
  constructor(message = "Invalid watch tower enrollment QR code.") {
    super(message);
    this.name = "InvalidWatchTowerQrError";
  }
}

function encodeUtf8(value: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(value);
}

function encodeBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");

  try {
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new InvalidWatchTowerQrError();
  }
}

async function checksum(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encodeUtf8(value));
  return encodeBase64Url(new Uint8Array(digest));
}

function serializeCommitments(commitments: string[]): string {
  if (commitments.length !== WATCH_TOWER_IDENTITY_COUNT) {
    throw new InvalidWatchTowerQrError(
      `Expected ${WATCH_TOWER_IDENTITY_COUNT} Semaphore commitments.`,
    );
  }

  const bytes = new Uint8Array(commitments.length * 32);
  commitments.forEach((commitment, commitmentIndex) => {
    let value: bigint;
    try {
      value = BigInt(commitment);
    } catch {
      throw new InvalidWatchTowerQrError("Invalid Semaphore commitment.");
    }
    if (value <= BigInt(0) || value > UINT256_MAX) {
      throw new InvalidWatchTowerQrError("Invalid Semaphore commitment.");
    }

    for (let byteIndex = 31; byteIndex >= 0; byteIndex -= 1) {
      bytes[commitmentIndex * 32 + byteIndex] = Number(value & BigInt(255));
      value >>= BigInt(8);
    }
  });

  return encodeBase64Url(bytes);
}

function deserializeCommitments(encoded: string): string[] {
  const bytes = decodeBase64Url(encoded);
  if (bytes.byteLength !== WATCH_TOWER_IDENTITY_COUNT * 32) {
    throw new InvalidWatchTowerQrError("Invalid commitment pool size.");
  }

  return Array.from({ length: WATCH_TOWER_IDENTITY_COUNT }, (_, index) => {
    let value = BigInt(0);
    for (let offset = 0; offset < 32; offset += 1) {
      value = (value << BigInt(8)) | BigInt(bytes[index * 32 + offset]);
    }
    if (value === BigInt(0)) {
      throw new InvalidWatchTowerQrError("Invalid Semaphore commitment.");
    }
    return value.toString();
  });
}

function serializeEnrollment(enrollment: WatchTowerEnrollment): string {
  if (
    enrollment.version !== WATCH_TOWER_ENROLLMENT_VERSION ||
    !Number.isSafeInteger(enrollment.chainId) ||
    enrollment.chainId <= 0 ||
    !Number.isSafeInteger(enrollment.createdAt) ||
    enrollment.createdAt <= 0 ||
    !enrollment.relationshipId ||
    !isAddress(enrollment.protectedWallet)
  ) {
    throw new InvalidWatchTowerQrError();
  }

  const envelope: EnrollmentEnvelope = {
    a: getAddress(enrollment.protectedWallet),
    c: enrollment.chainId,
    i: enrollment.relationshipId,
    k: serializeCommitments(enrollment.commitments),
    t: enrollment.createdAt,
    v: WATCH_TOWER_ENROLLMENT_VERSION,
  };
  return JSON.stringify(envelope);
}

function deserializeEnrollment(value: string): WatchTowerEnrollment {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new InvalidWatchTowerQrError();
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new InvalidWatchTowerQrError();
  }
  const envelope = parsed as Partial<EnrollmentEnvelope>;

  if (
    envelope.v !== WATCH_TOWER_ENROLLMENT_VERSION ||
    typeof envelope.c !== "number" ||
    !Number.isSafeInteger(envelope.c) ||
    envelope.c <= 0 ||
    typeof envelope.t !== "number" ||
    !Number.isSafeInteger(envelope.t) ||
    envelope.t <= 0 ||
    typeof envelope.i !== "string" ||
    !envelope.i ||
    typeof envelope.a !== "string" ||
    !isAddress(envelope.a) ||
    typeof envelope.k !== "string"
  ) {
    throw new InvalidWatchTowerQrError();
  }

  return {
    chainId: envelope.c,
    commitments: deserializeCommitments(envelope.k),
    createdAt: envelope.t,
    protectedWallet: getAddress(envelope.a),
    relationshipId: envelope.i,
    version: WATCH_TOWER_ENROLLMENT_VERSION,
  };
}

function parseFrame(value: string): ParsedFrame {
  const match = value.match(/^tar-wt1:([^:]+):(\d+):(\d+):([^:]+):(.*)$/);
  if (!match) throw new InvalidWatchTowerQrError();

  const [, batchId, rawIndex, rawTotal, frameChecksum, chunk] = match;
  const index = Number(rawIndex);
  const total = Number(rawTotal);
  if (
    !batchId ||
    !frameChecksum ||
    !chunk ||
    !Number.isSafeInteger(index) ||
    !Number.isSafeInteger(total) ||
    index < 1 ||
    index > total ||
    total < 1 ||
    total > MAX_FRAME_COUNT
  ) {
    throw new InvalidWatchTowerQrError();
  }

  return { batchId, checksum: frameChecksum, chunk, index, total };
}

export function createEmptyWatchTowerQrCollection(): WatchTowerQrCollection {
  return { batchId: null, checksum: null, chunks: {}, total: 0 };
}

export async function createWatchTowerEnrollmentFrames(
  enrollment: WatchTowerEnrollment,
): Promise<string[]> {
  const serialized = serializeEnrollment(enrollment);
  const enrollmentChecksum = await checksum(serialized);
  const batchId = enrollmentChecksum.slice(0, 12);
  const chunks = Array.from(
    { length: Math.ceil(serialized.length / FRAME_CHUNK_SIZE) },
    (_, index) =>
      serialized.slice(
        index * FRAME_CHUNK_SIZE,
        (index + 1) * FRAME_CHUNK_SIZE,
      ),
  );
  if (chunks.length > MAX_FRAME_COUNT) {
    throw new InvalidWatchTowerQrError("Enrollment payload is too large.");
  }

  return chunks.map(
    (chunk, index) =>
      `${FRAME_PREFIX}:${batchId}:${index + 1}:${chunks.length}:${enrollmentChecksum}:${chunk}`,
  );
}

export async function collectWatchTowerEnrollmentFrame(
  collection: WatchTowerQrCollection,
  value: string,
): Promise<WatchTowerQrCollectionResult> {
  const frame = parseFrame(value);
  if (
    collection.batchId !== null &&
    (collection.batchId !== frame.batchId ||
      collection.checksum !== frame.checksum ||
      collection.total !== frame.total)
  ) {
    throw new InvalidWatchTowerQrError(
      "This frame belongs to another enrollment batch.",
    );
  }

  const nextCollection: WatchTowerQrCollection = {
    batchId: frame.batchId,
    checksum: frame.checksum,
    chunks: { ...collection.chunks, [frame.index]: frame.chunk },
    total: frame.total,
  };
  const received = Object.keys(nextCollection.chunks).length;
  if (received !== nextCollection.total) {
    return {
      collection: nextCollection,
      enrollment: null,
      received,
      total: nextCollection.total,
    };
  }

  const serialized = Array.from(
    { length: nextCollection.total },
    (_, index) => nextCollection.chunks[index + 1],
  ).join("");
  if ((await checksum(serialized)) !== nextCollection.checksum) {
    throw new InvalidWatchTowerQrError("Enrollment checksum mismatch.");
  }

  return {
    collection: nextCollection,
    enrollment: deserializeEnrollment(serialized),
    received,
    total: nextCollection.total,
  };
}
