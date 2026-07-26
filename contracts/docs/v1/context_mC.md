# Context — Milestone C : Bascule vers commitment WebAuthn `(pubKeyX, pubKeyY)`

## Objectif

Remplacer `newSigner` (address, ECDSA temporaire — Milestone B) par la paire `(pubKeyX, pubKeyY)` (uint256, format réel d'une clé publique P-256/WebAuthn) dans `revealRecovery`, le storage, et le calldata construit par `finalizeRecovery`. Ce n'est pas une extension de la Milestone B : le format d'entrée change, le harness de test est réécrit, pas étendu.

## Correction de type avant de commencer

`pubKeyX`/`pubKeyY` sont typés **`uint256`**, pas `bytes32` — pour matcher exactement `WebAuthnValidatorData` (Kernel) et `TARWebAuthnValidator.setNewOwner` (`context-full-implementation.md` §6). Une précédente version de l'interface (`interface-tar-recovery.md`, `context-full-implementation.md` §4.3) utilisait `bytes32` — à corriger dans ces deux fichiers en parallèle de cette milestone pour éviter un cast implicite à chaque frontière entre `TARRecoveryExecutor` et le validator.

Remarque technique : `abi.encodePacked` produit la même séquence d'octets pour un `uint256` et un `bytes32` de même valeur (les deux font 32 octets) — le hash du commitment n'est donc pas affecté numériquement par ce changement de type, seule la signature des fonctions Solidity et le typage côté front (génération ethers/viem) changent.

## Hors scope explicite pour cette milestone

- **Pas de vrai `TARWebAuthnValidator`** : `finalizeRecovery` continue d'appeler le mock de test (adapté au nouveau format), pas le vrai validator (Milestone D) — cette milestone ne dépend pas de D, comme actée précédemment.
- **Pas de vraie intégration Kernel** : toujours contre un mock de compte — c'est la Milestone E.
- **Pas de vérification WebAuthn réelle** (authenticatorData/clientDataJSON) : ça reste entièrement dans le périmètre du spike section 2b et de `TARWebAuthnValidator`, hors de `TARRecoveryExecutor`.

## Prérequis

Milestone B terminée : state machine commit-reveal fonctionnelle avec `newSigner` en `address`, tous les tests listés dans `context-milestoneB.md` passants.

## Fichiers

```
smart-contract/
  src/
    TARRecoveryExecutor.sol       # modifié : RecoveryRequest, revealRecovery, calldata de finalizeRecovery
    interfaces/ITARRecovery.sol   # modifié : signature de revealRecovery
  test/
    unit/TARRecoveryExecutor.t.sol   # réécrit, pas étendu
    mocks/MockRotatableValidator.sol # modifié : setNewOwner(uint256,uint256)
```

## Storage : `RecoveryRequest` change de forme

```solidity
// Remplace la version Milestone B (address newSigner)
struct RecoveryRequest {
    address broadcasterAddress;
    uint256 newPubKeyX;
    uint256 newPubKeyY;
    uint256 stakedValue;
    uint256 revealTimestamp;
    RecoveryStatus status;
}
```
`RecoveryConfig`, `pendingCommitments`, `recoveries` (mapping) : inchangés dans leur déclaration, seul le contenu du struct `RecoveryRequest` qu'ils référencent change.

## Interface `ITARRecovery` — signature modifiée

```solidity
function revealRecovery(
    address addressToRecover,
    address broadcasterAddress,
    uint256 pubKeyX,
    uint256 pubKeyY,
    bytes32 salt
) external payable;
```
Les autres fonctions de l'interface (`requestRecovery`, `challengeRecovery`, `finalizeRecovery`, `updateRecoveryParams`) sont inchangées.

## Fonctions modifiées

### `revealRecovery`
```solidity
function revealRecovery(
    address addressToRecover,
    address broadcasterAddress,
    uint256 pubKeyX,
    uint256 pubKeyY,
    bytes32 salt
) external payable {
    if (!_isInitialized(addressToRecover)) revert NotInitialized(addressToRecover);
    if (recoveries[addressToRecover].status == RecoveryStatus.Revealed) {
        revert RecoveryAlreadyActive(addressToRecover);
    }
    if (msg.sender != broadcasterAddress) revert InvalidBroadcaster();

    bytes32 commitment = keccak256(abi.encodePacked(addressToRecover, broadcasterAddress, pubKeyX, pubKeyY, salt));
    if (!pendingCommitments[commitment]) revert CommitmentNotFound();

    if (msg.value != configs[addressToRecover].lockValue) revert WrongStakedAmount();

    delete pendingCommitments[commitment];

    recoveries[addressToRecover] = RecoveryRequest({
        broadcasterAddress: broadcasterAddress,
        newPubKeyX: pubKeyX,
        newPubKeyY: pubKeyY,
        stakedValue: msg.value,
        revealTimestamp: block.timestamp,
        status: RecoveryStatus.Revealed
    });

    emit RecoveryRevealed(addressToRecover, broadcasterAddress, block.timestamp + configs[addressToRecover].lockTime);
}
```
Structure identique à la Milestone B, seuls les paramètres/champs `newSigner` → `pubKeyX`/`pubKeyY` changent.

**Décision à prendre, pas strictement nécessaire** : valider ici que `pubKeyX != 0 && pubKeyY != 0` (comme le fait `TARWebAuthnValidator.setNewOwner`), pour échouer au reveal plutôt que de laisser l'utilisateur attendre tout le `lockTime` avant de découvrir au finalize que sa clé était invalide. Pas indispensable pour la correction du contrat (un appel invalide fait revert `finalizeRecovery` dans son intégralité, aucun état ne reste incohérent), mais meilleur pour l'UX. À toi de trancher si ça vaut le coup pour le hackathon.

### `finalizeRecovery` — calldata modifié
```solidity
uint256 pubKeyX = req.newPubKeyX;
uint256 pubKeyY = req.newPubKeyY;
req.status = RecoveryStatus.Finalized;

bytes memory rotationCalldata = abi.encodeWithSignature("setNewOwner(uint256,uint256)", pubKeyX, pubKeyY);
IERC7579Account(addressToRecover).executeFromExecutor(
    MODE_SINGLE,
    abi.encodePacked(validator, uint256(0), rotationCalldata)
);
```
Le reste de `finalizeRecovery` (vérification `status`/`lockTime`, transfert du stake, event, `nonReentrant`, pattern CEI) est inchangé par rapport à la Milestone B.

## Mock à adapter : `MockRotatableValidator.sol`

```solidity
contract MockRotatableValidator {
    mapping(address => uint256) public currentPubKeyX;
    mapping(address => uint256) public currentPubKeyY;

    function setNewOwner(uint256 newPubKeyX, uint256 newPubKeyY) external {
        currentPubKeyX[msg.sender] = newPubKeyX;
        currentPubKeyY[msg.sender] = newPubKeyY;
    }
}
```
Remplace la version Milestone B (`address newOwner`) — pas une surcharge, un remplacement complet de la fonction.

## Stratégie de tests — Milestone C

Même liste que `context-milestoneB.md` (happy path, rejet owner, bornes du timelock, anti-front-running, rejeu de commitment, garde active-recovery, mauvais montant, cible non initialisée, signature de rejet invalide), réécrite avec `(pubKeyX, pubKeyY)` à la place de `newSigner`, et assertions sur `MockRotatableValidator.currentPubKeyX`/`currentPubKeyY` à la place de `currentOwner`.

**Vecteur de test croisé JS/Solidity** (`context-full-implementation.md` §4.4) : à réécrire avec des `uint256` réels côté JS (pas des `bytes32` hex) pour la formule du commitment — vérifier que la lib front (ethers/viem) encode bien les grands entiers P-256 comme des `uint256`, pas comme des chaînes hex de 32 octets qui produiraient un encodage différent si mal typées.

**Point ouvert non résolu, hérité de la Milestone B** : comportement de `challengeRecovery` après expiration du `lockTime` mais avant `finalizeRecovery` — toujours pas tranché, voir `context-milestoneB.md`.

## Critère de fin

- `revealRecovery`, `RecoveryRequest`, `ITARRecovery`, `MockRotatableValidator` utilisent `(pubKeyX, pubKeyY)` en `uint256`.
- Même suite de tests que la Milestone B, adaptée, entièrement passante.
- `finalizeRecovery` construit un calldata `setNewOwner(uint256,uint256)` correctement formé (vérifié par les assertions du mock).

Une fois ce critère atteint, la Milestone E (intégration Kernel réelle) peut démarrer dès que la Milestone D (`TARWebAuthnValidator`) est également prête — voir `roadmap-implementation.md`.