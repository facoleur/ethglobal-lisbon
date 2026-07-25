# Roadmap d'implémentation — TARRecoveryExecutor (POC1)

Construite sur `context-full-implementation.md` (architecture figée). Les sections 1 et 2a sont considérées closes ; la section 2b est en cours et traitée comme dépendance conditionnelle, pas bloquante, pour les milestones qui ne touchent pas WebAuthn.

## Milestone A — Squelette du module + config

**Fichier** : `src/TARRecoveryExecutor.sol`, `src/interfaces/ITARRecovery.sol`

- Enum `RecoveryStatus`, structs `RecoveryConfig`/`RecoveryRequest`, storage (`configs`, `pendingCommitments`, `recoveries`).
- Boilerplate `IERC7579Module` : `onInstall`, `onUninstall`, `isModuleType`, `isInitialized` — signatures figées en §4.3 du contexte, à vérifier une fois importées contre le vrai `kernel`/`erc7579-implementation`.
- `updateRecoveryParams(lockValue, lockTime)` — guard : `msg.sender` doit être le compte dont la config est modifiée (`configs[msg.sender] = ...`), même pattern que `onInstall`, pas de paramètre `account` à ajouter.
- `onUninstall` refuse si `recoveries[msg.sender].status == RecoveryStatus.Revealed`.

*Fini quand* : tests unitaires du cycle install/uninstall/update passent avec un mock de compte (pas encore un vrai Kernel).

## Milestone B — State machine commit-reveal (signer ECDSA)

**Fichier** : `src/TARRecoveryExecutor.sol`

- `requestRecovery(commitment)` non-payable, écrit `pendingCommitments[commitment] = true`, émet `RecoveryRequested`.
- `RecoveryRequest` (Milestone B) inclut `address newSigner`, stocké au reveal, lu au finalize — pas passé en paramètre de `finalizeRecovery`.
- `revealRecovery(addressToRecover, broadcasterAddress, newSigner, salt)` payable — version ECDSA temporaire : `newSigner` est un `address`, pas encore `(pubKeyX, pubKeyY)`.
  - Recalcule le commitment, vérifie son existence dans `pendingCommitments`, le consomme (delete).
  - `require(msg.sender == broadcasterAddress)`.
  - `require(msg.value == configs[addressToRecover].lockValue)`.
  - `require(recoveries[addressToRecover].status != RecoveryStatus.Revealed)`.
  - Écrit `recoveries[addressToRecover]` (incluant `newSigner`), émet `RecoveryRevealed`.
- `challengeRecovery(addressToRecover, ownerSignature)` : calcule `rejectHash` (formule figée en §4.3), vérifie via ERC-1271, transfère le stake, `status = Rejected`, émet `RecoveryRejected`. **ReentrancyGuard + CEI**.
- `finalizeRecovery(addressToRecover)` : vérifie `lockTime` écoulé et `status == Revealed`, lit `newSigner` dans `recoveries[addressToRecover]`, appelle un **mock de validator trivial** via `executeFromExecutor` (pas un vrai `ECDSAValidator` — inutile, voir note ci-dessous), transfère le stake, `status = Finalized`, émet `RecoveryFinalized`. **ReentrancyGuard + CEI**.

**Pourquoi un mock et pas un vrai validator** : ni `ECDSAValidator` ni `WebAuthnValidator` (stock Kernel) n'ont de fonction de rotation. `TARWebAuthnValidator` (Milestone D) est développé séparément et plus tard. ECDSA n'a de toute façon jamais d'utilité en production — le séquencement bascule vers WebAuthn avant l'intégration Kernel réelle (Milestone E). Un mock trivial (`setNewOwner` factice qui enregistre l'appel) suffit pour tester la logique de `TARRecoveryExecutor` elle-même.

*Fini quand* : suite de tests complète — happy path, rejet, bornes exactes du timelock, anti-front-running, rejeu de commitment, garde active-recovery, cycle module — passe avec un mock de compte + le mock de validator ci-dessus.

## Milestone C — Bascule vers commitment WebAuthn

**Fichier** : `src/TARRecoveryExecutor.sol`, `src/interfaces/ITARRecovery.sol`

- `RecoveryRequest` change de forme : `newSigner` (address) devient `newPubKeyX`/`newPubKeyY` (uint256) — pas seulement le paramètre de `revealRecovery`, le struct de storage lui-même.
- `revealRecovery` : `newSigner` remplacé par `(pubKeyX, pubKeyY)` — la formule du commitment change (voir §4.4 du contexte), donc la signature de la fonction et le hash recalculé changent.
- `finalizeRecovery` : toujours testé contre le **mock de validator** du Milestone B (adapté au nouveau format d'appel), pas contre le vrai `TARWebAuthnValidator` — ce Milestone ne dépend donc pas de Milestone D.
- Réécriture du harness de test correspondant (pas une extension du Milestone B — le format d'entrée change).

*Ne dépend pas de Milestone D* : testable entièrement contre un mock, comme B. Seul Milestone E dépend réellement d'un `TARWebAuthnValidator` fonctionnel.
*Fini quand* : même suite de tests que le Milestone B, avec le format `(pubKeyX, pubKeyY)` et le struct mis à jour.

## Milestone D — `TARWebAuthnValidator` (rotation de clé)

**Fichier** : `src/validators/TARWebAuthnValidator.sol`

- Fork intégral de `WebAuthnValidator.sol` (Kernel).
- Ajout de `setNewOwner(uint256 newPubKeyX, uint256 newPubKeyY)` — sécurité par `msg.sender == account`, pas de guard explicite (voir §6 du contexte).
- Tests : rotation réussie via `executeFromExecutor` simulé, rejet si `msg.sender` n'est pas le compte, rejet si `NotInitialized`, rejet si `pubKeyX`/`pubKeyY` nul.

*Peut être développé en parallèle du Milestone B/C* — dépendance uniquement au moment de l'intégration dans `finalizeRecovery` (Milestone C).
*Point à vérifier* : format exact de l'`executionCalldata` attendu par `executeFromExecutor` (encodage target/value/calldata) contre la lib ERC-7579 réellement utilisée.

## Milestone E — Intégration Kernel réelle

**Fichier** : `script/DeployTAR.s.sol`

- Déploiement d'un vrai compte via `KernelFactory` (réutilise le script de la section 2a).
- `TARRecoveryExecutor` installé via `installModule`, `TARWebAuthnValidator` installé comme validator.
- Cycle complet exécuté en appels directs (pas encore via `EntryPoint`).

*Fini quand* : cycle complet (request → reveal → finalize, et request → reveal → reject) passe sur un vrai compte Kernel.

## Milestone F — Test end-to-end via UserOp/EntryPoint

**Fichier** : `test/integration/KernelP256E2E.t.sol`

- Le flow du Milestone E encapsulé dans de vrais `PackedUserOperation`s, validés par `TARWebAuthnValidator`, exécutés via `EntryPoint.handleOps`.
- Anvil d'abord, Sepolia ensuite (réutilise le harness de la section 2b).

*Dépend de* : section 2b (go/no-go WebAuthn + précompile P-256). Si 2b conclut à un échec sur une chaîne → Milestone G avant de pouvoir clore celui-ci sur cette chaîne.
*Fini quand* : test E2E passe sur Anvil (obligatoire) et Sepolia (avant démo).

## Milestone G — Fallback validator Solidity pur (conditionnel)

Seulement si le Spike B (section 2b) échoue sur une chaîne. Même interface (`TARWebAuthnValidator`), vérification P-256 remplacée par une implémentation Solidity pure (type Daimo/FCL) au lieu du précompile `0x0100`. Ré-exécuter le Milestone F dessus.

---

## Stratégie de tests — mise à jour

Par rapport à la liste originale (`plan.md` §5), retirer : cas `Failed` + `withdrawFailedCommitment` (fonctions supprimées). Ajouter :
- `revealRecovery` avec `msg.value != configs[addressToRecover].lockValue` → revert, aucun état écrit.
- `revealRecovery` sur un commitment inexistant → revert.
- `setNewOwner` : les 3 cas listés au Milestone D.
- Vecteur de test croisé JS/Solidity pour la formule du commitment (signalé en §4.4 du contexte) — à écrire tôt, idéalement au Milestone B, pas repoussé à l'intégration front.

## Ordre recommandé

A → B → (C et D totalement en parallèle, aucune dépendance croisée) → E (dépend de C et D réels) → F → (G si nécessaire)

B est le premier jalon qui produit une logique métier testable de bout en bout ; C et D peuvent démarrer dès que B est stable, sans attendre 2b et sans dépendre l'un de l'autre — tous deux testés contre des mocks jusqu'à Milestone E, où le vrai `TARWebAuthnValidator` (D) et le vrai format `(pubKeyX, pubKeyY)` (C) se rejoignent pour la première fois.
