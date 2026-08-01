# Décisions techniques

Décisions non triviales, format court : quoi → pourquoi. Classées par composant. Pas un historique narratif — voir `git log` pour l'ordre chronologique réel.

## Contrats — state machine commit-reveal (V1 et V2)

- **`MIN_COMMIT_REVEAL_BLOCKS = 1` entre `requestRecovery` et `revealRecovery`.** Empêche un attaquant observant en mempool le reveal d'une victime de committer *et* révéler sa propre tentative dans le même bloc pour lui voler la garde `RecoveryAlreadyActive`. Ne protège pas un attaquant patient qui pré-commite des jours à l'avance — ce cas reste défendu par le veto, pas par la rareté des tentatives.
- **`requestRecovery` est un no-op strict sur un commitment déjà pending** (ne rafraîchit jamais `pendingCommitments[commitment]`). Sans ça, n'importe qui pourrait repousser indéfiniment la maturité d'un commitment en le re-soumettant, empêchant le broadcaster légitime d'atteindre `revealRecovery` — un DoS permanent sur sa propre recovery.
- **`pubKeyX`/`pubKeyY` vérifiés non-nuls dès `revealRecovery`, pas seulement à `finalizeRecovery`.** Fail-fast : évite qu'un reveal avec une clé invalide ne soit détecté qu'après que l'appelant a attendu tout le `lockTime`.
- **`finalizeRecovery` et `regenerateWatchTowerGroup` ciblent toujours une adresse fixée au déploiement (`validator` immutable) ou dérivée de `msg.sender`, jamais une adresse fournie par l'appelant.** Empêche n'importe qui de faire exécuter un appel arbitraire par le compte cible via `executeFromExecutor`.
- **Le hash `REJECT` (V1) inclut `address(this)`, `block.chainid`, `addressToRecover`, `broadcasterAddress` et `revealTimestamp`.** Lie une signature de rejet à ce contrat, cette chaîne et cette tentative précise, sans avoir besoin d'un `recoveryId` séparé — empêche le rejeu d'une signature de rejet sur une tentative future ou sur un autre déploiement.
- **`challengeRecovery` (V1) authentifie via `IERC1271(addressToRecover).isValidSignature`, jamais un validator directement.** Garde `TARRecoveryExecutor` agnostique du validator actif sur le compte.

## Contrats — V2 spécifique (Semaphore)

- **`challengeRecovery` unifie owner et watch towers sur un seul chemin (preuve Semaphore).** Plus de distinction on-chain entre "l'owner a rejeté" et "une watch tower a vetoté" — nécessaire à l'indistinguabilité recherchée (voir `01-concept.md`).
- **`verifyProof` utilisé, pas `validateProof`.** `validateProof` ajoute un suivi de nullifier (protection anti-rejeu) inutile ici : le double-veto sur une même tentative est déjà bloqué par `RecoveryStatus` (`Rejected` après le premier succès). `verifyProof` étant `view`, il retourne `false` sur preuve invalide au lieu de revert — d'où le `require` explicite dans le contrat.
- **`scope` stable par compte** (dérivé de `addressToRecover`), pas par tentative individuelle. Résidu accepté : le nullifier d'un même défenseur se répète à chaque veto sur ce compte (visible : "même défenseur que la dernière fois"), mais son identité ne l'est jamais.
- **Le groupe Semaphore `0` est brûlé dans le constructeur** (defense in depth), en plus du check explicite `groupId == 0` dans `challengeRecovery` — les deux protections sont volontairement redondantes, aucune ne remplace l'autre.
- **`regenerateWatchTowerGroup` remplace le groupe intégralement, jamais additivement.** Le contrat n'a aucune notion d'ajout/retrait individuel — la composition (watch towers actives + identité du jour de l'owner + padding aléatoire jusqu'à `MAX_GROUP_SIZE`) est calculée entièrement côté front, pour qu'un observateur ne puisse jamais déduire un changement de composition en comparant deux groupes successifs.
- **Solidity non pinné globalement** (`foundry.toml`) pour accommoder le pin exact `0.8.23` de `lib/semaphore`, incompatible avec le `^0.8.28` du reste du code.

## Contrats — `TARWebAuthnValidator`

- **`setNewOwner` ne met pas à jour `credentialIdHash`**, contrairement à `rotatePublicKey`. Cohérent avec le fait que `RecoveryRequest` ne porte jamais de `credentialIdHash` — mais laisse ce champ obsolète après une recovery TAR. Non corrigé, voir `05-limitations.md`.
- **Aucun guard explicite sur `setNewOwner`.** `msg.sender` y est structurellement le compte cible, puisque ce chemin n'est atteignable que via `executeFromExecutor` — un appel externe direct ne peut jamais usurper cette identité.

## Frontend — identité des watch towers

- **Les 100 identités Semaphore d'une watch tower sont dérivées par HKDF à partir de l'extension WebAuthn PRF de son credential, avec un salt qui inclut l'adresse du compte protégé (`protectedWallet`)** (`lib/watch-tower-identity.ts`) — secret jamais transmis ni stocké, plutôt que généré puis échangé avec l'owner. Le PRF fournit l'entropie secrète ; le binding à `protectedWallet` (+ `relationshipId`, `chainId`) dans le salt garantit qu'un même device/passkey produit un jeu de 100 identités différent et non corrélable pour chaque compte surveillé. Résout le problème de synchronisation initial (l'owner devait auparavant transmettre un secret à chaque watch tower) : la watch tower calcule seule son identité, régénérable sans backup tant que la passkey est accessible. **Aucun fallback si le PRF n'est pas supporté** par l'authenticator — remonte comme erreur dure (`PasskeyPrfUnavailableError`), pas de mécanisme alternatif.
- **Alternative rejetée : auto-inscription on-chain de la watch tower.** Si la watch tower soumet son commitment depuis sa propre adresse, `msg.sender` est enregistré publiquement et lie son identité au compte qu'elle surveille — fuite d'indistinguabilité. Les mitigations envisagées (adresse burner à usage unique, soumission hors-chaîne batchée par l'owner) réintroduisent soit de la complexité soit un point de synchronisation, sans fermer complètement le problème — d'où le choix de l'échange QR direct.
- **Le Merkle path n'est jamais transmis par l'owner.** Chaque insertion de membre émet un event public ; n'importe qui (la watch tower elle-même) peut reconstruire l'arbre et en extraire son propre chemin depuis les logs (`@semaphore-protocol/group`, et `app/api/defense-group/route.ts` côté app). Ce n'est pas une donnée secrète, seule l'appartenance au groupe doit rester incertaine de l'extérieur.
