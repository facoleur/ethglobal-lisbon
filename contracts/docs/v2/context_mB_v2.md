# Contexte — Milestone B (POC2 Watch Towers) : `MockSemaphore`

Destiné à un agent (Claude Code) ayant accès au repo complet. Ne contient pas de code
d'implémentation. Complète `roadmap-poc2-watchtowers.md` et `context-milestone-a-poc2.md`
(même périmètre, Milestone B), ne les remplace pas.

**Régénéré** par rapport à une première version : celle-ci utilisait `validateProof`, en
contradiction avec la décision déjà actée dans la conversation d'utiliser `verifyProof`. Voir
§3 pour le raisonnement complet — la différence n'est pas cosmétique, elle change la forme du
mock (fonction `view` retournant un `bool`, pas une fonction state-changing qui revert).

## 0. À lire dans le repo avant d'écrire quoi que ce soit

- `test/mocks/MockERC7579Account.sol` (POC1, `feedback.md` Milestone B) — même rôle et même
  esprit pour `MockSemaphore` : découpler les bugs de logique métier de
  `TARRecoveryExecutorV2` des bugs de vérification cryptographique réelle (Groth16, LeanIMT),
  testés séparément en Milestone E. Reprendre le même niveau de simplicité, pas plus.
- `TARRecoveryExecutorV2.sol` (Milestone A) — pour la liste exacte des fonctions `ISemaphore`
  réellement appelées (`createGroup(admin, duration)`, `addMembers`, et **`verifyProof`** en
  Milestone D) : c'est ce qui détermine ce qui doit avoir une vraie logique dans le mock, le
  reste n'est que de la conformité d'interface.

## 1. Objectif du milestone

Écrire `test/mocks/MockSemaphore.sol`, un double de test qui implémente `ISemaphore` en entier
(conformité d'interface) mais avec une logique réelle seulement sur les trois fonctions
utilisées par `TARRecoveryExecutorV2` : `createGroup`, `addMembers`, `verifyProof`. Aucun
LeanIMT, aucun Groth16 réel — un stockage de tableau simple suffit.

## 2. Surface d'interface à couvrir

`ISemaphore` (v4.0.0) déclare, au-delà des trois fonctions ci-dessus : `groupCounter()`,
`createGroup()` (0-arg), `createGroup(admin)` (1-arg), `updateGroupAdmin`, `acceptGroupAdmin`,
`updateGroupMerkleTreeDuration`, `addMember` (singulier), `updateMember`, `removeMember`,
`validateProof`. Aucune de ces fonctions n'est appelée par `TARRecoveryExecutorV2` à ce stade —
implémenter des stubs minimaux (revert `"not implemented"` ou équivalent) pour satisfaire
`is ISemaphore`, sans leur donner de comportement réel. Ne pas les laisser silencieusement
absentes : le mock doit compiler comme un `ISemaphore` complet, pas comme un sous-ensemble.
`validateProof` en particulier n'est **pas** utilisée par le contrat (voir §3) — un stub suffit,
ne pas lui donner de vraie logique de nullifier par erreur de symétrie avec `verifyProof`.

## 3. Pourquoi `verifyProof`, pas `validateProof` — et ce que ça change pour le mock

Vérifié dans le vrai `Semaphore.sol` (`semaphore-protocol/semaphore`, tag `v4.0.0`) :

```solidity
function validateProof(uint256 groupId, SemaphoreProof calldata proof) external override {
    if (groups[groupId].nullifiers[proof.nullifier]) revert Semaphore__YouAreUsingTheSameNullifierTwice();
    if (!verifyProof(groupId, proof)) revert Semaphore__InvalidProof();
    groups[groupId].nullifiers[proof.nullifier] = true;
    ...
}

function verifyProof(uint256 groupId, SemaphoreProof calldata proof) public view override returns (bool) {
    // vérifie profondeur, groupe non-vide, fraîcheur de racine, puis délègue au vérifieur Groth16
    // ne lit ni n'écrit jamais `nullifiers`
}
```

`verifyProof` ne fait **aucun** suivi de nullifier — c'est `validateProof` seul qui s'en charge,
en appelant `verifyProof` en interne. `TARRecoveryExecutorV2` utilise `verifyProof` (décision
actée : la protection contre un double-veto sur une même tentative vient du `status` du contrat,
pas de Semaphore — voir `roadmap-poc2-watchtowers.md`). Conséquence directe pour le mock :
**pas besoin de simuler un suivi de nullifier** — ça n'existerait pas non plus dans le vrai
comportement de la fonction réellement appelée. Une version antérieure de ce document
recommandait de le simuler ; c'était une erreur issue d'une confusion avec `validateProof`, à
ne pas reproduire.

## 4. Comportement attendu des trois fonctions utilisées

**`createGroup(address admin, uint256 merkleTreeDuration) returns (uint256)`**
- Incrémente un compteur interne, retourne le nouveau `groupId`.
- Enregistre l'admin (`admins[groupId] = admin`) — permet au test de vérifier que
  `TARRecoveryExecutorV2` passe bien le compte comme admin, pas le module (cf. contexte
  Milestone A §5).
- `merkleTreeDuration` peut être stocké ou ignoré selon ce qui est utile aux tests de ce
  milestone — sans conséquence tant qu'aucun test ne dépend d'une expiration réelle de racine.

**`addMembers(uint256 groupId, uint256[] calldata identityCommitments)`**
- `require(msg.sender == admins[groupId])` — condition à tester explicitement (rejet si un
  appelant autre que l'admin enregistré tente d'insérer).
- Stocke la liste telle quelle (un `mapping(uint256 => uint256[])` suffit). Pas de calcul de
  racine Merkle réel : ce mock ne simule pas de LeanIMT, seulement l'autorisation et la
  persistance de la liste de membres.

**`verifyProof(uint256 groupId, SemaphoreProof calldata proof) view returns (bool)`**
- `view`, ne modifie aucun état — contrairement à ce qu'impliquerait un mock calqué sur
  `validateProof`.
- Comportement contrôlable par le test : un flag `shouldSucceed` settable (par exemple
  `mapping(uint256 => bool) public forcedResult`, indexé par `groupId` ou globalement selon ce
  qui est le plus simple à piloter depuis les tests de Milestone D), retourné tel quel.
- Reproduire, si utile aux tests de Milestone D, les reverts structurels réels plutôt que de les
  black-boxer derrière le flag : `Semaphore__GroupHasNoMembers` si le groupe ciblé n'a aucun
  membre enregistré (permet de tester le cas "compte jamais configuré, `groupOf` à zéro"). Les
  autres reverts structurels réels (`Semaphore__MerkleTreeDepthIsNotSupported`,
  `Semaphore__MerkleTreeRootIsNotPartOfTheGroup`, `Semaphore__MerkleTreeRootIsExpired`) peuvent
  rester des stubs non déclenchés par le mock — aucun test de Milestone D n'en dépend a priori,
  puisque ce mock ne simule pas de racine ni de profondeur réelles.

## 5. Ce qui ne doit explicitement pas être fait ici

- Simuler un suivi de nullifier dans `verifyProof` — voir §3, ça ne correspondrait à aucun
  comportement réel de la fonction effectivement appelée par `TARRecoveryExecutorV2`.
- Reproduire un vrai LeanIMT (zero hashes, profondeur dynamique) — hors périmètre, jamais
  nécessaire pour tester `TARRecoveryExecutorV2`, qui ne lit jamais la racine ou la profondeur
  directement.
- Vérifier une vraie preuve Groth16 — Milestone E s'en charge contre le vrai `Semaphore.sol`
  déployé.

## 6. Fini quand

- `MockSemaphore` compile en tant que `ISemaphore` complet.
- Tests couvrant : `createGroup` retourne des `groupId` croissants et distincts par appel ;
  `addMembers` par le bon admin réussit et stocke la liste ; `addMembers` par un appelant qui
  n'est pas l'admin enregistré revert ; `verifyProof` avec `shouldSucceed = true` retourne
  `true` ; `verifyProof` avec `shouldSucceed = false` retourne `false` (pas de revert) ;
  `verifyProof` sur un groupe sans membre revert avec `Semaphore__GroupHasNoMembers` si ce cas
  est jugé utile à tester dès ce milestone.
- Ces tests exercent uniquement `MockSemaphore` isolément — l'intégration avec
  `TARRecoveryExecutorV2.regenerateWatchTowerGroup` (déjà testée en Milestone A avec un stub
  minimal) n'a pas besoin d'être ré-testée ici, seulement le mock lui-même.