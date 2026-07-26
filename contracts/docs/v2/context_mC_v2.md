# Contexte — Milestone C (POC2 Watch Towers) : `challengeRecovery` unifié

Destiné à un agent (Claude Code) ayant accès au repo complet. Ne contient pas de code
d'implémentation. Complète `roadmap-poc2-watchtowers.md`, `context-milestone-a-poc2.md` et
`context-milestone-b-poc2.md`, ne les remplace pas.

**Note de numérotation** : dans `roadmap-poc2-watchtowers.md`, cette fonctionnalité était
listée comme Milestone D (le roadmap y appelait "Milestone C" ce qui a en fait été absorbé
dans `context-milestone-a-poc2.md` §5, `regenerateWatchTowerGroup`). Ce document reprend la
numérotation par ordre de travail restant, pas celle du roadmap d'origine — pas de contenu
manquant, juste un décalage d'étiquette dont il faut avoir conscience en comparant les deux
documents.

## 0. À lire dans le repo avant d'écrire quoi que ce soit

- `TARRecoveryExecutorV2.sol` (Milestone A) — storage déjà en place (`groupOf`, `semaphore`
  immutable), et surtout : **ce fichier doit être amendé**, pas seulement lu. Voir §2.
- `MockSemaphore.sol` (Milestone B) — `verifyProof` y est un `view` piloté par un flag
  `shouldSucceed`, pas une fonction qui revert. Le code de `challengeRecovery` doit donc gérer
  lui-même le cas d'échec (§3), pas compter sur un revert de Semaphore.

## 1. Objectif du milestone

Réintroduire `challengeRecovery`, absente depuis Milestone A, sous une forme unique : owner et
watch tower empruntent le même chemin de vérification, une preuve Semaphore. Plus aucune trace
d'`IERC1271`/`ownerSignature`/`rejectHash`.

```solidity
function challengeRecovery(
    address addressToRecover,
    ISemaphore.SemaphoreProof calldata proof
) external;
```

## 2. Amendement requis à `ITARRecoveryV2.sol` (Milestone A) — pas juste une lecture

L'interface générée en Milestone A ne déclare pas d'erreur pour un échec de vérification de
preuve, parce qu'elle anticipait `validateProof` (qui revert lui-même). Le fait vérifié n°5
(corrigé depuis, voir `context-milestone-a-poc2.md`) confirme qu'on utilise `verifyProof`, qui
**retourne `false`** au lieu de revert sur une preuve cryptographiquement invalide. Ajouter à
`ITARRecoveryV2` :

- `error InvalidWatchTowerProof();` — levée si `verifyProof` retourne `false`.
- `error WatchTowerGroupNotConfigured();` — voir §4, cas `groupOf[addressToRecover] == 0`.
- (optionnel, voir §5) `error ScopeMismatch();` si le check de `scope` est conservé.

## 3. Comportement attendu

- `require(recoveries[addressToRecover].status == RecoveryStatus.Revealed)` — sinon
  `RecoveryNotRevealed` (déjà déclarée).
- Voir §4 pour le check `groupOf[addressToRecover] != 0`, **à faire avant** l'appel à
  `verifyProof`, pas après.
- Appelle `semaphore.verifyProof(groupOf[addressToRecover], proof)` ; si le retour est `false`,
  revert `InvalidWatchTowerProof()`. Le mock (Milestone B) permet de tester ce chemin sans
  vraie preuve — `shouldSucceed = false` doit produire exactement ce revert, pas un revert
  générique.
- CEI inchangé par rapport à l'ancien `challengeRecovery` : `status = Rejected` avant le
  transfert du stake, `nonReentrant` conservé.
- `emit RecoveryRejected(addressToRecover);` — event déjà déclaré, inchangé.

## 4. Un piège trouvé en vérifiant le vrai code Semaphore — à corriger, pas à ignorer

`groupOf[addressToRecover]` vaut `0` par défaut tant qu'un compte n'a jamais appelé
`regenerateWatchTowerGroup`. Problème : dans le vrai `Semaphore.sol`, `groupId = 0` est un
identifiant de groupe **parfaitement valide** — c'est celui attribué au tout premier groupe
jamais créé par n'importe qui sur cette instance de Semaphore (le compteur `groupCounter`
démarre à 0). Rien ne distingue donc, dans `groupOf`, "ce compte n'a jamais configuré de
défenseurs" de "ce compte est légitimement rattaché au groupe 0". Un attaquant pourrait
soumettre une preuve valide pour le groupe 0 d'un tiers contre un compte qui n'a jamais
configuré de watch towers, et faire passer ça pour un veto légitime.

Deux corrections, les deux recommandées ensemble (l'une ne remplace pas l'autre) :

1. **Brûler le groupe 0 au déploiement.** Dans le constructeur de `TARRecoveryExecutorV2` (ou
   dans le script de déploiement, Milestone F), appeler une fois
   `semaphore.createGroup(address(this), ...)` ou toute adresse non exploitable, pour que le
   groupe 0 existe déjà et n'appartienne à aucun compte réel avant que quiconque n'appelle
   `regenerateWatchTowerGroup`. Garantit que tout `groupOf[account]` réellement assigné par ce
   contrat est `>= 1`.
2. **Check explicite dans `challengeRecovery`** : `if (groupOf[addressToRecover] == 0) revert WatchTowerGroupNotConfigured();`
   avant l'appel à `verifyProof` — défense en profondeur, peu coûteuse, qui ne dépend pas de la
   correction n°1 pour être efficace.

Ce défaut existait déjà potentiellement en Milestone A (`regenerateWatchTowerGroup` ne s'en
protège pas non plus, bien qu'il soit moins exploitable dans ce sens précis puisque c'est
toujours l'owner qui l'appelle) — le signaler ici parce que c'est en écrivant `challengeRecovery`
que le chemin d'exploitation devient concret (n'importe qui peut l'appeler), mais la correction
n°1 (brûler le groupe 0) doit être ajoutée au constructeur écrit en Milestone A.

## 5. Le check de `scope` : moins essentiel qu'il n'y paraissait — à garder pour une raison différente

`roadmap-poc2-watchtowers.md` recommandait de vérifier `proof.scope` contre une valeur attendue
"en plus du `groupId` déjà scopant". En relisant le vrai `verifyProof` pour ce document, cette
justification ne tient pas complètement : `proof.scope` est un input public passé au vérifieur
Groth16 lui-même (`_hash(proof.scope)`) — le remplacer par une valeur incohérente avec ce que le
prouveur a réellement utilisé fait déjà échouer la vérification cryptographique, sans qu'un
check applicatif séparé soit nécessaire pour la sécurité. Et puisque `groupOf` attribue un
`groupId` unique par compte (aucune régénération ne réutilise un ancien `groupId`, cf.
Milestone A), le `groupId` seul suffit déjà à empêcher qu'une preuve générée pour un autre
compte soit acceptée ici.

Le check garde malgré tout de la valeur, pour une raison différente et plus modeste : c'est un
**garde-fou bon marché contre les bugs de génération côté front**, qui échoue vite (avant
l'appel `verifyProof`, plus coûteux) plutôt que de laisser une preuve mal formée échouer
silencieusement plus loin avec un message d'erreur moins informatif. Recommandation : le garder,
mais ne pas le présenter comme une protection contre une attaque réelle dans ce design précis —
seulement comme un fail-fast. Valeur attendue suggérée : `uint256(uint160(addressToRecover))`
(convention à faire respecter côté génération de preuve front, hors périmètre contrat).

## 6. Fini quand

- Tests contre `MockSemaphore` : veto accepté (`shouldSucceed = true`) fait passer `status` à
  `Rejected` et transfère le stake ; veto refusé (`shouldSucceed = false`) revert avec
  `InvalidWatchTowerProof`, sans écriture d'état ; un deuxième appel après un premier veto
  réussi revert sur `RecoveryNotRevealed` (le check de `status` bloque avant même d'atteindre
  `verifyProof` — indépendant de tout comportement de Semaphore) ; appel sur un compte dont
  `groupOf` vaut encore `0` revert `WatchTowerGroupNotConfigured`, y compris si `MockSemaphore`
  a par ailleurs un groupe `0` configuré par un autre test (à construire délibérément dans la
  suite de tests pour vérifier que ce cas précis est bien couvert, pas juste supposé).
- Le constructeur de `TARRecoveryExecutorV2` brûle bien le groupe `0` — test dédié vérifiant
  que `groupOf` d'un compte jamais configuré ne peut jamais collision­ner avec un groupe réel.