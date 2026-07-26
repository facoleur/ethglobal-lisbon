# Context — Milestone A : Squelette du module `TARRecoveryExecutor` + config

## Objectif

Poser la structure complète du module (types, storage, boilerplate ERC-7579, configuration) sur laquelle les Milestones B/C viendront ajouter la logique métier (commit-reveal, challenge, finalize) sans avoir à retoucher les fondations.

## Hors scope explicite pour cette milestone

- **Aucune logique métier** : `requestRecovery`, `revealRecovery`, `challengeRecovery`, `finalizeRecovery` sont déclarées (conformité à `ITARRecovery`) mais **stubbées** — elles revert avec une erreur explicite, pas d'implémentation réelle. C'est le contenu de la Milestone B.
- **Aucun validator, aucun mock de validator** : rien dans cette milestone n'appelle `executeFromExecutor`.
- **Aucune vraie intégration Kernel** : tests contre un mock de compte ERC-7579 (`modulekit` ou mock minimal), pas contre un `KernelFactory` réel — c'est la Milestone E.
- **Pas de WebAuthn** : `RecoveryRequest` utilise déjà le champ `newSigner` (format ECDSA, Milestone B) — ne pas anticiper `(pubKeyX, pubKeyY)` (Milestone C).

## Prérequis

Section 1 terminée (dépendances Foundry installées : `forge-std`, `openzeppelin-contracts`, `account-abstraction`, `kernel`, `kernel-7579-plugins`). Branche de travail : nouvelle branche depuis `main` (post section 2a/2b mergées), indépendante de 2a/2b — voir échange précédent.

## Fichiers à créer

```
smart-contract/
  src/
    TARRecoveryExecutor.sol
    interfaces/ITARRecovery.sol
  test/
    unit/TARRecoveryExecutorLifecycle.t.sol
```

## Types et storage

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

enum RecoveryStatus {
    None,       // aucune recovery en cours sur ce compte
    Revealed,   // reveal effectué, fenêtre de challenge (lockTime) ouverte
    Rejected,   // rejetée par l'owner, stake reversé à addressToRecover
    Finalized   // finalisée, nouveau signer installé, stake reversé à addressToRecover
}

struct RecoveryConfig {
    uint256 lockValue;
    uint256 lockTime;
}

// Forme Milestone B (ECDSA temporaire). Deviendra newPubKeyX/newPubKeyY (uint256)
// à la Milestone C — ne pas anticiper ce changement ici.
struct RecoveryRequest {
    address broadcasterAddress;
    address newSigner;
    uint256 stakedValue;
    uint256 revealTimestamp;
    RecoveryStatus status;
}
```

```solidity
mapping(address => RecoveryConfig) public configs;          // configs[account]
mapping(bytes32 => bool) public pendingCommitments;          // existence uniquement
mapping(address => RecoveryRequest) public recoveries;        // clé = addressToRecover
```

Pas de mapping `activeRecovery` séparé : `recoveries[account].status == RecoveryStatus.Revealed` est la garde active-recovery (utilisée à partir de la Milestone B).

## Interface `ITARRecovery`

```solidity
interface ITARRecovery is IERC7579Module {
    function updateRecoveryParams(uint256 lockValue, uint256 lockTime) external;
    function requestRecovery(bytes32 commitment) external;
    function revealRecovery(
        address addressToRecover,
        address broadcasterAddress,
        address newSigner,
        bytes32 salt
    ) external payable;
    function challengeRecovery(address addressToRecover, bytes calldata ownerSignature) external;
    function finalizeRecovery(address addressToRecover) external;
}
```

`IERC7579Module` (vérifié contre `erc7579/erc7579-implementation`, le repo de référence cité par l'EIP — à revérifier contre l'import réel utilisé, `kernel` ou `kernel-7579-plugins` peuvent exposer une variante légèrement différente) :
```solidity
interface IERC7579Module {
    function onInstall(bytes calldata data) external;
    function onUninstall(bytes calldata data) external;
    function isModuleType(uint256 moduleTypeId) external view returns (bool);
    function isInitialized(address smartAccount) external view returns (bool);
}
```

## Events et erreurs

```solidity
event RecoveryParamsUpdated(address indexed account, uint256 lockValue, uint256 lockTime);

error AlreadyInitialized(address account);
error NotInitialized(address account);
error InvalidRecoveryParams();      // lockValue == 0 ou lockTime == 0
error ActiveRecoveryExists(address account);  // onUninstall pendant une recovery Revealed
error NotImplementedYet();          // stubs des fonctions métier, retirée au fur et à mesure des Milestones B/C
```

Pas d'autres events à cette milestone (`RecoveryRequested`, `RecoveryRevealed`, `RecoveryRejected`, `RecoveryFinalized` arrivent avec la logique métier de la Milestone B).

## Fonctions à implémenter

### `onInstall`
```solidity
function onInstall(bytes calldata data) external {
    if (_isInitialized(msg.sender)) revert AlreadyInitialized(msg.sender);
    (uint256 lockValue, uint256 lockTime) = abi.decode(data, (uint256, uint256));
    if (lockValue == 0 || lockTime == 0) revert InvalidRecoveryParams();
    configs[msg.sender] = RecoveryConfig(lockValue, lockTime);
    emit RecoveryParamsUpdated(msg.sender, lockValue, lockTime);
}
```
`msg.sender` est le compte lui-même (appelé par le compte via `installModule`) — pas de paramètre `account`, même pattern que `WebAuthnValidator.onInstall`.

**Hypothèse posée ici, à valider** : `lockValue == 0` et `lockTime == 0` sont rejetés comme configuration invalide (un `lockTime` nul viderait le sens du timelock, un `lockValue` nul viderait le sens du stake confiscable). Si l'équipe veut permettre l'un des deux à zéro pour un cas d'usage précis, le dire avant la Milestone B — ça change aussi la définition d'`isInitialized` ci-dessous.

### `onUninstall`
```solidity
function onUninstall(bytes calldata) external {
    if (!_isInitialized(msg.sender)) revert NotInitialized(msg.sender);
    if (recoveries[msg.sender].status == RecoveryStatus.Revealed) {
        revert ActiveRecoveryExists(msg.sender);
    }
    delete configs[msg.sender];
    delete recoveries[msg.sender];
}
```

### `isModuleType` / `isInitialized`
```solidity
function isModuleType(uint256 typeID) external pure returns (bool) {
    return typeID == MODULE_TYPE_EXECUTOR; // constante à importer — vérifier le chemin exact (ex. kernel/src/types/Constants.sol)
}

function isInitialized(address smartAccount) external view returns (bool) {
    return _isInitialized(smartAccount);
}

function _isInitialized(address smartAccount) internal view returns (bool) {
    return configs[smartAccount].lockTime != 0;
}
```
`MODULE_TYPE_EXECUTOR` : à importer depuis la même source que `MODULE_TYPE_VALIDATOR`/`MODULE_TYPE_HOOK` utilisés dans `WebAuthnValidator.sol` (`src/types/Constants.sol` du repo Kernel) — vérifier la valeur exacte (2, selon la spec ERC-7579) au moment de l'import plutôt que de la coder en dur ici.

### `updateRecoveryParams`
```solidity
function updateRecoveryParams(uint256 lockValue, uint256 lockTime) external {
    if (!_isInitialized(msg.sender)) revert NotInitialized(msg.sender);
    if (lockValue == 0 || lockTime == 0) revert InvalidRecoveryParams();
    configs[msg.sender] = RecoveryConfig(lockValue, lockTime);
    emit RecoveryParamsUpdated(msg.sender, lockValue, lockTime);
}
```
Même garde que `onInstall` : `msg.sender` scope naturellement la mise à jour au bon compte, pas de paramètre `account` ni de guard explicite supplémentaire.

### Stubs des 4 fonctions métier
```solidity
function requestRecovery(bytes32) external pure {
    revert NotImplementedYet();
}

function revealRecovery(address, address, address, bytes32) external payable {
    revert NotImplementedYet();
}

function challengeRecovery(address, bytes calldata) external pure {
    revert NotImplementedYet();
}

function finalizeRecovery(address) external pure {
    revert NotImplementedYet();
}
```
Objectif : que `TARRecoveryExecutor is IERC7579Module, ITARRecovery` compile et respecte l'interface dès cette milestone — la Milestone B remplace ces corps, ne touche pas aux signatures.

## Stratégie de tests — Milestone A

`test/unit/TARRecoveryExecutorLifecycle.t.sol`, contre un mock de compte ERC-7579 (`modulekit` ou mock minimal maison exposant `installModule`/`uninstallModule`) :

- `onInstall` avec des paramètres valides → `configs[account]` correctement rempli, event émis.
- `onInstall` appelé deux fois sur le même compte → revert `AlreadyInitialized`.
- `onInstall` avec `lockValue == 0` ou `lockTime == 0` → revert `InvalidRecoveryParams`.
- `updateRecoveryParams` sur un compte non initialisé → revert `NotInitialized`.
- `updateRecoveryParams` avec des paramètres valides après install → `configs[account]` mis à jour, event émis.
- `onUninstall` sur un compte non initialisé → revert `NotInitialized`.
- `onUninstall` avec `recoveries[account].status == Revealed` (état simulé directement en storage pour ce test, puisque la Milestone B n'existe pas encore) → revert `ActiveRecoveryExists`.
- `onUninstall` nominal → `configs[account]` et `recoveries[account]` supprimés.
- `isModuleType(2)` retourne `true`, tout autre typeID retourne `false`.
- Les 4 fonctions métier stubbées revertent bien avec `NotImplementedYet` quel que soit l'input.

## Critère de fin

- `TARRecoveryExecutor` compile, implémente `IERC7579Module` et `ITARRecovery` intégralement (stubs inclus).
- Tous les tests listés ci-dessus passent contre un mock de compte.
- Aucune dépendance sur un validator réel ou mocké, sur Kernel réel, ou sur EntryPoint.

Une fois ce critère atteint, passer à la Milestone B (state machine commit-reveal, signer ECDSA) — voir `roadmap-implementation.md`.