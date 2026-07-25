# Spike results — WebAuthn (Kernel) + P-256 precompile

Date: 2026-07-25
Section: `context_v2b.md` (2b — Spikes WebAuthn / précompile P-256)
Environment: local Anvil devnet, chain id `31337`, `anvil 1.6.0-nightly` (commit `5e88010`), default hardfork (`latest`)
Contracts pinned: `kernel@v3.1` (`03f7f5c`), `kernel-7579-plugins@master` (`332deed`)
Scripts: `contracts/script/spike/SpikeWebAuthn.s.sol`, `contracts/script/spike/SpikeP256Precompile.s.sol`

## Go/no-go summary

| Chain  | Mechanism                              | Read (eth_call) | Real tx | Tx hash |
|--------|-----------------------------------------|:---:|:---:|---|
| Anvil  | P-256 precompile `0x0100` (RIP-7212)   | ✅ | ✅ | `0x6b10290dfcc425c4edb8bfbfddc60d2feb42b0b9ac000b89823a1f855c31bdfc` |
| Anvil  | WebAuthnValidator, `usePrecompiled=true`  | n/a | ✅ | `0x72b43b8a927e0df81c0c7ef7eec9eca2f3a423185d4dd55ed3d21de0afda25d1` |
| Anvil  | WebAuthnValidator, `usePrecompiled=false` (Solidity/FCL fallback) | n/a | ✅ | `0xd0a6151369169839503a121244e67ed095cacd8e24ca15fcfdf40d560a4e0021` |
| Sepolia | P-256 precompile `0x0100`              | ⏳ not run | ⏳ not run | — |
| Sepolia | WebAuthnValidator                       | n/a | ⏳ not run | — |

**GO for Anvil, on both mechanisms, in both toggle positions.** No fallback decision needed for the local devnet.

**Sepolia is not yet tested** — no funded account/RPC access was available in this session (see "Sepolia — not run" below). This is a real gap, not a silent skip: do not treat the Anvil result as covering Sepolia. Re-run before the demo per the plan's own instruction ("à relancer proche de la date de démo").

---

## Spike B — P-256 precompile (`0x0100`)

**Question:** is RIP-7212/EIP-7951 available in a real transaction on Anvil, not just in `eth_call`?

1. Anvil launched with `anvil --silent` (no `--hardfork` override → defaults to `latest`).
2. Raw `eth_call` on `0x0000000000000000000000000000000000000100` with a known-valid P-256 test vector (message hash `keccak256("RIP-7212 spike test vector")`, key/signature generated with Foundry's native `vm.publicKeyP256`/`vm.signP256` cheatcodes) returned `0x00...01` — valid.
3. Deployed `contracts/src/spike/P256Probe.sol` (does `.call()`, not `.staticcall()`, against the precompile and emits the raw result) and invoked it via a broadcasted transaction.
   - Tx `0x6b10290dfcc425c4edb8bfbfddc60d2feb42b0b9ac000b89823a1f855c31bdfc`, status `success`.
   - `P256Result` event: `success=true, valid=true`.

**Result: ✅ the precompile works identically in `eth_call` and in a real transaction on this Anvil build.**

### Important caveat found during this spike

`forge script`'s own **local pre-broadcast simulation** of any call that hits the P-256 precompile gives the **wrong answer** (reports the signature as invalid) even when the real chain accepts it. This was reproduced twice, independently:
- `SpikeP256Precompile.s.sol`'s own `console2.log` printed `precompile signature valid: false` during its local run, while the actual on-chain event for the exact same transaction shows `valid: true`.
- A standalone diagnostic (`script/spike/DiagnoseWebAuthn.s.sol`) calling `P256.verifySignature(...)` directly, locally, also reported `false` for a signature that later verified fine in a real broadcasted `handleOps` call.

Root cause (as far as this spike went): forge's own internal EVM used to plan/simulate a script's transactions before broadcasting appears to emulate the P-256 precompile differently (and incorrectly) compared to the actual Anvil node executing the real transaction. This is exactly the class of trap `brainstorming.md` already flagged ("des implémentations récentes renvoient un succès en lecture mais échouent en tx réelle") — here the direction is reversed (local simulation fails, real tx succeeds), which is arguably worse: a naive read of `forge script` console output would wrongly conclude the precompile doesn't work.

**Practical consequence:** any future work touching this precompile must verify results against the *real broadcasted transaction and on-chain state* (event logs, `cast call` against deployed contracts), never against `forge script`'s own local simulation/log output alone. `SpikeWebAuthn.s.sol` was restructured around this: it only *builds and prints* the final `handleOps` calldata locally, then that calldata is submitted with `cast send` directly to the RPC endpoint, bypassing forge's flawed local simulation entirely.

---

## Spike A — WebAuthnValidator (Kernel)

**Question:** does Kernel's WebAuthn validator actually work in a real transaction, with no ECDSA involved at all?

Setup (`SpikeWebAuthn.s.sol`, reusing the same `EntryPointLib.deploy()` / factory pattern as section 2a, but with `WebAuthnValidator` — from `kernel-7579-plugins`, not kernel's own bundled validators — as the account's ROOT validator instead of `ECDSAValidator`):

1. Deployed `WebAuthnValidator` from `lib/kernel-7579-plugins/src/validators/WebAuthnValidator.sol`.
2. Generated a test P-256 keypair with `vm.publicKeyP256` (no real authenticator/Secure Enclave — as explicitly allowed by the section's scope).
3. Computed the counterfactual Kernel account address via `KernelFactory.getAddress(...)`, with `WebAuthnValidator` as root and the test public key as `validatorData`.
4. Built a byte-for-byte realistic `authenticatorData` (37 bytes, `UP|UV` flags set) and `clientDataJSON` (`{"type":"webauthn.get","challenge":"<base64url(userOpHash)>","origin":"...","crossOrigin":false}` — the exact shape a real browser produces, since `WebAuthnValidator`'s fixed `CHALLENGE_LOCATION=23` only works with this precise prefix), computed `sha256(authenticatorData || sha256(clientDataJSON))`, and signed that digest with the test P-256 key.
5. Sent the signed deployment `UserOperation` through `EntryPoint.handleOps` as a genuine transaction (self-relayed from an EOA, no bundler) — via `cast send` directly, per the caveat above.
6. Verified on-chain, independently of the script's own output, with `cast call`/`cast receipt`.

### Result — `usePrecompiled=true`

- Kernel account: `0x811CcA3E6431C6ade3cd560a156521383EbCb900`
- Tx: `0x72b43b8a927e0df81c0c7ef7eec9eca2f3a423185d4dd55ed3d21de0afda25d1`, status `success`, `gasUsed=388325`
- `cast call ... "rootValidator()(bytes21)"` → `0x01cf7ed3acca5a467e9e704c703e8d87f634fb0fc9` (type-validator prefix `0x01` + the deployed `WebAuthnValidator` address) — confirms it, not a fallback/default, is genuinely the root validator that authorized this deployment.

### Result — `usePrecompiled=false` (Solidity/FCL-style fallback)

The fallback path calls a fixed address (`P256.DAIMO_VERIFIER = 0xc2b78104907F722DABAc4C69f826a522B2754De4`), which isn't predeployed on a vanilla Anvil instance. For this local spike, the vendored `contracts/lib/kernel-7579-plugins/src/utils/P256Verifier.sol` (Ledger/FreshCryptoLib-based, same one the toggle falls back to in production) was deployed normally and then copied onto that exact address with Anvil's dev-only `anvil_setCode` RPC — real EC math, not a stub, just placed at the expected address without going through the canonical multi-chain deterministic-deployment history it has on public networks.

- Kernel account: `0xa1Ac0B1f9D2a28e93Fba803AA4809c134a6Da1e0`
- Tx: `0xd0a6151369169839503a121244e67ed095cacd8e24ca15fcfdf40d560a4e0021`, status `success`, `gasUsed=897333`
- `rootValidator()` confirmed as the deployed `WebAuthnValidator`, same as above.

Pure-Solidity verification costs **~2.3× the gas** of the precompile path (897k vs 388k gas for the whole deployment UserOp) — expected, but useful as a concrete number if/when deciding whether the fallback is viable for a live demo budget.

**Result: ✅ WebAuthnValidator works in a real transaction, in both toggle positions, on Anvil.**

### The precompile/Solidity toggle

Confirmed present, and it is **more flexible than a stored "default"**: `usePrecompiled` is a `bool` encoded directly inside each WebAuthn signature blob (`abi.encode(authenticatorData, clientDataJSON, responseTypeLocation, r, s, usePrecompiled)`), decoded and consumed per call in `WebAuthnValidator._verifySignature` → `WebAuthn.verifySignature` → `P256.verifySignature`. There is no contract-level stored toggle/default to report — whoever builds the `UserOperation` (in production: the frontend/SDK) picks precompile-or-fallback fresh on every signature. This matches the "duo mode" pattern `context_v2b.md` asked to check for, and gives section 3 a ready-made fallback lever with zero extra contract work: if the precompile turns out unavailable on the real target chain, flipping `usePrecompiled` to `false` in the signing code is enough, no redeployment needed.

---

## Sepolia — not run

No Sepolia RPC endpoint or funded private key was available in this session/sandbox, so nothing above was executed against Sepolia. This is **not** a "no-go" — it's simply untested. Do not infer Sepolia behavior from the Anvil results; RIP-7212/EIP-7951 precompile availability is chain- and client-version-specific, which is exactly why the plan calls for testing it independently, close to the demo date.

To run it when a funded Sepolia key is available:

```bash
export RELAYER_PRIVATE_KEY=0x...   # funded Sepolia EOA
export OWNER_PRIVATE_KEY=0x...     # optional, only used by the 2a ECDSA script

# Spike B — precompile
forge script script/spike/SpikeP256Precompile.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast

# Spike A — WebAuthn (run once per toggle position)
USE_PRECOMPILED_P256=true  forge script script/spike/SpikeWebAuthn.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast
USE_PRECOMPILED_P256=false forge script script/spike/SpikeWebAuthn.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast
```

Because of the local-simulation caveat above, `SpikeWebAuthn.s.sol` does not call `EntryPoint.handleOps` itself — it deploys the infra (EntryPoint/Kernel impl/factory/validator) under `--broadcast`, then prints the exact `handleOps` calldata. Submit that calldata with `cast send <entrypoint> <calldata> --private-key $RELAYER_PRIVATE_KEY --rpc-url $SEPOLIA_RPC_URL`, then verify independently with `cast call <kernel-account> "rootValidator()(bytes21)"` and `cast receipt <tx-hash> status` — do not trust the script's own console output for the P-256-dependent steps.

On Sepolia, the Solidity-fallback path (`usePrecompiled=false`) should work without any extra setup: Daimo's `P256Verifier` is already deployed at the canonical `0xc2b78104907F722DABAc4C69f826a522B2754De4` address there (unlike on a fresh Anvil instance, which needed the `anvil_setCode` workaround above) — no need to redeploy or `anvil_setCode` it.

## Fallback decision

Not needed for Anvil (both mechanisms went ✅ on real transactions, both toggle positions). If Sepolia's precompile check comes back negative, the fallback is already validated and requires no contract changes: use `WebAuthnValidator` with `usePrecompiled=false` (Solidity/FCL verification via `P256Verifier.sol`), same contracts, same account, ~2.3× the verification gas cost.
