export const timelockRecoveryAbi = [
  {
    type: "function",
    name: "nextRecoveryNonce",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    type: "function",
    name: "computeCommitment",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "claimant", type: "address" },
      { name: "newValidator", type: "address" },
      { name: "newValidatorData", type: "bytes" },
      { name: "salt", type: "bytes32" },
      { name: "nonce", type: "uint64" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "commitRecovery",
    stateMutability: "payable",
    inputs: [
      { name: "account", type: "address" },
      { name: "commitment", type: "bytes32" },
      { name: "nonce", type: "uint64" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "revealRecovery",
    stateMutability: "nonpayable",
    inputs: [
      { name: "account", type: "address" },
      { name: "newValidator", type: "address" },
      { name: "newValidatorData", type: "bytes" },
      { name: "salt", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "vetoRecovery",
    stateMutability: "nonpayable",
    inputs: [{ name: "account", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "expireCommitment",
    stateMutability: "nonpayable",
    inputs: [{ name: "account", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "finalizeRecovery",
    stateMutability: "nonpayable",
    inputs: [{ name: "account", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getAccountConfig",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "validator", type: "address" },
          { name: "vetoer", type: "address" },
          { name: "enabled", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getRecovery",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "commitment", type: "bytes32" },
          { name: "claimant", type: "address" },
          { name: "newValidator", type: "address" },
          { name: "newValidatorData", type: "bytes" },
          { name: "committedAt", type: "uint48" },
          { name: "executableAt", type: "uint48" },
          { name: "deposit", type: "uint96" },
          { name: "nonce", type: "uint64" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
  },
  {
    type: "event",
    name: "RecoveryCommitted",
    inputs: [
      { indexed: true, name: "account", type: "address" },
      { indexed: true, name: "claimant", type: "address" },
      { indexed: false, name: "commitment", type: "bytes32" },
      { indexed: false, name: "nonce", type: "uint64" },
      { indexed: false, name: "deposit", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "RecoveryRevealed",
    inputs: [
      { indexed: true, name: "account", type: "address" },
      { indexed: true, name: "newValidator", type: "address" },
      { indexed: true, name: "newPasskeyHash", type: "bytes32" },
      { indexed: false, name: "executableAt", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "RecoveryVetoed",
    inputs: [
      { indexed: true, name: "account", type: "address" },
      { indexed: true, name: "vetoedBy", type: "address" },
    ],
  },
  {
    type: "event",
    name: "RecoveryFinalized",
    inputs: [
      { indexed: true, name: "account", type: "address" },
      { indexed: true, name: "newValidator", type: "address" },
      { indexed: true, name: "newPasskeyHash", type: "bytes32" },
    ],
  },
] as const;

export const rotatableWebAuthnValidatorAbi = [
  {
    type: "function",
    name: "keyData",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [
      { name: "pubKeyX", type: "uint256" },
      { name: "pubKeyY", type: "uint256" },
      { name: "credentialIdHash", type: "bytes32" },
      { name: "keyVersion", type: "uint64" },
    ],
  },
  {
    type: "event",
    name: "WebAuthnKeyRotated",
    inputs: [
      { indexed: true, name: "account", type: "address" },
      { indexed: true, name: "keyVersion", type: "uint64" },
      { indexed: false, name: "pubKeyX", type: "uint256" },
      { indexed: false, name: "pubKeyY", type: "uint256" },
      { indexed: false, name: "credentialIdHash", type: "bytes32" },
    ],
  },
] as const;

export const kernelModuleAbi = [
  {
    type: "function",
    name: "installModule",
    stateMutability: "payable",
    inputs: [
      { name: "moduleType", type: "uint256" },
      { name: "module", type: "address" },
      { name: "initData", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "isModuleInstalled",
    stateMutability: "view",
    inputs: [
      { name: "moduleType", type: "uint256" },
      { name: "module", type: "address" },
      { name: "additionalContext", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;
