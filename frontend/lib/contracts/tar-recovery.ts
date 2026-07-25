import { concatHex, encodeAbiParameters, parseAbi, zeroAddress } from "viem";

export const kernelModuleAbi = parseAbi([
  "function installModule(uint256 moduleType, address module, bytes initData) payable",
  "function isModuleInstalled(uint256 moduleType, address module, bytes additionalContext) view returns (bool)",
]);

export const tarRecoveryExecutorAbi = parseAbi([
  "function updateRecoveryParams(uint256 lockValue, uint256 lockTime)",
  "function requestRecovery(bytes32 commitment)",
  "function revealRecovery(address addressToRecover, address broadcasterAddress, bytes32 pubKeyX, bytes32 pubKeyY, bytes32 salt) payable",
  "function challengeRecovery(address addressToRecover, bytes ownerSignature)",
  "function finalizeRecovery(address addressToRecover)",
  "function configs(address account) view returns (uint256 lockValue, uint256 lockTime)",
  "function recoveries(address account) view returns (address broadcasterAddress, uint256 stakedValue, uint256 revealTimestamp, uint8 status)",
  "event RecoveryRequested(bytes32 indexed commitment)",
  "event RecoveryRevealed(address indexed addressToRecover, address indexed broadcasterAddress, uint256 challengeDeadline)",
  "event RecoveryRejected(address indexed addressToRecover)",
  "event RecoveryFinalized(address indexed addressToRecover)",
  "event RecoveryParamsUpdated(address indexed account, uint256 lockValue, uint256 lockTime)",
]);

export type LockTimeUnit = "days" | "weeks" | "months";

export const tarExecutorInstallData = concatHex([
  zeroAddress,
  encodeAbiParameters([{ type: "bytes" }, { type: "bytes" }], ["0x", "0x"]),
]);

const SECONDS_PER_UNIT: Record<LockTimeUnit, bigint> = {
  days: BigInt(86_400),
  weeks: BigInt(604_800),
  months: BigInt(2_592_000),
};

export function lockTimeToSeconds(value: number, unit: LockTimeUnit) {
  return BigInt(value) * SECONDS_PER_UNIT[unit];
}
