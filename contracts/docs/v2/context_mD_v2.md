# Contexte — Milestone D (POC2 Watch Towers) : vecteur de test croisé JS/Solidity (vraie preuve Semaphore)

Destiné à un agent (Claude Code) ayant accès au repo complet. Ne contient pas de code
d'implémentation. Complète `roadmap-poc2-watchtowers.md`, `context-milestone-a-poc2.md`,
`context-milestone-b-poc2.md` et `context-milestone-c-poc2.md`, ne les remplace pas.

**Note de numérotation** : correspond à ce que `roadmap-poc2-watchtowers.md` appelait
Milestone E. Voir `context-milestone-c-poc2.md` pour l'explication du décalage.

**Pertinence de le regrouper avec Milestone C** : ce jalon ne dépend pas de Milestone C pour
démarrer — il ne dépend que de la forme de `SemaphoreProof`, figée en Milestone A. Peut être
travaillé en parallèle, pas nécessairement après.

## 0. À lire dans le repo avant d'écrire quoi que ce soit

- `context-milestone-c-poc2.md` §5 — convention `scope = uint256(uint160(addressToRecover))` à
  respecter côté génération JS pour que le vecteur soit représentatif de ce que
  `challengeRecovery` attend réellement.
- Le vecteur de commitment JS/Solidity de POC1 (`feedback.md`, Milestone B) — même logique,
  même niveau d'exigence ("valeur concrète calculée", pas "à écrire") mais pour une preuve
  complète plutôt qu'un simple hash keccak. Beaucoup plus lourd à générer (Groth16 réel), pas
  seulement plus long.

## 1. Objectif du milestone

Détecter tout mismatch d'encodage entre la génération JS d'une preuve Semaphore et l'attente
du vrai `Semaphore.sol`/`SemaphoreVerifier.sol` **avant** l'intégration Kernel (Milestone F),
pas pendant. Contrairement à Milestone B (mock contrôlable par flag), ce jalon utilise une
vraie preuve Groth16, vérifiée par le vrai vérifieur.

## 2. Ce qu'il faut générer côté JS

Via `@semaphore-protocol/core` (identité + groupe) et `@semaphore-protocol/proof` (génération
de preuve réelle) :

- Une identité Semaphore de test (seed fixe, déterministe — pas de génération aléatoire dans ce
  vecteur, pour que la fixture soit reproductible et versionnable).
- Un groupe contenant cette identité (petite taille, pas besoin de 16 membres pour ce test —
  suffisant pour exercer le chemin de vérification réel).
- Une preuve générée avec `scope = uint256(uint160(testAccountAddress))` (convention de
  Milestone C) et un `message` fixe (une valeur de tag arbitraire suffit, pas de contrainte
  cryptographique particulière dessus).
- Export du `SemaphoreProof` résultant (`merkleTreeDepth`, `merkleTreeRoot`, `nullifier`,
  `message`, `scope`, `points[8]`) en fixture JSON, committée dans le repo.

## 3. Dépendance d'outillage à anticiper, pas à découvrir en cours de route

Générer une vraie preuve Groth16 nécessite les artefacts de proving (`.wasm`/`.zkey`) issus du
trusted setup Semaphore V4, correspondant à la profondeur d'arbre utilisée pour ce test. Ces
fichiers ne sont pas dans le code source du package `@semaphore-protocol/proof` lui-même — à
vérifier s'ils sont téléchargés automatiquement par la lib au premier appel (comportement
usuel de ce type de package) ou s'ils doivent être récupérés séparément. Si le CI de ce repo
n'a pas d'accès réseau non plus, ce point bloque la génération de la fixture en CI, pas
seulement en local — à traiter comme un point de configuration d'environnement, pas comme un
détail d'implémentation.

## 4. Comment consommer la fixture côté Foundry

Recommandation : générer la fixture **une fois**, via un script JS séparé (pas exécuté à chaque
run de test), committer le JSON résultant, et le lire côté Foundry via `vm.parseJson` — plutôt
qu'une génération live par `ffi` à chaque exécution des tests. Raisons : la fixture est
entièrement déterministe (seed fixe), une génération Groth16 est lente (contrairement au simple
hash keccak du vecteur POC1), et ça évite de dépendre de Node/snarkjs disponibles dans
l'environnement d'exécution des tests Foundry eux-mêmes. Si l'équipe préfère une génération
`ffi` à la volée pour éviter un fichier de fixture à maintenir, c'est un choix valable aussi —
à trancher selon la préférence de reproductibilité vs fraîcheur, pas une évidence dans un sens
ou l'autre.

## 5. Ce que le test Foundry doit faire

- Déployer un vrai `Semaphore.sol` + `SemaphoreVerifier.sol` (pas `MockSemaphore`).
- Reconstruire on-chain le même groupe que celui utilisé pour générer la fixture (même
  identité, donc même `identityCommitment`, insérée dans le même ordre).
- Soumettre la fixture à `challengeRecovery` (nécessite Milestone C terminée pour ce test
  précis, même si la génération de la fixture elle-même ne l'exige pas — voir la note de
  parallélisation en tête de document) et vérifier l'acceptation.
- Deuxième fixture, avec une identité absente du groupe reconstruit → vérifie que
  `InvalidWatchTowerProof` est bien levée (pas un revert générique).

## 6. Fini quand

- Les deux fixtures (membre valide / membre absent) passent contre le vrai vérifieur
  Semaphore, pas contre `MockSemaphore`.
- Aucun mismatch d'encodage entre la structure JSON exportée par JS et le `SemaphoreProof`
  Solidity attendu — c'est l'objectif explicite du jalon, à vérifier en premier si un test
  échoue de façon inattendue, avant de suspecter la logique de `challengeRecovery` elle-même.