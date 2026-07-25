# Context — Milestone B : State machine commit-reveal (signer ECDSA)

## Objectif

Implémenter la logique métier complète (`requestRecovery`, `revealRecovery`, `challengeRecovery`, `finalizeRecovery`) sur le squelette posé en Milestone A, avec `newSigner` comme simple `address` (ECDSA temporaire) — pas encore `(pubKeyX, pubKeyY)`. Remplace les 4 stubs `NotImplementedYet()` de la Milestone A par une implémentation réelle.

## Hors scope explicite pour cette milestone

- **Pas de format WebAuthn** : `newSigner` reste un `address` — la bascule vers `(pubKeyX, pubKeyY)` est la Milestone C, qui réécrit `revealRecovery`, `RecoveryRequest` et le harness de test associés.
- **Pas de vrai validator** : `finalizeRecovery` appelle un contrat cible via `executeFromExecutor`, mais ce contrat est un **mock de test** (`setNewOwner(address)` factice), pas `TARWebAuthnValidator` (Milestone D) ni un `ECDSAValidator` réel — ECDSA n'a de toute façon jamais d'utilité en production (voir `context-full-implementation.md` §4.3).
- **Pas de vraie intégration Kernel** : tests contre un mock de compte, pas contre `KernelFactory` — c'est la Milestone E.

## Prérequis

Milestone A terminée : `TARRecoveryExecutor` compile, implémente `IERC7579Module`/`ITARRecovery` avec les 4 fonctions métier stubbées, storage (`configs`, `pendingCommitments`, `recoveries`) et cycle install/uninstall/update testés.

## Fichiers

```
smart-contract/
  src/
    TARRecoveryExecutor.sol       # modifié : remplace les 4 stubs
  test/
    unit/TARRecoveryExecutor.t.sol
    mocks/MockRotatableValidator.sol
```

## Nouvel élément de storage : adresse du validator (immutable)

Aucun champ de `RecoveryConfig`/`RecoveryRequest` (Milestone A) n'est modifié. Ajout d'une variable immutable, fixée au déploiement :

```solidity
address public immutable validator;

constructor(address _validator) {
    validator = _validator;
}
```

**Pourquoi immutable et pas un paramètre de `finalizeRecovery`** : si l'adresse cible de `executeFromExecutor` était un paramètre libre, n'importe qui pourrait faire exécuter par `addressToRecover` un appel arbitraire (target + calldata de son choix) avec l'autorité du compte — `finalizeRecovery` doit toujours pointer vers une adresse connue à l'avance, jamais fournie par l'appelant. En Milestone B, `validator` pointe vers `MockRotatableValidator` déployé pour les tests ; en Milestone E, vers le vrai `TARWebAuthnValidator` (nécessitera un redéploiement de `TARRecoveryExecutor` avec la nouvelle adresse — cohérent avec le fait que la Milestone C réécrit déjà une partie du contrat).

## Events

```solidity
event RecoveryRequested(bytes32 indexed commitment);
event RecoveryRevealed(address indexed addressToRecover, address indexed broadcasterAddress, uint256 challengeDeadline);
event RecoveryRejected(address indexed addressToRecover);
event RecoveryFinalized(address indexed addressToRecover);
```

## Erreurs

```solidity
error CommitmentNotFound();
error InvalidBroadcaster();
error WrongStakedAmount();
error RecoveryAlreadyActive(address account);
error RecoveryNotRevealed(address account);
error TimelockNotElapsed(address account);
error InvalidRejectSignature();
error TransferFailed();
```
(`NotInitialized(address)` déjà déclarée en Milestone A, réutilisée ici pour vérifier que `addressToRecover` a bien installé le module.)

## Fonctions

### `requestRecovery`
```solidity
function requestRecovery(bytes32 commitment) external {
    pendingCommitments[commitment] = true;
    emit RecoveryRequested(commitment);
}
```
Non-payable. Aucune vérification d'unicité — un commitment déjà présent est simplement réécrit à `true` (no-op). Spam accepté comme limite connue du POC (voir `context-full-implementation.md` §6).

### `revealRecovery`
```solidity
function revealRecovery(
    address addressToRecover,
    address broadcasterAddress,
    address newSigner,
    bytes32 salt
) external payable {
    if (!_isInitialized(addressToRecover)) revert NotInitialized(addressToRecover);
    if (recoveries[addressToRecover].status == RecoveryStatus.Revealed) {
        revert RecoveryAlreadyActive(addressToRecover);
    }
    if (msg.sender != broadcasterAddress) revert InvalidBroadcaster();

    bytes32 commitment = keccak256(abi.encodePacked(addressToRecover, broadcasterAddress, newSigner, salt));
    if (!pendingCommitments[commitment]) revert CommitmentNotFound();

    if (msg.value != configs[addressToRecover].lockValue) revert WrongStakedAmount();

    delete pendingCommitments[commitment];

    recoveries[addressToRecover] = RecoveryRequest({
        broadcasterAddress: broadcasterAddress,
        newSigner: newSigner,
        stakedValue: msg.value,
        revealTimestamp: block.timestamp,
        status: RecoveryStatus.Revealed
    });

    emit RecoveryRevealed(addressToRecover, broadcasterAddress, block.timestamp + configs[addressToRecover].lockTime);
}
```
Ordre des checks pensé pour faire revert au plus tôt sur les vérifications les moins coûteuses en gas avant de recalculer le hash. `msg.value != lockValue` fait revert la transaction entière — aucun état n'est jamais écrit avec un mauvais montant (cf. décision "pas de `Failed`", `context-full-implementation.md` §4.1).

### `challengeRecovery`
```solidity
function challengeRecovery(address addressToRecover, bytes calldata ownerSignature) external nonReentrant {
    RecoveryRequest storage req = recoveries[addressToRecover];
    if (req.status != RecoveryStatus.Revealed) revert RecoveryNotRevealed(addressToRecover);

    bytes32 rejectHash = keccak256(abi.encodePacked(
        address(this),
        block.chainid,
        addressToRecover,
        req.broadcasterAddress,
        req.revealTimestamp,
        "REJECT"
    ));

    if (IERC1271(addressToRecover).isValidSignature(rejectHash, ownerSignature) != IERC1271.isValidSignature.selector) {
        revert InvalidRejectSignature();
    }

    uint256 stake = req.stakedValue;
    req.status = RecoveryStatus.Rejected;

    (bool success, ) = addressToRecover.call{value: stake}("");
    if (!success) revert TransferFailed();

    emit RecoveryRejected(addressToRecover);
}
```
Pattern CEI respecté : `status` mis à jour avant le transfert. `IERC1271.isValidSignature.selector` = `0x1626ba7e` — à vérifier que l'import résout bien vers ce même sélecteur selon la version d'OpenZeppelin utilisée.

### `finalizeRecovery`
```solidity
function finalizeRecovery(address addressToRecover) external nonReentrant {
    RecoveryRequest storage req = recoveries[addressToRecover];
    if (req.status != RecoveryStatus.Revealed) revert RecoveryNotRevealed(addressToRecover);
    if (block.timestamp < req.revealTimestamp + configs[addressToRecover].lockTime) {
        revert TimelockNotElapsed(addressToRecover);
    }

    uint256 stake = req.stakedValue;
    address newSigner = req.newSigner;
    req.status = RecoveryStatus.Finalized;

    bytes memory rotationCalldata = abi.encodeWithSignature("setNewOwner(address)", newSigner);
    // Format exact de l'executionCalldata (target/value/calldata packés) à vérifier contre la lib ERC-7579 réellement utilisée.
    IERC7579Account(addressToRecover).executeFromExecutor(
        MODE_SINGLE,
        abi.encodePacked(validator, uint256(0), rotationCalldata)
    );

    (bool success, ) = addressToRecover.call{value: stake}("");
    if (!success) revert TransferFailed();

    emit RecoveryFinalized(addressToRecover);
}
```
Pattern CEI respecté : `status` mis à jour avant l'appel externe et le transfert. `MODE_SINGLE` : constante ERC-7579 pour un appel simple (non batché) — à importer depuis la lib utilisée, pas à coder en dur sans vérification.

## Mock nécessaire pour les tests : `MockRotatableValidator.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockRotatableValidator {
    mapping(address => address) public currentOwner;

    function setNewOwner(address newOwner) external {
        currentOwner[msg.sender] = newOwner;
    }
}
```
Déployé dans les tests, son adresse passée au constructeur de `TARRecoveryExecutor`. `msg.sender` ici est le compte (puisque l'appel provient de `executeFromExecutor`, exécuté par le compte lui-même) — permet d'asserter que la rotation a bien été enregistrée pour le bon compte.

## Stratégie de tests — Milestone B

Contre un mock de compte ERC-7579 + `MockRotatableValidator` :

- **Happy path complet** : `requestRecovery` → `revealRecovery` → `finalizeRecovery` après `lockTime` écoulé. Vérifie : `MockRotatableValidator.currentOwner[account] == newSigner`, stake reversé à `addressToRecover`, `status == Finalized`, `pendingCommitments[commitment] == false`.
- **Rejet owner** : reveal puis `challengeRecovery` avec signature valide → stake transféré, `status == Rejected`, `finalizeRecovery` revert ensuite (`RecoveryNotRevealed`).
- **Bornes du timelock** : `finalizeRecovery` revert juste avant `revealTimestamp + lockTime`, succès pile à cette valeur.
- **`challengeRecovery` après expiration** : à clarifier — le plan ne précise pas si un challenge reste valide après l'expiration du timelock si `finalizeRecovery` n'a pas encore été appelé. Comportement proposé par défaut : `challengeRecovery` reste possible tant que `status == Revealed`, peu importe si `lockTime` est dépassé (l'owner peut rejeter tant que personne n'a finalisé) — à confirmer, sinon ajouter un check de borne haute symétrique à celui de `finalizeRecovery`.
- **Anti-front-running** : revert `InvalidBroadcaster` si `msg.sender != broadcasterAddress` au reveal ; revert `CommitmentNotFound` si le hash recalculé ne correspond à aucun commitment en attente.
- **Rejeu de commitment** : `revealRecovery` consomme (delete) le commitment — un second reveal avec les mêmes paramètres doit revert `CommitmentNotFound`.
- **Garde active-recovery** : un second `revealRecovery` sur le même `addressToRecover` pendant que `status == Revealed` doit revert `RecoveryAlreadyActive`.
- **Mauvais montant staké** : `revealRecovery` avec `msg.value != lockValue` doit revert `WrongStakedAmount`, sans écrire aucun état (`pendingCommitments[commitment]` reste `true`).
- **Cible non initialisée** : `revealRecovery` visant un `addressToRecover` qui n'a jamais appelé `onInstall` doit revert `NotInitialized`.
- **Signature de rejet invalide** : `challengeRecovery` avec une signature qui ne correspond pas à `rejectHash` doit revert `InvalidRejectSignature`.
- **Vecteur de test croisé JS/Solidity** pour la formule du commitment (signalé en `context-full-implementation.md` §4.4) — écrire ce test ici, pas repoussé à l'intégration front.

## Point ouvert à trancher avant/pendant l'implémentation

Le comportement de `challengeRecovery` après expiration du `lockTime` (mais avant `finalizeRecovery`) n'a jamais été explicitement tranché dans les documents précédents — voir le test correspondant ci-dessus. Je pars du principe qu'un challenge reste valide tant qu'aucun `finalizeRecovery` n'a été exécuté, mais confirme si tu veux plutôt fermer la fenêtre de challenge strictement à `lockTime`.

## Critère de fin

- Les 4 fonctions métier sont implémentées (plus de stub `NotImplementedYet`).
- Tous les tests listés ci-dessus passent contre un mock de compte + `MockRotatableValidator`.
- `ReentrancyGuard` actif sur `challengeRecovery`/`finalizeRecovery`, pattern CEI respecté sur les deux.
- Aucune dépendance sur un vrai Kernel, un vrai validator WebAuthn, ou EntryPoint.

Une fois ce critère atteint, passer à la Milestone C (bascule commitment WebAuthn) ou D (`TARWebAuthnValidator`), indépendamment l'une de l'autre — voir `roadmap-implementation.md`.