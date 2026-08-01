# Architecture — Frontend (`frontend/`)

Voir [`README.md`](README.md) pour la légende des statuts de maturité (🟢🟡🟠⚪). Pour le raisonnement derrière les choix listés ici, voir [`04-decisions.md`](04-decisions.md).

**Point de méthode important** : une bonne partie de cette doc contredit les specs de conception qui existaient avant l'implémentation (ex. `towers-design.md`, supprimé — décrivait les watch towers comme un mock localStorage). Le code actuel est nettement plus avancé que ces specs. Tout ce qui suit a été vérifié directement dans le code, pas déduit des documents de planification.

## Stack réelle

Next.js 16 (App Router), React 19, TypeScript. Auth par passkey uniquement (voir `CLAUDE.md` racine, section "Auth model"). `wagmi` v3 pour les lectures de contrat, `permissionless.js` (ZeroDev SDK, Kernel v0.3.1, EntryPoint v0.7) pour les écritures via smart account. `zustand` (persist middleware, `localStorage`) pour l'état client. `@semaphore-protocol/{identity,group,proof}` v4.13.0 côté client pour tout ce qui touche aux watch towers. `next-intl`, `shadcn/ui`, `tailwindcss`, `vaul` (drawers), `motion`. Cible unique : **Sepolia** (`lib/kernel/config.ts`, `chain = sepolia`, en dur).

## Auth / compte Kernel — 🟢 Implémenté

- `providers/kernel-provider.tsx` (`KernelProvider`) : restaure la session depuis `credentialId`/`accountAddress`/`publicKey` persistés (store `wallet`, `lib/store/wallet.ts`) sans cérémonie WebAuthn au chargement. Vérifie périodiquement (toutes les 10s + sur `visibilitychange`) que la clé publique locale correspond toujours à `TARWebAuthnValidator.keyData` on-chain — si elles divergent (ex. une recovery TAR a tourné la clé ailleurs), déconnexion locale automatique.
- `hooks/use-kernel.ts` : `useKernelAccount`, `useRegisterPasskey` (onboarding), `useLoginPasskey`, `useRestoreRecoveredWallet` (post-recovery), `useSendUserOperation`/`useSendKernelTransaction` (passent par `client.sendUserOperation` + `waitForUserOperationReceipt` du SDK Kernel — un vrai UserOp, pas un appel direct).
- `(app)/layout.tsx` : redirige vers `/login` si `credentialId === null` après hydratation du store — comportement documenté dans le `CLAUDE.md` racine, vérifié conforme au code.

## Recovery pour soi-même (`(auth)/recover`) — 🟢 Implémenté

*(Le `CLAUDE.md` racine mentionnait `(auth)/recovery` — chemin réel corrigé en `(auth)/recover`.)*

- `hooks/use-tar-recovery.ts` : `useTarRecoveryPreflight` lit on-chain (module installé, `rootValidator` == `TARWebAuthnValidator` attendu, `configs`/`recoveries` du compte ciblé) pour déterminer un statut précis (`contract-unavailable`, `unsupported-account`, `module-missing`, `validator-mismatch`, `config-missing`, `ready`, `active`...) avant de laisser l'utilisateur s'engager dans le flow.
- `useSubmitTarRecovery` : exécute le cycle **commit → attente de maturité (poll du block number) → reveal** via un wallet client "broadcaster" éphémère (`lib/recovery/broadcaster.ts`, clé privée détenue côté store `recovery`, pas un compte Kernel) qui envoie directement les transactions `requestRecovery`/`revealRecovery` (pas de sponsoring/UserOp ici — normal, ce broadcaster n'a pas de compte Kernel, c'est un simple EOA).
- `useFinalizeTarRecovery` : lit le statut on-chain, appelle `finalizeRecovery` si toujours `Revealed`, sinon reflète directement `finalized`/`vetoed`.
- `useUpdateRecoveryParams` : installe le module si absent, ou met à jour `lockValue`/`lockTime` ; si l'exécuteur actif est la V2 et qu'aucun groupe watch tower n'existe encore (`groupOf == 0`), génère un groupe par défaut (owner seul + padding) via `prepareDefenseGroupMembers` et l'inclut dans le même batch de transaction que `regenerateWatchTowerGroup`.

## Watch towers — 🟢 Implémenté (identité, enrôlement, groupe, veto — bout en bout sur Sepolia)

Contrairement à ce que suggérait la spec de planning (`towers-design.md`, supprimée) : ce n'est **pas** un mock localStorage isolé. C'est branché de bout en bout au contrat V2 réel.

- **Identité déterministe** (`lib/watch-tower-identity.ts`) : dérivée de l'extension **WebAuthn PRF** du credential passkey (`evalByCredential`), jamais stockée ni transmise — voir `04-decisions.md`. `WATCH_TOWER_IDENTITY_COUNT = 100` identités indépendantes précalculables par relation.
- **Enrôlement** (`lib/watch-tower-enrollment.ts`) : protocole QR maison (`tar-wt1`), en plusieurs frames chunkées (450 caractères/frame, 32 frames max) pour transporter les commitments d'une watch tower vers l'owner (scan bidirectionnel).
- **Génération de preuve** (`lib/watch-tower-proof.ts`) : utilise réellement `@semaphore-protocol/{identity,group,proof}` — `generateProof` (Groth16 réel côté client), pas un mock.
- **Gestion du groupe de défense** (`lib/watch-tower-policy.ts`, `hooks/use-watch-tower-policy.ts` → `useRegenerateWatchTowerGroup`) : construit la liste de membres (watch towers actives + identité du jour de l'owner + padding), appelle `regenerateWatchTowerGroup` sur le vrai contrat V2 déployé.
- **Veto** (`app/api/veto/route.ts`) : route serveur qui **relaie réellement la transaction** `challengeRecovery` via une clé privée serveur (`TAR_RELAYER_PRIVATE_KEY`), après simulation (`simulateContract`) — l'appelant (la watch tower) n'a donc pas besoin d'ETH pour vetoter, le relais sponsorise le gas de cette transaction précise. Valide `proof.scope == addressToRecover` avant tout envoi.
- **Reconstruction du groupe de défense** (`app/api/defense-group/route.ts`) : ne stocke rien côté serveur — reconstruit la liste de membres et la `merkleTreeRoot` à la demande, en lisant l'event `MembersAdded` on-chain via l'API Blockscout Sepolia et en vérifiant la racine contre `Semaphore.getMerkleTreeRoot` en direct.
- **Synchronisation des tentatives** (`hooks/use-recovery-attempt-sync.ts` → `useRecoveryAttemptSync`) : poll on-chain (15s + `visibilitychange`) de `recoveries`/`configs` pour le compte propre de l'utilisateur **et** pour chaque wallet qu'il surveille en tant que watch tower (`watchedWallets`, store `watch-towers`) — alimente le hub `RecoveryCenter`.

**🟠 Nuance de maturité** : `components/recovery-center/index.tsx` importe `simulateRecoveryAttempt` (`lib/recovery-center.ts`) à côté du flux réel décrit ci-dessus — signale qu'au moins un sous-chemin de démo/test reste simulé dans cet écran. Pas vérifié précisément lequel pour cette doc ; à contrôler avant de considérer *tout* l'écran `RecoveryCenter` comme prouvé en conditions réelles.

## `(app)/recovery` → `RecoveryCenter` — 🟢/🟠 Implémenté (hub owner-side)

*(Absent du `CLAUDE.md` racine avant correction — à ne pas confondre avec `(auth)/recover` ci-dessus, qui est le flow "j'ai perdu mon appareil".)*

Écran central pour un utilisateur déjà connecté : protection du wallet (config `lockValue`/`lockTime` + groupe de défense), liste des watch towers configurées, wallets surveillés en tant que watch tower, tentatives de recovery en cours (les siennes et celles qu'il surveille) avec actions de veto. Composants dans `components/recovery-center/`.

## Ce qui reste à vérifier / non couvert par cette doc

- Le sous-chemin `simulateRecoveryAttempt` mentionné ci-dessus.
- La génération de la clé privée du broadcaster (`lib/recovery/broadcaster.ts` ne fait que construire le client à partir d'une clé déjà fournie — l'origine/le stockage de cette clé n'a pas été audité pour cette doc).
- Aucun test automatisé (unitaire ou e2e) n'existe côté `frontend/` à la date de rédaction — seuls `typecheck`/`lint`/`build` sont scriptés dans `package.json`.
