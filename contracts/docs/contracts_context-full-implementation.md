# Contexte complet — Implémentation smart contract TAR (POC1)

Ce document résume l'ensemble des décisions actées jusqu'ici pour permettre à un nouvel agent (humain ou IA) de reprendre l'implémentation sans avoir à relire tout l'historique de discussion. Les documents sources (`paper.md`, `brainstorming.md`) restent la référence pour le concept général ; ce fichier se concentre sur les décisions d'implémentation concrètes pour le POC1.

## 1. Le concept, en bref

TAR (Timelock Account Recovery) remplace les guardians de recovery par un jeu économique : n'importe qui peut initier une recovery en stakant un `lockValue` confiscable et en attendant un `lockTime`, pendant lequel l'owner (POC2 : ou des watch towers cachées) peut rejeter/vetoter la tentative et confisquer le stake. Une recovery légitime récupère son capital ; une tentative malveillante le perd.

**Périmètre POC1** (acté dans `brainstorming.md`) :
- Pas de watch tower (POC2 uniquement).
- Compte modulaire ERC-7579 via **Kernel** (ZeroDev).
- Commit-reveal dès le départ.
- `newSigner` = passkey WebAuthn, cible finale (voir §5 sur la transition ECDSA→WebAuthn).
- Une seule recovery active à la fois par compte.

**Hors scope explicite pour ce hackathon** : gestion du compte privé (stealth address comme identité publique), griefing par un watch tower malveillant, concurrence entre recoveries, rôles d'équipe.

## 2. Séquençage du travail (sections 1, 2a, 2b, 3)

Le travail est découpé en sections traitées séquentiellement mais avec parallélisation possible entre 2a/2b, et entre la section 3 (architecture) et une piste de test de la logique métier menée en parallèle sans dépendances ERC-7579 (voir §6).

- **Section 1 — Setup Foundry** : scaffold, dépendances (`forge-std`, `openzeppelin-contracts`, `account-abstraction` v0.7.0, `kernel`, `kernel-7579-plugins`), intégration Makefile/lefthook/CI. Traité en détail dans `context-section1.md`.
- **Section 2a — Déploiement bidon Kernel/ERC-7579 (ECDSA)** : valide la mécanique Kernel/ERC-7579 (factory, `installModule`, `EntryPoint.handleOps`) avec un validator ECDSA standard, indépendamment du risque WebAuthn/P-256. Traité dans `context-section2a.md`.
- **Section 2b — Spikes WebAuthn (Kernel) + précompile P-256** : go/no-go sur (1) le fonctionnement réel en tx (pas `eth_call`) du `WebAuthnValidator` de Kernel, et (2) la disponibilité réelle du précompile `0x0100` (RIP-7212/EIP-7951) sur Anvil et Sepolia. Traité dans `context-section2b.md`. **En cours au moment de la rédaction de ce document.**
  - Contexte utile : le repo `zerodevapp/kernel-7579-plugins` contient un `WebAuthnValidator` maintenu (module type 1, P256/WebAuthn), pas une PR expérimentale isolée — le point encore ouvert est son bon fonctionnement en conditions réelles, pas son existence.
  - Fallback si échec : validator WebAuthn Solidity pur (type Daimo/FCL), branché derrière la même interface.
- **Section 3 — Architecture des contrats POC1** : objet principal de ce document, détaillée en §4.

**Stratégie de branches** : sections 1 et 2a considérées comme closes/mergées sur `main`. Section 2b menée sur sa propre branche (`feat/section-2b`), indépendante de 2a, basée sur `main` post-section-1 (pas de rebase croisé entre 2a et 2b). La section 3 (architecture des contrats) ne dépend pas du résultat de 2b pour démarrer — seule la bascule finale vers le validator WebAuthn (milestone 4, voir §5) en dépend.

## 3. Ambiguïtés de spec déjà résolues (héritées de `paper.md`)

- **Garde "une seule recovery active"** : ne peut pas être vérifiée au commit (le commitment cache `addressToRecover`) — posée et vérifiée au **reveal** uniquement.
- **Forme de `newSigner`** : une passkey WebAuthn est une paire P-256 `(pubKeyX, pubKeyY)`, pas une valeur scalaire unique — c'est aussi le format attendu par le précompile `0x0100`.
- **Destination du stake** : dans les deux issues positives pour l'utilisateur légitime (finalisation réussie **et** rejet/veto d'une tentative malveillante), le stake est reversé à `addressToRecover` — jamais perdu sauf en cas de recovery malveillante rejetée.

## 4. Architecture des contrats POC1 (section 3) — état final

Un seul module **Executor ERC-7579** (type 2), `TARRecoveryExecutor`, installé par l'owner sur son compte Kernel via `installModule`.

### 4.1 Enum et structs

```solidity
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

// Milestone B (ECDSA, temporaire)
struct RecoveryRequest {
    address broadcasterAddress;
    address newSigner;          // stocké au reveal, lu au finalize — absent du struct dans une version antérieure de ce document, corrigé
    uint256 stakedValue;
    uint256 revealTimestamp;   // point de départ du décompte lockTime
    RecoveryStatus status;
}

// Milestone C (WebAuthn) — le struct change de forme, pas seulement revealRecovery
struct RecoveryRequest {
    address broadcasterAddress;
    uint256 newPubKeyX;
    uint256 newPubKeyY;
    uint256 stakedValue;
    uint256 revealTimestamp;
    RecoveryStatus status;
}
```
`finalizeRecovery(addressToRecover)` ne prend qu'un seul paramètre : la donnée de rotation (`newSigner` ou `(pubKeyX, pubKeyY)`) est lue dans `recoveries[addressToRecover]`, écrite là au moment du reveal — pas passée à `finalizeRecovery` elle-même.

**Pas de statut `Failed` ni de fonction `withdrawFailedCommitment`.** Ces éléments existaient dans une version antérieure du plan pour gérer un montant staké incorrect détecté après coup. Depuis que la value est envoyée directement à `revealRecovery` (voir §4.3) et vérifiée immédiatement contre `configs[addressToRecover].lockValue`, un mauvais montant fait simplement revert la transaction — aucun état n'est jamais écrit, donc rien à "réparer" après coup. Décision confirmée explicitement par l'équipe.

### 4.2 Storage

```solidity
mapping(address => RecoveryConfig) public configs;          // configs[account]
mapping(bytes32 => bool) public pendingCommitments;          // existence uniquement, pas de stake ni timestamp
mapping(address => RecoveryRequest) public recoveries;       // clé = addressToRecover, pas un recoveryId séparé
```

Points de design associés :
- **Pas de `recoveryId` séparé** : la reconstruction du commitment au reveal suffit comme clé pendant la phase pending ; après reveal, l'indexation bascule sur `addressToRecover` directement (les fonctions `challengeRecovery`/`finalizeRecovery` ne prennent qu'un seul paramètre : l'adresse du compte ciblé).
- **Pas de mapping `activeRecovery` séparé** : `recoveries[addressToRecover].status == RecoveryStatus.Revealed` **est** la garde active-recovery — un mapping dédié serait redondant et risquerait de désynchroniser deux sources de vérité.
- **`pendingCommitments` réduit à un mapping d'existence** (`bytes32 => bool`) : comme aucune value n'est stakée au `requestRecovery` et qu'aucune expiration n'est monitorée (voir limite acceptée ci-dessous), il n'y a besoin ni de `stakedValue` ni de `requestTimestamp` à ce stade.

### 4.3 Fonctions

```solidity
// Owner du compte uniquement (guard onlyAccount / via executeFromExecutor)
function updateRecoveryParams(uint256 lockValue, uint256 lockTime) external;
```

```solidity
// N'importe qui, non-payable
function requestRecovery(bytes32 commitment) external;
```
Enregistre l'existence du commitment dans `pendingCommitments`. Ne révèle aucune information sur `addressToRecover` (caché dans le hash). Émet `RecoveryRequested`.

```solidity
// Doit être appelé par broadcasterAddress (msg.sender == broadcasterAddress, sinon revert)
// payable : msg.value doit être exactement égal à configs[addressToRecover].lockValue, sinon revert
function revealRecovery(
    address addressToRecover,
    address broadcasterAddress,
    bytes32 pubKeyX,
    bytes32 pubKeyY,
    bytes32 salt
) external payable;
```
Recalcule le commitment (formule en §4.4), vérifie qu'il existe dans `pendingCommitments`, vérifie qu'aucune recovery n'est déjà `Revealed` sur ce compte (garde active-recovery), consomme l'entrée `pendingCommitments` (delete), écrit `recoveries[addressToRecover]`, émet `RecoveryRevealed`.

```solidity
// Owner du compte ciblé, vérifié via ERC-1271 (isValidSignature du compte, agnostique du validator actif)
function challengeRecovery(address addressToRecover, bytes calldata ownerSignature) external;
```
Rejette la recovery en cours (`status = Rejected`), transfère le stake à `addressToRecover`, émet `RecoveryRejected`.

**Hash signé par l'owner (résolu) :**
```solidity
bytes32 rejectHash = keccak256(abi.encodePacked(
    address(this),              // ce contrat — anti-replay inter-contrats
    block.chainid,               // anti-replay inter-chaînes
    addressToRecover,
    broadcasterAddress,          // unique par tentative (stealth address)
    revealTimestamp,             // horodatage de reveal de cette tentative précise
    "REJECT"                     // tag de domaine
));
// require(IERC1271(addressToRecover).isValidSignature(rejectHash, ownerSignature) == 0x1626ba7e)
```
`broadcasterAddress` + `revealTimestamp` (lus dans `recoveries[addressToRecover]`) suffisent à lier la signature à cette tentative précise et empêchent le rejeu d'une ancienne signature de rejet sur une tentative future — sans avoir besoin d'un `recoveryId` séparé.

```solidity
// N'importe qui, appelable seulement après expiration de lockTime sans challenge
function finalizeRecovery(address addressToRecover) external;
```
Appelle `executeFromExecutor` pour que le compte s'auto-installe le nouveau validator WebAuthn avec `(pubKeyX, pubKeyY)` (ou `newSigner` en Milestone B), lu depuis `recoveries[addressToRecover]` — pas passé en paramètre de `finalizeRecovery`. Transfère le stake à `addressToRecover`, `status = Finalized`, émet `RecoveryFinalized`.

**Note sur les tests (Milestones B/C)** : ni `ECDSAValidator` ni `WebAuthnValidator` (stock Kernel) n'ont de fonction de rotation, et `TARWebAuthnValidator` (§6) est développé séparément, plus tard. `finalizeRecovery` est donc testé aux Milestones B et C contre un **mock de validator trivial** (une fonction `setNewOwner` factice qui enregistre l'appel), pas contre un vrai validator — ECDSA n'a de toute façon jamais d'utilité en production (le séquencement bascule vers WebAuthn avant l'intégration Kernel réelle, Milestone E). Seule l'intégration Kernel réelle dépend d'un `TARWebAuthnValidator` fonctionnel.

**Boilerplate `IERC7579Module` (résolu, vérifié contre `erc7579/erc7579-implementation`, le repo de référence cité par l'EIP) :**
```solidity
interface IERC7579Module {
    function onInstall(bytes calldata data) external;
    function onUninstall(bytes calldata data) external;
    function isModuleType(uint256 moduleTypeId) external view returns (bool);
    function isInitialized(address smartAccount) external view returns (bool);
}
```
Aucune de ces fonctions n'est `payable` dans la version canonique de référence. Dernier point à vérifier au moment du code : que Kernel n'impose pas une variante différente via sa propre base contract — peu probable mais pas encore confirmé sur l'implémentation Kernel spécifiquement (la vérification ci-dessus porte sur la spec de référence, pas sur le code Kernel).

### 4.4 Formule du commitment

```
commitment = keccak256(abi.encodePacked(
    addressToRecover,
    broadcasterAddress,
    pubKeyX,
    pubKeyY,
    salt
))
```

Calculé côté front (lib JS, `TARCommitments.sol` mis de côté pour l'instant). **Point de vigilance non encore vérifié** : l'encodage JS doit produire exactement le même hash que `abi.encodePacked` en Solidity — un vecteur de test croisé (mêmes inputs des deux côtés) est recommandé avant intégration, pour éviter un mismatch d'encodage difficile à tracer.

Rôle du `salt` : garantit l'unicité du commitment en cas de retry avec le même triplet (`addressToRecover`, `broadcasterAddress`, `newSigner`), et ajoute une marge d'imprévisibilité avant le reveal.

### 4.5 Events

```solidity
event RecoveryRequested(bytes32 indexed commitment);
event RecoveryRevealed(address indexed addressToRecover, address indexed broadcasterAddress, uint256 challengeDeadline);
event RecoveryRejected(address indexed addressToRecover);
event RecoveryFinalized(address indexed addressToRecover);
event RecoveryParamsUpdated(address indexed account, uint256 lockValue, uint256 lockTime);
```

### 4.6 Exigences transverses

- **ReentrancyGuard (OpenZeppelin)** sur les fonctions qui déplacent de l'ETH : `challengeRecovery`, `finalizeRecovery`.
- **Pattern CEI** (checks-effects-interactions) : statut mis à jour avant le transfert de stake, sur ces deux mêmes fonctions.
- **Pas de `policyRoot` ni de stub ZK en POC1** : concept POC2 uniquement (watch towers), différé volontairement — le cycle install/uninstall d'ERC-7579 rend une migration ultérieure peu coûteuse (`TARRecoveryExecutorV2`).

## 5. Séquencement ECDSA → WebAuthn (milestones internes à la section 3)

Le milestone 3 implémente la state machine (commit-reveal, garde active-recovery, timelock, anti-front-running) avec le validator **ECDSA** existant de Kernel — `newSigner` y est alors un simple `address`, pas une paire `(pubKeyX, pubKeyY)`. Le milestone 4 bascule vers le validator WebAuthn réel.

**Intérêt** : décorréler les bugs de logique métier des bugs de vérification cryptographique P-256/WebAuthn. Le milestone 3 n'a besoin d'aucun résultat de la section 2b pour avancer.

**Coût à ne pas sous-estimer** : `newSigner` fait partie du commitment. Passer d'un `address` à `(pubKeyX, pubKeyY)` change la forme du hash, donc la signature de `revealRecovery`, donc le calcul du commitment côté front. Le milestone 4 **réécrit** une bonne partie du harness de test du milestone 3 (même si la logique de state machine testée reste valide conceptuellement) — ce n'est pas une simple extension.

## 6. Rotation de clé WebAuthn — `TARWebAuthnValidator`

Constat : ni `ECDSAValidator.sol` ni `WebAuthnValidator.sol` (Kernel) n'implémentent de fonction de rotation de clé — seulement `onInstall`/`onUninstall`. `finalizeRecovery` a pourtant besoin d'installer un nouveau signer sur un compte déjà initialisé.

**Décision** : fork complet de `WebAuthnValidator.sol` en un nouveau contrat `TARWebAuthnValidator.sol`, ajoutant une seule fonction :

```solidity
function setNewOwner(uint256 newPubKeyX, uint256 newPubKeyY) external payable {
    if (!_isInitialized(msg.sender)) revert NotInitialized(msg.sender);
    if (newPubKeyX == 0 || newPubKeyY == 0) revert InvalidPublicKey();
    webAuthnValidatorStorage[msg.sender] = WebAuthnValidatorData(newPubKeyX, newPubKeyY);
    emit WebAuthnRegistered(msg.sender, newPubKeyX, newPubKeyY);
}
```

**Sécurité** : aucun guard explicite nécessaire. `msg.sender` dans `setNewOwner` est structurellement le compte lui-même, parce que `finalizeRecovery` appelle cette fonction via `addressToRecover.executeFromExecutor(...)` — dans ce chemin, c'est le compte cible qui exécute l'appel. Un appel direct externe ne peut jamais usurper cette identité.

**Tout le reste du fichier est repris à l'identique** (`onInstall`, `onUninstall`, `isModuleType`, `isInitialized`, `validateUserOp`, `isValidSignatureWithSender`, `_verifySignature`) — pas d'héritage Solidity (le storage par mapping de Kernel ne s'y prête pas proprement), un fork intégral.

**Dépendance non résolue** : le format exact de l'`executionCalldata` passé à `executeFromExecutor` (target/value/calldata encodés) doit être vérifié contre la lib ERC-7579 réellement utilisée — l'encodage varie légèrement selon les implémentations.

**Portée du risque hérité** : `WebAuthn.verifySignature`/`usePrecompiled` sont repris sans modification — le go/no-go du précompile P-256 (section 2b) s'applique à `TARWebAuthnValidator` à l'identique de `WebAuthnValidator`. Le fork n'introduit ni ne résout ce risque.

**Fichier** : `smart-contract/src/validators/TARWebAuthnValidator.sol` — à ajouter à la structure définie en `context-section1.md`.

## 7. Limites connues et acceptées pour ce POC (à ne pas corriger maintenant)

- **Spam de `pendingCommitments`** : `requestRecovery` est désormais entièrement gratuit (aucune value en jeu, seulement le coût du gas). Un attaquant peut soumettre un nombre arbitraire de commitments creux sans autre coût que le gas. **Accepté explicitement comme limite du POC** — pas de mécanisme anti-spam ni d'expiration à implémenter pour ce hackathon.
- **Griefing par un watch tower malveillant** (POC2 seulement, hors périmètre POC1) : déjà noté dans `brainstorming.md`.

Aucun point ouvert restant sur l'architecture à ce stade — le hash de `challengeRecovery` et les signatures `IERC7579Module` sont résolus en §4.3. Pas de piste de test parallèle en cours : toute la logique métier est développée directement dans le cadre de la section 3.

## 8. Fichiers de référence associés

- `paper.md`, `brainstorming.md` — concept et décisions produit d'origine.
- `context-section1.md` — setup Foundry.
- `context-section2a.md` — déploiement bidon Kernel/ERC-7579 ECDSA.
- `context-section2b.md` — spikes WebAuthn + précompile P-256 (en cours).
- `interface-tar-recovery.md` — version front-facing de l'interface (§4 de ce document), destinée à l'équipe front pour travailler en parallèle.
- `plan-smart-contract.md` — plan global séquencé des sections.
