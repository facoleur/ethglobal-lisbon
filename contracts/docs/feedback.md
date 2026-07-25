# Feedback — écarts et ajouts par rapport aux contextes fournis

Rétrospective des Milestones A → E (`TARRecoveryExecutor` + `TARWebAuthnValidator`) : tout ce qui n'était pas explicitement spécifié dans `context_mA/mB/mC/mE.md` ou `contracts_context-full-implementation.md`, et qui a été ajouté, corrigé ou clarifié en cours de route. Objectif : que les prochains contextes écrits capturent ces points dès le départ.

## Milestone A

- **`onInstall`/`onUninstall` doivent être `payable`.** Le contexte les décrivait non-`payable`, en signalant lui-même "à vérifier une fois importées contre le vrai kernel". Le vrai `IModule` de `kernel/interfaces/IERC7579Modules.sol` les déclare `payable` (et `payable` ne peut pas être restreint à l'override en Solidity) — confirmé aussi par `NoopExecutor.sol`, déjà présent dans le repo, qui suit ce pattern.
- **`ITARRecovery` étend `IExecutor` (kernel réel), pas un `IERC7579Module` maison.** Conséquence directe : `AlreadyInitialized`/`NotInitialized` sont hérités de `IModule`, pas redéclarés — sinon conflit de déclaration. Les deux points ci-dessus sont exactement le genre de divergence que le contexte anticipait ("à revérifier contre l'import réel") mais ne tranchait pas.

## Milestone B

- **`finalizeRecovery` utilise `ExecLib.encodeSimpleSingle()`/`ExecLib.encodeSingle()`** (la vraie lib Kernel, déjà utilisée dans `script/DeployKernelBidon.s.sol`) plutôt que l'`abi.encodePacked(validator, uint256(0), rotationCalldata)` proposé dans le contexte — évite un risque de mismatch d'encodage avec le format ERC-7579 réel que le contexte signalait lui-même comme non vérifié.
- **`MockERC7579Account` construit de zéro** (`installModule`/`uninstallModule`/`executeFromExecutor`/`isValidSignature` ECDSA) : le contexte décrivait le comportement attendu du compte mais ne fournissait pas de mock concret, et `modulekit` n'est pas une dépendance du repo.
- **Vecteur de test croisé JS/Solidity avec valeur concrète calculée** (pas juste "à écrire") : commitment `0x511fa6ade2900b97c3d7bd86335ea459bb299b50f59de397c874ba73ca1a4498` pour des entrées fixes, calculé via `cast keccak` pour donner au front un vecteur réellement exploitable, pas une simple recommandation.

## Milestone C

- **Check `pubKeyX != 0 && pubKeyY != 0` ajouté dans `revealRecovery`.** Le contexte le présentait explicitement comme optionnel ("à toi de trancher"). Ajouté pour fail-fast à la révélation plutôt que de laisser l'utilisateur attendre tout le `lockTime` avant un échec de `finalizeRecovery` — cohérent avec le check équivalent dans `TARWebAuthnValidator.setNewOwner`.
- **Vecteur croisé réécrit avec des `uint256` pleine largeur** (`keccak256("pubKeyX-fixture")`/`pubKeyY-fixture`, magnitude réaliste d'une coordonnée P-256) plutôt que des petits entiers — exercice le même risque d'encodage (bigint vs hex string) qu'une vraie clé WebAuthn côté JS.

## Format de signature ERC-1271 / Kernel (jamais évoqué dans les contextes)

- **`ownerSignature` (dans `challengeRecovery`) n'est pas une signature brute une fois un vrai compte Kernel branché.** Découvert et documenté après coup : Kernel wrappe le hash via EIP-712 (`_toWrappedHash`, `ValidationManager.sol:591`) avant de le transmettre au validator, et `ValidatorLib.decodeSignature` attend un préfixe de mode (+ adresse validator) avant le payload réel. Rien à changer dans `TARRecoveryExecutor.sol` (le design "agnostique du validator" via `IERC1271(addressToRecover).isValidSignature` reste correct), mais point critique pour le front au moment de signer un REJECT — documenté dans `contracts_context-full-implementation.md` §4.3.

## Sécurité commit-reveal (trouvé/corrigé en cours de route, absent de tous les contextes A/B/C)

- **Délai minimum commit→reveal (`MIN_COMMIT_REVEAL_BLOCKS = 1`).** Aucun contexte ne mentionnait qu'un commit et un reveal dans le même bloc permettaient à un attaquant observant la mempool de voler la garde `RecoveryAlreadyActive` avant qu'un reveal légitime n'atterrisse. `pendingCommitments` est passé de `bool` à `uint256` (numéro de bloc du commit) pour l'implémenter.
- **`requestRecovery` ne doit pas rafraîchir un commitment déjà pending.** Une fois le point ci-dessus en place, réécrire inconditionnellement `pendingCommitments[commitment] = block.number` à chaque appel (présenté comme un no-op inoffensif hérité de la version booléenne) ouvrait un déni de service : n'importe qui pouvant repousser indéfiniment la maturité d'un commitment en le re-soumettant. Seule la première requête fixe le bloc ; les suivantes sur le même commitment sont des no-ops stricts.

## Milestone D (`TARWebAuthnValidator`, anciennement `RotatableWebAuthnValidator`)

- **Aucun `context_mD.md` n'a jamais existé** — le contrat a été ajouté directement au repo sans document de contexte dédié (contrairement à A/B/C/E). La suite de tests (18 cas) a donc été construite sans spec écrite, à partir de la lecture directe du contrat.
- **`setNewOwner` ne met pas à jour `credentialIdHash`** (contrairement à `rotatePublicKey`, qui le fait) — cohérent avec le fait que `RecoveryRequest` ne porte que `pubKeyX`/`pubKeyY`, jamais de `credentialIdHash`, mais ça veut dire qu'après une recovery TAR le `credentialIdHash` stocké dans le validator devient obsolète. **Flaggé comme question ouverte, pas corrigé** — à trancher selon si le front s'appuie dessus.
- **Le précompile P-256 local de `forge test` est cassé** (retourne un `STOP` sans données au lieu de vérifier), y compris en mode `--fork-url`. Confirmé empiriquement en appelant le précompile directement via `cast call` sur un vrai nœud `anvil` avec le même vecteur — qui retourne bien `1`. Root cause identique à celle déjà notée dans `script/spike/SpikeWebAuthn.s.sol` (section 2b), mais jamais reliée explicitement aux tests unitaires du nouveau validator avant cette session. Les 2 tests de vérification de signature réelle sont `vm.skip()`-és avec la raison exacte, plutôt que supprimés ou laissés à échouer silencieusement.

## Milestone E

- **Le Makefile utilise le keystore chiffré de Foundry (`--account`/`--sender`)**, pas une clé privée en clair dans une variable — l'exemple du contexte (`--rpc-url $SEPOLIA_RPC_URL --broadcast --verify`) omettait complètement la question du signer, alors que `vm.startBroadcast()` sans argument en a obligatoirement besoin.

## Hygiène générale (transverse à toutes les milestones)

- **Renommages faits avec `git mv`** (pas suppression + recréation) pour préserver l'historique git lors du passage `RotatableWebAuthnValidator` → `TARWebAuthnValidator` et de son déplacement vers `src/validators/`.
- **`forge build` + `forge test` + `forge lint`** systématiquement relancés après chaque changement, y compris sur les fichiers renommés/déplacés — a détecté plusieurs erreurs de compilation (imports, types de retour d'enum, offsets de storage après changement de forme du struct `RecoveryRequest`) avant qu'elles ne soient signalées autrement.
- **Offsets de storage recalculés à la main** à chaque fois que `RecoveryRequest` changeait de forme (Milestone B → C : `status` passe du 5e au 6e champ) pour les tests utilisant `vm.store` — nécessaire en l'absence de `modulekit`, aucun contexte ne l'anticipait.
