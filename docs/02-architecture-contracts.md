# Architecture — Contrats (`contracts/`)

Voir [`README.md`](README.md) pour la légende des statuts de maturité (🟢🟡🟠⚪). Pour le raisonnement derrière les choix listés ici, voir [`04-decisions.md`](04-decisions.md).

## Vue d'ensemble

```
contracts/src/
  TARRecoveryExecutor.sol       # V1 — pas de watch towers, challenge = signature owner
  TARRecoveryExecutorV2.sol     # V2 — watch towers via Semaphore, challenge unifié
  interfaces/
    ITARRecovery.sol
    ITARRecoveryV2.sol
    ITARWebAuthnValidator.sol
  validators/
    TARWebAuthnValidator.sol    # validator Kernel, fork + rotation de clé
```

Les deux exécuteurs (V1 et V2) sont des modules **Executor ERC-7579** (type 2) installés sur un compte Kernel. Ils partagent, à l'octet près, toute la state machine commit-reveal (`requestRecovery`/`revealRecovery`/`finalizeRecovery`, structs, events, `MIN_COMMIT_REVEAL_BLOCKS`). Seule `challengeRecovery` diffère entre les deux.

**Solidity** : pas de version pinnée globalement. `lib/semaphore` impose `pragma solidity 0.8.23;` exact dans tous ses fichiers, incompatible avec le `^0.8.28`/`^0.8.24` du reste du projet — l'auto-détection de `forge` résout chaque fichier contre son propre pragma (voir `foundry.toml`, commentaire détaillé). `via_ir = true` reste activé globalement (nécessaire pour `WebAuthn.sol`, "stack too deep" sinon) ; le vérifieur Groth16 de Semaphore compile plus lentement à cause de ça mais ça reste un coût de compilation ponctuel, jugé non prioritaire à optimiser.

## `TARRecoveryExecutor` (V1) — 🟢 Déployé + testé

**Sepolia** (dernier déploiement `broadcast/DeployTARSepolia.s.sol/11155111/run-latest.json` — à recouper avec les variables d'env front réellement actives avant de le prendre pour source de vérité) :
- `TARRecoveryExecutor` : `0x98593a06e9a74fe9c1dcb3c8df1698540d8b6c8a`
- `TARWebAuthnValidator` (déploiement V1) : `0x9f79960b33889e5c460b16b6d7ee38529f480ee9`

**Ce qui est implémenté** :
- `onInstall`/`onUninstall`/`isModuleType`/`isInitialized` — cycle module ERC-7579 standard (`IModule` de `kernel`, `payable` requis).
- `updateRecoveryParams(lockValue, lockTime)` — scope sur `msg.sender`, pas de paramètre `account`.
- `requestRecovery(commitment)` — commit non-payable ; no-op strict si déjà pending (voir `04-decisions.md`).
- `revealRecovery(addressToRecover, broadcasterAddress, pubKeyX, pubKeyY, salt)` — payable, `newSigner` déjà sous forme WebAuthn `(pubKeyX, pubKeyY)` (pas la forme ECDSA `address` d'une milestone antérieure). Vérifie broadcaster, montant staké exact, maturité `MIN_COMMIT_REVEAL_BLOCKS = 1`, garde active-recovery.
- `challengeRecovery(addressToRecover, ownerSignature)` — authentification **ERC-1271** via `IERC1271(addressToRecover).isValidSignature`, agnostique du validator actif sur le compte. `ReentrancyGuard` + CEI.
- `finalizeRecovery(addressToRecover)` — appelle `setNewOwner(pubKeyX, pubKeyY)` sur un `validator` **immutable, fixé au déploiement** (jamais un paramètre) via `executeFromExecutor`/`ExecLib`. `ReentrancyGuard` + CEI.

**Pourquoi ce contrat est gardé tel quel, sans évoluer davantage** : c'est la référence historique pré-Semaphore. Si une variante ZK alternative est un jour explorée (ex. Noir plutôt que Semaphore — voir [`06-roadmap.md`](06-roadmap.md)), **ne pas forker V1** : V1 n'a aucune notion de watch tower, donc repartir de lui obligerait à reconstruire toute l'architecture de groupe déjà résolue dans V2 (stockage, `MAX_GROUP_SIZE`, pattern "regenerate"). **Forker V2** et remplacer uniquement sa partie spécifique à Semaphore est le point de départ recommandé — voir la liste "spécifique Semaphore vs agnostique" dans `04-decisions.md`. V1 reste dans le repo comme référence du design le plus simple (sans watch tower), pas comme base de travail.

**Tests** : `test/unit/TARRecoveryExecutor.t.sol` (19) + `test/unit/TARRecoveryExecutorLifecycle.t.sol` (10) contre `test/mocks/MockERC7579Account.sol` (construit from scratch, pas de dépendance `modulekit`) et `test/mocks/MockRotatableValidator.sol`.

## `TARRecoveryExecutorV2` — 🟢 Déployé + testé

**Sepolia** (dernier déploiement `broadcast/DeployTARV2Sepolia.s.sol/11155111/run-latest.json`, même réserve que ci-dessus) :
- `TARRecoveryExecutorV2` : `0x62fc9ba3d7bdbf8a59c817693f009ed4402fbc93`
- `TARWebAuthnValidator` (déploiement V2) : `0xa342e79e93cf90d53f216c063fcc0c8f6261a3c2`

**Ce qui change par rapport à V1** (tout le reste est identique caractère pour caractère) :
- Storage additionnel : `ISemaphore public immutable semaphore`, `mapping(address => uint256) public groupOf`, `mapping(address => uint256) public epochOf`, `MAX_GROUP_SIZE = 16`, `MERKLE_TREE_DURATION = 365 days`.
- Le constructeur **brûle le groupe Semaphore `0`** (un `createGroup` jetable, admin = le contrat lui-même) pour qu'aucun `groupOf[account]` réel ne puisse jamais valoir `0` — défense en profondeur en plus du check explicite `groupId == 0` dans `challengeRecovery`.
- `challengeRecovery(addressToRecover, ISemaphore.SemaphoreProof proof)` — **un seul chemin pour l'owner et les watch towers**, plus d'ERC-1271/`ownerSignature`. Vérifie `status == Revealed`, `groupOf != 0`, `proof.scope == uint256(uint160(addressToRecover))`, puis `semaphore.verifyProof(groupId, proof)` (explicite, voir `04-decisions.md` sur `verifyProof` vs `validateProof`).
- `regenerateWatchTowerGroup(uint256[] members)` — remplacement **intégral** du groupe (jamais additif), `createGroup`+`addMembers` forwardés via `executeFromExecutor` (admin Semaphore = le compte lui-même, pas le module). Met à jour `groupOf`/`epochOf` seulement après succès complet.

**Tests** : `TARRecoveryExecutorV2.t.sol` (20) + `TARRecoveryExecutorV2Lifecycle.t.sol` (10) + `TARRecoveryExecutorV2Challenge.t.sol` (8) + `MockSemaphore.t.sol` (9, valide le mock lui-même) contre `test/mocks/MockSemaphore.sol` (implémente `ISemaphore` en entier, logique réelle seulement sur `createGroup`/`addMembers`/`verifyProof`) — plus `test/integration/SemaphoreProofVector.t.sol` (2) contre un **vrai** `Semaphore.sol`/`SemaphoreVerifier.sol` (Groth16 réel), fixture dans `test/fixtures/semaphore_proof_vector.json`.

**🟡 Non couvert, à noter** : aucun test ne passe par un vrai `EntryPoint.handleOps`/`PackedUserOperation` — toute la suite (V1 et V2) exerce les contrats en appels directs. Pas de fichier `KernelP256E2E.t.sol`/`KernelWatchTowerE2E.t.sol` dans le repo malgré leur mention dans d'anciens plans — jamais construit. Voir [`06-roadmap.md`](06-roadmap.md).

## `TARWebAuthnValidator` — 🟢 Déployé + testé (avec réserve)

Fork intégral de `WebAuthnValidator.sol` (Kernel `kernel-7579-plugins`), format `onInstall` identique à celui attendu par `permissionless.js` (`abi.encode(WebAuthnPublicKey, credentialIdHash)`). Deux fonctions de rotation, avec un écart notable entre les deux :
- `rotatePublicKey(pubKeyX, pubKeyY, credentialIdHash)` — met à jour la clé **et** `credentialIdHash`.
- `setNewOwner(pubKeyX, pubKeyY)` — c'est celle utilisée par `finalizeRecovery` (les deux V1 et V2) via `executeFromExecutor`. **Ne met pas à jour `credentialIdHash`** — après une recovery TAR, ce champ devient obsolète. Aucun guard explicite nécessaire : `msg.sender` est structurellement le compte, ce chemin n'étant atteignable que via `executeFromExecutor`. Question ouverte non corrigée — voir `05-limitations.md`.

**Tests** : `TARWebAuthnValidator.t.sol` (18 cas, écrits sans document de contexte dédié, à partir du contrat directement). **2 tests `vm.skip()`-és** : le précompile P-256 local à `forge test` (y compris en `--fork-url`) retourne un `STOP` sans donnée au lieu de vérifier — confirmé empiriquement en comparant à un appel direct du précompile sur un vrai nœud `anvil` avec le même vecteur, qui retourne `1` correctement. N'affecte que l'exécution locale des tests, pas le comportement réel sur Sepolia.

## Dépendances (`contracts/lib/`, `remappings.txt`)

`forge-std`, `openzeppelin-contracts`, `account-abstraction` (v0.7.0), `kernel` + `kernel-7579-plugins` (ZeroDev), `semaphore` (v4 — LeanIMT + EdDSA, pas v2/v3), `zk-kit.solidity` (LeanIMT), `poseidon-solidity`. Tous en submodules git, pas npm+remapping (contrairement à ce qui avait été envisagé pour Semaphore).
