# Context — Section 2b : Spikes WebAuthn (Kernel) + précompile P-256

## Objectif

Obtenir un go/no-go écrit sur les deux inconnues techniques identifiées dans `brainstorming.md`, avant d'architecturer les contrats TAR dessus (section 3) :
1. Le validator WebAuthn de Kernel fonctionne-t-il réellement en tx (pas seulement en lecture) ?
2. Le précompile P-256 (`0x0100`, RIP-7212/EIP-7951) est-il disponible en tx réelle sur les chaînes cibles ?

## Hors scope explicite pour cette section

- Aucune logique métier TAR — c'est la section 3.
- Le déploiement Kernel/ECDSA "bidon" est traité en section 2a, indépendante — ne pas dupliquer ce travail ici, réutiliser si besoin les contrats `EntryPoint`/`KernelFactory` déjà déployés par le script de 2a sur Anvil.
- Pas de vrai authenticator/Secure Enclave à ce stade : une paire P-256 générée en test suffit pour simuler une signature WebAuthn.

## Prérequis

Section 1 terminée : `kernel-7579-plugins` installé (contient `WebAuthnValidator`, type 1, P256/WebAuthn validator).

## Contexte utile (confirmé par recherche)

Le repo `zerodevapp/kernel-7579-plugins` contient un `WebAuthnValidator` maintenu, dédié à Kernel v3/ERC-7579 — ce n'est pas une PR isolée ou expérimentale mais un module du même statut que l'`ECDSAValidator`. Le point encore à vérifier n'est pas "est-ce que ça existe" mais "est-ce que ça fonctionne en conditions réelles" (vraie tx, pas `eth_call`).

L'implémentation d'origine du validator WebAuthn (PR historique #68 sur `zerodevapp/kernel`) prévoyait une adresse de vérifieur P-256 **configurable**, pensée pour basculer entre une implémentation Solidity pure (type Daimo/FCL) et le précompile `0x0100` une fois disponible — un pattern "duo mode". Vérifier si `kernel-7579-plugins` expose encore ce toggle : ça donnerait le fallback de la section 2b quasiment gratuitement.

## Étapes — Spike A : WebAuthn (Kernel)

1. Déployer `WebAuthnValidator` depuis `lib/kernel-7579-plugins/`.
2. Générer une paire P-256 de test (lib type FCL ou équivalent — pas un vrai authenticator).
3. Créer un compte Kernel avec `WebAuthnValidator` en root (via `KernelFactory`, réutilisable depuis le script de la section 2a).
4. Construire un `authenticatorData` + `clientDataJSON` factices au format WebAuthn, signer le UserOpHash encapsulé avec la clé P-256 de test.
5. Envoyer via `EntryPoint.handleOps` — **vraie tx**, pas `eth_call`.
6. Vérifier que la tx passe on-chain (pas seulement que `validateUserOp`/`isValidSignature` renvoie `true` en lecture).
7. Noter si le toggle précompile/Solidity mentionné ci-dessus est présent et son état par défaut.

## Étapes — Spike B : précompile P-256 (0x0100)

Sur Anvil :
1. Vérifier le hardfork de lancement par défaut (`anvil --hardfork ...`) — ça détermine si `0x0100` est émulé.
2. `eth_call` brut sur `0x0100` avec un vecteur de test RIP-7212 officiel (signature P-256 connue valide), vérifier le retour attendu (`1` sur 32 octets).
3. Déployer un contrat trivial qui fait un `call` (pas `staticcall`) vers `0x0100` et émet un event avec le résultat, l'appeler via une **vraie tx**.

Sur Sepolia :
4. Même double test (`eth_call` puis tx), à relancer proche de la date de démo plutôt qu'une fois pour toutes — le support précompile peut évoluer entre maintenant et la démo.

## Sortie attendue

Fichier `docs/spike-p256-results.md` (ou équivalent), daté, contenant pour chaque chaîne et chaque mécanisme :
- Résultat (succès / échec) en lecture et en tx.
- Hash de tx comme preuve.
- Si échec : décision fallback actée (validator Solidity pur), pas laissée ouverte.

## Critère de fin

- Go/no-go écrit et daté, par chaîne (Anvil, Sepolia) et par mécanisme (validator WebAuthn, précompile P-256), avec hash de tx à l'appui pour chaque résultat positif.
- En cas d'échec sur une chaîne : la décision de fallback (validator Solidity pur, ex. Daimo/FCL) est actée dans le document de sortie, pas repoussée.
- Le statut du toggle précompile/Solidite dans `WebAuthnValidator` est documenté.

Indépendant de la section 2a — peut être mené en parallèle. Une fois ce critère atteint (ou en parallèle de 2a), passer à la section 3 (voir `plan-smart-contract.md`).