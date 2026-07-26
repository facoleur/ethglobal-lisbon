# Contexte — Milestone A (POC2 Watch Towers) : squelette `TARRecoveryExecutorV2`

Destiné à un agent (Claude Code) ayant accès au repo complet. Ne contient pas de code
d'implémentation — les décisions, contraintes et faits vérifiés nécessaires pour écrire
Milestone A correctement, en s'appuyant sur les fichiers réels du repo plutôt que sur une
reconstruction externe. Complète `roadmap-poc2-watchtowers.md` (même périmètre, Milestone A),
ne le remplace pas.

## 0. À lire dans le repo avant d'écrire quoi que ce soit

- `src/TARRecoveryExecutor.sol` (V1) — source de vérité pour tout ce qui doit être copié à
  l'identique (§2 ci-dessous). Ne pas reconstruire ces fonctions depuis la spec en prose de
  `contracts_context-full-implementation.md` : cette spec existe pour donner le contexte
  produit, le vrai fichier fait foi pour le code.
- `remappings.txt`/`foundry.toml` — pour le chemin d'import réel de `kernel` et confirmer si la
  lib d'encodage d'exécution est `ExecLib` (nom utilisé dans `feedback.md`,
  `script/DeployKernelBidon.s.sol`) ou autre chose. Ne pas supposer.
- Le vrai `finalizeRecovery` de V1 — pour voir **comment il résout déjà** l'adresse du
  `TARWebAuthnValidator` installé sur le compte cible avant d'appeler `setNewOwner`. Ce
  mécanisme doit être réutilisé tel quel dans les nouveaux appels `executeFromExecutor` de
  `regenerateWatchTowerGroup` (§5), pas réinventé.

## 1. Objectif du milestone

Créer `TARRecoveryExecutorV2` : copie de `TARRecoveryExecutor` (V1) qui conserve `requestRecovery`,
`revealRecovery`, `finalizeRecovery` inchangés, retire tout le chemin `IERC1271`/`ownerSignature`/
`rejectHash` de l'ancien `challengeRecovery` (fonction entièrement supprimée à ce stade, pas
seulement modifiée), et ajoute le storage nécessaire à la gestion d'un groupe Semaphore de
défenseurs par compte. Pas de vérification de preuve dans ce milestone — `challengeRecovery` est
volontairement absente, elle revient en Milestone D avec un chemin unique owner+watch tower.

## 2. Ce qui doit rester identique à V1, au caractère près

`requestRecovery`, `revealRecovery`, `finalizeRecovery`, `RecoveryStatus`, `RecoveryConfig`,
`RecoveryRequest`, `configs`, `pendingCommitments`, `recoveries`, les events
`RecoveryRequested`/`RecoveryRevealed`/`RecoveryFinalized`/`RecoveryParamsUpdated`, `onInstall`/
`onUninstall`/`isModuleType`/`isInitialized`, `MIN_COMMIT_REVEAL_BLOCKS`. Si un écart existe
entre ce document et le vrai fichier V1 sur un de ces points, **le fichier V1 fait foi**.

## 3. Ce qui doit disparaître

- L'ancien `challengeRecovery(address, bytes ownerSignature)`.
- Tout ce qui ne sert qu'à lui : calcul de `rejectHash`, appel `IERC1271(addressToRecover).isValidSignature`,
  event `RecoveryRejected` gardé (il sera réémis en Milestone D, mais son corps de vérification
  actuel n'a plus lieu d'être ici).

## 4. Nouveau storage à ajouter

- `ISemaphore public immutable semaphore;` — adresse fixée au déploiement. Adresse par
  environnement (Anvil/Sepolia) hors périmètre de ce milestone, traitée en Milestone F.
- `mapping(address => uint256) public groupOf;` — `groupId` Semaphore courant du groupe de
  défenseurs d'un compte. Remplacé entièrement à chaque régénération (§5) ; l'ancien `groupId`
  n'est jamais réutilisé ni référencé de nouveau.
- `uint256 public constant MAX_GROUP_SIZE = 16;` — **hypothèse, pas une décision actée** : owner
  inclus dans ce plafond (le brainstorming initial disait "16 WT max" avant que l'owner ne
  devienne lui-même un défenseur au même titre). Une seule constante à corriger si l'équipe
  tranche autrement.
- `uint256 public constant MERKLE_TREE_DURATION = 365 days;` (ou valeur équivalente) — fixée
  haute délibérément, pour qu'aucune racine n'expire pendant une fenêtre de challenge en cours,
  y compris si `lockTime` est long. Passée explicitement à la création de chaque groupe (voir
  §5, fait Semaphore vérifié n°3) plutôt que de dépendre de la valeur par défaut de Semaphore
  (1h), qui ne convient pas ici.

## 5. Nouvelle fonction — `regenerateWatchTowerGroup`

```solidity
function regenerateWatchTowerGroup(uint256[] calldata members) external;
```

- Owner du compte uniquement : `msg.sender == account`, même pattern d'appel direct que
  `updateRecoveryParams` (pas de guard explicite au-delà de l'utilisation de `msg.sender` comme
  clé).
- Revert si `members.length == 0` ou `members.length > MAX_GROUP_SIZE`.
- Remplacement intégral, jamais additif : ce contrat ne connaît pas de notion d'ajout ou de
  retrait individuel de membre. La composition de `members` (watch towers actives + identité du
  jour de l'owner + padding aléatoire jusqu'au plafond) est calculée côté front, hors périmètre
  contrat.
- Crée un nouveau groupe Semaphore avec `admin = msg.sender` (le compte lui-même — décision
  actée), y insère `members` en un seul appel `addMembers` (pas d'insertion unitaire répétée),
  puis met à jour `groupOf[msg.sender]` seulement après succès de l'insertion.
- Comme `admin` doit être vu par `Semaphore.sol` comme étant le compte et non ce module, les
  appels à `createGroup`/`addMembers` doivent être forwardés via `executeFromExecutor` (compte
  → Semaphore), pas appelés directement par le module — **même mécanisme que celui déjà résolu
  dans le vrai `finalizeRecovery` pour appeler `TARWebAuthnValidator.setNewOwner`** (§0). Ne pas
  ré-résoudre ce point depuis zéro : la lib d'encodage et la convention utilisées là-bas
  s'appliquent ici à l'identique, pour les deux nouveaux appels (`createGroup` puis
  `addMembers`).
- `event WatchTowerGroupRegenerated(address indexed account, uint256 indexed groupId, uint256 memberCount);`

## 6. Faits vérifiés sur Semaphore (dépendance externe — indépendants du repo, fiables tels quels)

Vérifiés en clonant `semaphore-protocol/semaphore` (tag `v4.0.0`) :

1. Import réel : `import "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";`
2. `struct SemaphoreProof { uint256 merkleTreeDepth; uint256 merkleTreeRoot; uint256 nullifier; uint256 message; uint256 scope; uint256[8] points; }`
   — utile dès ce milestone pour dimensionner correctement le type de retour attendu par
   `groupOf`/les futurs appels de Milestone D, même si `challengeRecovery` n'est pas encore
   réécrite ici.
3. `function createGroup(address admin, uint256 merkleTreeDuration) external returns (uint256);`
   existe en overload à 2 arguments — utiliser celui-là (pas `createGroup(address)` seul) pour
   fixer `MERKLE_TREE_DURATION` explicitement dès la création plutôt que de faire un second
   appel `updateGroupMerkleTreeDuration` séparé.
4. `function addMembers(uint256 groupId, uint256[] calldata identityCommitments) external;` —
   aucune valeur de retour, pas de `groupId` à récupérer ici (contrairement à `createGroup`).
5. **`verifyProof`, pas `validateProof`** — décision déjà actée dans la conversation, à ne pas
   re-basculer : `function verifyProof(uint256 groupId, SemaphoreProof calldata proof) public view returns (bool);`.
   Vérifié dans le vrai `Semaphore.sol` : `verifyProof` ne lit ni n'écrit jamais le mapping
   `nullifiers` — seul `validateProof` (state-changing) le fait, en appelant `verifyProof` en
   interne puis en marquant le nullifier utilisé. En n'appelant que `verifyProof`, Semaphore ne
   fait donc **aucun** suivi de replay de son côté ; la protection contre un double-veto sur une
   même tentative vient uniquement du `status` de `TARRecoveryExecutorV2` (déjà en place côté
   `finalizeRecovery`/`revealRecovery`), pas de Semaphore. `verifyProof` peut tout de même
   revert pour des raisons structurelles (`Semaphore__GroupHasNoMembers`,
   `Semaphore__MerkleTreeDepthIsNotSupported`, `Semaphore__MerkleTreeRootIsNotPartOfTheGroup`,
   `Semaphore__MerkleTreeRootIsExpired`) mais retourne simplement `false` (pas de revert) si la
   preuve cryptographique elle-même est invalide — un `require(semaphore.verifyProof(...))` sera
   donc nécessaire côté Milestone D, contrairement à ce qu'impliquerait `validateProof`. Sans
   objet pour Milestone A (pas de `challengeRecovery` ici), mais à anticiper pour ne pas avoir à
   revenir sur la forme de l'interface plus tard.
6. `MIN_DEPTH = 1`, `MAX_DEPTH = 32` (`base/Constants.sol`) — un groupe de 16 membres (profondeur
   4) est largement dans la plage supportée, aucun ajustement de `MAX_GROUP_SIZE` requis pour
   rester dans les bornes du vérifieur.

Ce que ces faits ne couvrent pas : le nom exact de la lib d'encodage `executeFromExecutor` côté
Kernel (§0, à lire dans le repo réel — un clone indépendant de `zerodevapp/kernel` a montré une
lib différente de celle documentée dans `feedback.md`, signe probable d'une dérive de version ;
la version réellement pinnée dans ce repo fait foi, pas un clone externe).

## 7. Fini quand

- `TARRecoveryExecutorV2` compile.
- La suite de tests existante sur `requestRecovery`/`revealRecovery`/`finalizeRecovery` (héritée
  de V1) passe sans modification contre V2.
- `regenerateWatchTowerGroup` dispose de tests contre un mock Semaphore minimal (peut être un
  simple stub à ce stade, le vrai `MockSemaphore` structuré est Milestone B) couvrant : happy
  path, rejet si `> MAX_GROUP_SIZE`, rejet si liste vide, `groupOf` non modifié si l'insertion
  échoue en cours de route.
- Aucun test sur `challengeRecovery` dans ce lot — normal, la fonction n'existe pas encore.