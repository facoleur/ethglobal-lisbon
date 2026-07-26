import { concatHex, encodeAbiParameters, parseAbi, zeroAddress } from "viem";

export const kernelModuleAbi = parseAbi([
  "function installModule(uint256 moduleType, address module, bytes initData) payable",
  "function isModuleInstalled(uint256 moduleType, address module, bytes additionalContext) view returns (bool)",
  "function rootValidator() view returns (bytes21)",
]);

export const tarRecoveryExecutorAbi = parseAbi([
  "function updateRecoveryParams(uint256 lockValue, uint256 lockTime)",
  "function requestRecovery(bytes32 commitment)",
  "function revealRecovery(address addressToRecover, address broadcasterAddress, uint256 pubKeyX, uint256 pubKeyY, bytes32 salt) payable",
  "function challengeRecovery(address addressToRecover, bytes ownerSignature)",
  "function finalizeRecovery(address addressToRecover)",
  "function configs(address account) view returns (uint256 lockValue, uint256 lockTime)",
  "function pendingCommitments(bytes32 commitment) view returns (uint256 commitBlock)",
  "function recoveries(address account) view returns (address broadcasterAddress, uint256 newPubKeyX, uint256 newPubKeyY, uint256 stakedValue, uint256 revealTimestamp, uint8 status)",
  "function validator() view returns (address)",
  "function isInitialized(address smartAccount) view returns (bool)",
  "event RecoveryRequested(bytes32 indexed commitment)",
  "event RecoveryRevealed(address indexed addressToRecover, address indexed broadcasterAddress, uint256 challengeDeadline)",
  "event RecoveryRejected(address indexed addressToRecover)",
  "event RecoveryFinalized(address indexed addressToRecover)",
  "event RecoveryParamsUpdated(address indexed account, uint256 lockValue, uint256 lockTime)",
]);

export const tarRecoveryExecutorV2Abi = parseAbi([
  "error RecoveryNotRevealed(address account)",
  "error WatchTowerGroupNotConfigured()",
  "error ScopeMismatch()",
  "error InvalidWatchTowerProof()",
  "error TransferFailed()",
  "function regenerateWatchTowerGroup(uint256[] members)",
  "function challengeRecovery(address addressToRecover, (uint256 merkleTreeDepth, uint256 merkleTreeRoot, uint256 nullifier, uint256 message, uint256 scope, uint256[8] points) proof)",
  "function isInitialized(address smartAccount) view returns (bool)",
  "function configs(address account) view returns (uint256 lockValue, uint256 lockTime)",
  "function recoveries(address account) view returns (address broadcasterAddress, uint256 newPubKeyX, uint256 newPubKeyY, uint256 stakedValue, uint256 revealTimestamp, uint8 status)",
  "function epochOf(address account) view returns (uint256)",
  "function groupOf(address account) view returns (uint256)",
  "function semaphore() view returns (address)",
  "event WatchTowerGroupRegenerated(address indexed account, uint256 indexed groupId, uint256 memberCount, uint256 epoch)",
]);

export const semaphoreGroupsAbi = parseAbi([
  "function getMerkleTreeRoot(uint256 groupId) view returns (uint256)",
  "function getMerkleTreeDepth(uint256 groupId) view returns (uint256)",
  "function getMerkleTreeSize(uint256 groupId) view returns (uint256)",
  "function hasMember(uint256 groupId, uint256 identityCommitment) view returns (bool)",
  "event MembersAdded(uint256 indexed groupId, uint256 startIndex, uint256[] identityCommitments, uint256 merkleTreeRoot)",
]);

export const tarWebAuthnValidatorAbi = parseAbi([
  "function keyData(address account) view returns (uint256 pubKeyX, uint256 pubKeyY, bytes32 credentialIdHash, uint64 keyVersion)",
  "function isInitialized(address smartAccount) view returns (bool)",
]);

export type LockTimeUnit =
  "seconds" | "minutes" | "hours" | "days" | "weeks" | "months";

export function getTarExecutorInstallData(lockValue: bigint, lockTime: bigint) {
  const executorData = encodeAbiParameters(
    [{ type: "uint256" }, { type: "uint256" }],
    [lockValue, lockTime],
  );

  return concatHex([
    zeroAddress,
    encodeAbiParameters(
      [{ type: "bytes" }, { type: "bytes" }],
      [executorData, "0x"],
    ),
  ]);
}

const SECONDS_PER_UNIT: Record<LockTimeUnit, bigint> = {
  seconds: BigInt(1),
  minutes: BigInt(60),
  hours: BigInt(3_600),
  days: BigInt(86_400),
  weeks: BigInt(604_800),
  months: BigInt(2_592_000),
};

export function lockTimeToSeconds(value: number, unit: LockTimeUnit) {
  return BigInt(value) * SECONDS_PER_UNIT[unit];
}
