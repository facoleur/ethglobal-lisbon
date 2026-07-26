# Roadmap d'implémentation — Watch Towers via Semaphore (POC2)

Construite sur `contracts_context-full-implementation.md` (POC1) et sur la discussion de design POC2. Ne redéfinit pas ce qui ne change pas : `requestRecovery`, `revealRecovery`, `finalizeRecovery`, le commit-reveal, le délai `MIN_COMMIT_REVEAL_BLOCKS`, et `TARWebAuthnValidator` restent identiques à POC1 — ce document ne couvre que ce qui change : la configuration des défenseurs (owner + watch towers) et `challengeRecovery`.

## Décisions actées (rappel, pour que ce document se suffise à lui-même)

- **Une seule fonction de challenge.** Owner et watch towers empruntent le même chemin : une preuve Semaphore. Plus aucun appel `IERC1271.isValidSignature` dans `challengeRecovery`. `TARWebAuthnValidator` continue d'exister pour la signature normale des transactions du compte et pour la rotation de clé dans `finalizeRecovery` — aucun changement à lui apporter pour ce lot.
- **Vérification via `validateProof`** (state-changing), pas `verifyProof`.
- **`scope` stable par compte** (dérivé de `addressToRecover`), pas par tentative. Résidu accepté et documenté : un même défenseur (owner ou WT) réutilise le même nullifier à chaque veto sur ce compte, donc "c'est le même défenseur que la dernière fois" est visible dans les events — jamais son identité. Ne pas corriger.
- **Admin du groupe Semaphore = le smart wallet lui-même** (pas le module).
- **Pas de suppression de membre en storage.** Tout changement (ajout, retrait, ou simple rotation de padding) passe par une régénération complète : nouveau `createGroup` + `addMembers` avec la liste entière recalculée côté front. Le contrat n'a aucune notion d'"ajout" ou de "retrait" individuel.
- **Padding aléatoire, régénéré à chaque appel**, jamais dérivé d'une formule déductible (ex. `hash(groupId, i)`), sinon un observateur soustrait le padding connu du total et retrouve le nombre réel de défenseurs.
- **`merkleTreeDuration` fixée à une valeur haute** à la création de chaque groupe — pas d'expiration voulue.
- **100 identités indépendantes pré-générées par WT (et par owner)**, secrets non corrélés entre eux (pas de dérivation par seed+compteur — un seul leak ne doit jamais compromettre les 99 autres). Risque de perte sans backup accepté explicitement.
- Le format d'échange (QR bidirectionnel une fois pour 100 identités, scan de feuille côté front) est hors périmètre de ce document : scope contrats uniquement.

## Hypothèses non tranchées, portées par ce document jusqu'à contradiction

- **`MAX_GROUP_SIZE = 16`, owner inclus.** Le brainstorming original disait "16 WT max" avant que l'owner ne devienne lui-même un défenseur ; j'assume que le plafond couvre désormais owner + WT + padding confondus, à corriger en un seul endroit (une constante) si l'équipe tranche autrement.
- **Adresse de `Semaphore.sol` par environnement.** Anvil : auto-déployé dans le script de déploiement (Milestone F). Sepolia : adresse canonique PSE à vérifier avant intégration ; si absente ou version incompatible, déploiement propre en fallback — même logique de go/no-go que le précompile P-256 en POC1.
- **Forme exacte de `ISemaphore.SemaphoreProof`** (`merkleTreeDepth`, `merkleTreeRoot`, `nullifier`, `message`, `scope`, `points`) et signature exacte de `validateProof`/`createGroup`/`addMembers` — à confirmer contre la version installée de `@semaphore-protocol/contracts`, pas contre la doc générale.
- **Comportement d'échec de `validateProof`** (revert avec custom error vs retour booléen) — conditionne si `challengeRecovery` a besoin d'un `require` explicite après l'appel ou si l'échec est déjà terminal.

---

## Milestone A — Dépendance Semaphore + squelette V2

**Fichier** : `src/TARRecoveryExecutorV2.sol`, `src/interfaces/ITARRecoveryV2.sol`, `foundry.toml`/remappings

- Ajout de `@semaphore-protocol/contracts` (pin de version compatible V4 — LeanIMT + identité EdDSA, pas V3). Vérifier si l'installation Foundry se fait par submodule git ou par npm+remapping (comme `openzeppelin-contracts` déjà en place) et documenter le choix, contrairement à ce qui a été fait pour `kernel`/`account-abstraction`.
- Copie de `TARRecoveryExecutor.sol` vers `TARRecoveryExecutorV2.sol`. `requestRecovery`, `revealRecovery`, `finalizeRecovery`, structs, events liés au commit-reveal : **inchangés au caractère près**.
- Nouveau storage : `mapping(address => uint256) public groupOf;`, `ISemaphore public immutable semaphore;` (fixé au déploiement), `uint256 public constant MAX_GROUP_SIZE = 16;` (voir hypothèse ci-dessus).
- Suppression de tout code lié à `IERC1271`/`ownerSignature`/`rejectHash` — n'existe plus dans V2.

*Fini quand* : V2 compile, et la suite de tests V1 (Milestones B/C du POC1, sur `requestRecovery`/`revealRecovery`/`finalizeRecovery`) passe **sans modification** contre V2 — garde-fou de non-régression sur la state machine existante.

## Milestone B — `MockSemaphore` (double de test)

**Fichier** : `test/mocks/MockSemaphore.sol`

- Implémente la surface minimale d'`ISemaphore` nécessaire : `createGroup`, `addMembers`, `validateProof`.
- `createGroup` : incrémente un compteur, enregistre `admins[groupId] = msg.sender`, retourne `groupId`.
- `addMembers` : `require(msg.sender == admins[groupId])`, stocke la liste de commitments (pas besoin de reproduire le vrai LeanIMT — un simple stockage de tableau suffit pour un mock).
- `validateProof` : contrôlable par le test (un flag `shouldSucceed` settable, ou une vérification triviale "le nullifier n'a pas déjà été consommé pour ce scope" pour tester le rejet de replay sans reproduire Groth16).
- Même rôle que `MockERC7579Account` en POC1 : découpler les bugs de logique métier de `TARRecoveryExecutorV2` des bugs de vérification cryptographique réelle, qui sont testés séparément (Milestone E).

*Fini quand* : le mock compile et expose un comportement contrôlable pour les cas succès/échec/replay-nullifier.

## Milestone C — `regenerateWatchTowerGroup`

**Fichier** : `src/TARRecoveryExecutorV2.sol`

```solidity
// Owner du compte uniquement (guard via executeFromExecutor, même pattern que updateRecoveryParams)
function regenerateWatchTowerGroup(uint256[] calldata members) external;
```

- Nom choisi délibérément différent de "add"/"configure" : chaque appel **remplace** l'intégralité du groupe, il n'y a pas d'opération additive au niveau contrat. La composition de `members` (WT actives + identité du jour de l'owner + padding aléatoire jusqu'à `MAX_GROUP_SIZE`) est calculée entièrement côté front.
- `revert` si `members.length > MAX_GROUP_SIZE` ou `members.length == 0`.
- Crée un nouveau groupe (`semaphore.createGroup(...)`) et y insère `members` en un seul `addMembers` (pas d'insertion unitaire — coût O(N) une fois plutôt que O(N) répété).
- **Point technique à vérifier avant de coder cette partie, pas après** : `createGroup`/`addMembers` doivent voir `msg.sender == account` côté Semaphore (admin = smart wallet, décision actée), alors que l'appel part du module. Ça implique un `executeFromExecutor` du compte vers `Semaphore.sol` (le module ne peut pas appeler Semaphore directement pour le compte de l'owner) — même famille de risque que le format d'`executionCalldata` déjà signalé en POC1 §6 pour `TARWebAuthnValidator`. À trancher : soit deux appels `executeFromExecutor` séquentiels (`createGroup` puis `addMembers`) avec récupération du `groupId` retourné entre les deux (vérifier si le mode d'exécution ERC-7579 utilisé expose une valeur de retour), soit une fonction batchée côté Semaphore si elle existe.
- Met à jour `groupOf[msg.sender] = newGroupId` seulement après succès de l'insertion (pas avant).
- `event WatchTowerGroupRegenerated(address indexed account, uint256 indexed groupId, uint256 memberCount);`

*Fini quand* : tests contre `MockSemaphore` — happy path, rejet si `> MAX_GROUP_SIZE`, `groupOf` non modifié si l'insertion échoue en cours de route, régénérations successives qui écrasent bien l'ancien `groupId` sans jamais le référencer à nouveau.

## Milestone D — `challengeRecovery` unifié

**Fichier** : `src/TARRecoveryExecutorV2.sol`

```solidity
function challengeRecovery(
    address addressToRecover,
    ISemaphore.SemaphoreProof calldata proof
) external;
```

- `require(recoveries[addressToRecover].status == RecoveryStatus.Revealed)`.
- Vérifie que `proof.scope` correspond à la valeur attendue pour ce compte (`uint256(uint160(addressToRecover))` ou équivalent) — lie la preuve à ce compte précis, en plus du `groupId` déjà scopant.
- Appelle `semaphore.validateProof(groupOf[addressToRecover], proof)`. Comportement en cas d'échec à confirmer (voir hypothèses) — poser un `require` explicite seulement si `validateProof` retourne un booléen plutôt que de revert lui-même.
- CEI inchangé : `status = Rejected` avant le transfert du stake, `ReentrancyGuard` conservé.
- `event RecoveryRejected(address indexed addressToRecover);` — signature inchangée, plus de paramètre `broadcasterAddress`/signature à logger puisque l'identité du défenseur n'est justement jamais on-chain.

*Fini quand* : tests contre `MockSemaphore` — veto accepté fait passer `status` à `Rejected` et transfère le stake, veto refusé (proof invalide côté mock) revert sans écriture, un deuxième appel après un premier veto réussi revert sur le check de `status` (pas besoin d'atteindre `validateProof` pour le bloquer — la state machine protège déjà ce cas, indépendamment de la politique de nullifier de Semaphore).

## Milestone E — Vecteur de test croisé JS/Solidity (vraie preuve Semaphore)

**Fichier** : `test/integration/SemaphoreProofVector.t.sol`, script JS associé (hors repo contrats ou dans un dossier `script/js/`)

- Génère off-chain, via `@semaphore-protocol/core` (identité + groupe) et `@semaphore-protocol/proof` (Groth16 réel), un groupe de taille fixe avec un membre connu, un `scope` et un `message` fixés, et exporte le `SemaphoreProof` résultant en fixture (JSON) consommable par le test Foundry — même logique que le vecteur de commitment JS/Solidity de POC1 (Milestone B), mais pour une preuve complète plutôt qu'un simple hash.
- Test Foundry : déploie un vrai `Semaphore.sol` + `SemaphoreVerifier.sol` (pas le mock), reconstruit le même groupe on-chain, soumet la fixture à `challengeRecovery`, vérifie l'acceptation.
- Deuxième fixture avec un membre absent du groupe → vérifie le rejet.
- **Objectif explicite** : détecter tout mismatch d'encodage entre la génération JS et l'attente Solidity avant l'intégration Kernel, pas pendant — même motivation que le vecteur croisé de commitment en POC1, qui avait justement été signalé comme "à écrire tôt" dans le feedback POC1.

*Fini quand* : les deux fixtures (membre valide / membre absent) passent contre le vrai vérifieur Semaphore, pas contre `MockSemaphore`.

## Milestone F — Intégration Kernel réelle (V1 → V2)

**Fichier** : `script/DeployTARV2.s.sol`

- Déploiement réel de `Semaphore.sol`/`SemaphoreVerifier.sol` sur Anvil (script dédié) ; sur Sepolia, résolution de l'adresse canonique ou déploiement propre selon l'hypothèse ci-dessus.
- Désinstallation de `TARRecoveryExecutor` (V1) et installation de `TARRecoveryExecutorV2` sur le compte Kernel existant (réutilise le cycle `installModule`/`uninstallModule` déjà validé en POC1).
- `regenerateWatchTowerGroup` appelé avec une liste réelle (petite, ex. 3 membres + padding jusqu'à 16) sur un vrai compte Kernel — valide en conditions réelles le point technique laissé ouvert au Milestone C (`executeFromExecutor` vers Semaphore).
- Cycle complet exécuté en appels directs (pas encore via `EntryPoint`), comme le Milestone E de POC1.

*Fini quand* : cycle complet (regenerate → request → reveal → challenge par un membre du groupe → reject, et → challenge par un non-membre → revert) passe sur un vrai compte Kernel avec un vrai `Semaphore.sol`.

## Milestone G — Test end-to-end via UserOp/EntryPoint

**Fichier** : `test/integration/KernelWatchTowerE2E.t.sol` (extension du harness `KernelP256E2E.t.sol` de POC1, pas un harness séparé — `finalizeRecovery`/`revealRecovery` restent inchangés)

- Le flow du Milestone F encapsulé dans de vrais `PackedUserOperation`s exécutés via `EntryPoint.handleOps`, en réutilisant l'infrastructure déjà validée en POC1 (précompile P-256 pour la signature normale du compte — sans lien avec `challengeRecovery`, qui ne passe plus par WebAuthn).
- Anvil d'abord, Sepolia ensuite.

*Fini quand* : test E2E passe sur Anvil (obligatoire) et Sepolia (avant démo).

---

## Ordre recommandé

A → B → (C et D en parallèle une fois B stable — aucune dépendance croisée, tous deux testés contre `MockSemaphore`) → E (peut démarrer dès que la forme de `SemaphoreProof` est figée en A, sans attendre C/D) → F (dépend de C, D et E réels) → G

## Stratégie de tests — points à ne pas oublier par rapport à POC1

- Retirer de la suite héritée : tout test lié à `ownerSignature`/ERC-1271/`rejectHash` dans `challengeRecovery` — n'a plus de sens en V2.
- Ajouter, en plus de ce qui est listé par milestone ci-dessus : un test de non-régression explicite confirmant que `finalizeRecovery` et le chemin WebAuthn (`TARWebAuthnValidator.setNewOwner`) restent inaffectés par le changement de `challengeRecovery` — c'est un changement chirurgical, la suite doit le prouver plutôt que le supposer.
- Le vecteur croisé JS/Solidity du Milestone E doit être écrit avec des valeurs concrètes calculées (pas "à écrire"), comme corrigé après coup en POC1 Milestone B — ne pas répéter l'écart.