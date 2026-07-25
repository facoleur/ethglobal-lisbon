# Context — Section 1 : Setup du projet Foundry

## Objectif

Rendre le pipeline build/test/lint fonctionnel dès le premier commit de contrat réel, dans `smart-contract/` (actuellement vide), pour que la CI attrape les régressions de tooling séparément des bugs de logique métier.

## Hors scope explicite pour cette section

- Aucune logique métier TAR (pas de `TARRecoveryExecutor`, pas d'interface `ITARRecovery`) — c'est la section 3, pas encore définie.
- Aucun test WebAuthn ni précompile P-256 — c'est la section 2b, indépendante.
- Aucun script de déploiement Kernel — c'est la section 2a.
- Cette section installe les dépendances nécessaires aux sections suivantes, mais n'écrit aucun code qui les utilise.

## Structure attendue

```
smart-contract/
  foundry.toml
  remappings.txt
  .gitignore                 # cache/, out/, broadcast/
  lib/
    forge-std/
    openzeppelin-contracts/
    account-abstraction/      # eth-infinitism, tag v0.7.0 — IEntryPoint, PackedUserOperation
    kernel/                    # zerodevapp/kernel — core Kernel v3 (KernelFactory, Kernel)
    kernel-7579-plugins/       # zerodevapp/kernel-7579-plugins — ECDSAValidator, WebAuthnValidator
  src/
    .gitkeep                   # vide à ce stade, contenu ajouté en section 3
  script/
    .gitkeep                   # scripts de déploiement ajoutés en 2a/2b
  test/
    .gitkeep
```

## Dépendances à installer

```bash
forge install foundry-rs/forge-std
forge install OpenZeppelin/openzeppelin-contracts
forge install eth-infinitism/account-abstraction@v0.7.0
forge install zerodevapp/kernel
forge install zerodevapp/kernel-7579-plugins
```

Remarques :
- `account-abstraction` en v0.7.0 : compatible avec l'EntryPoint attendu par Kernel v3.
- `kernel-7579-plugins` contient à la fois `ECDSAValidator` (utile en section 2a) et `WebAuthnValidator` (utile en section 2b) — les deux sont installés maintenant même si non utilisés ici, pour ne pas re-bloquer le pipeline de dépendances à chaque section.
- Pas de `modulekit` à ce stade : à réévaluer seulement si les tests unitaires de la section 3 en ont besoin (mock account ERC-7579).
- Pas de Semaphore : différé au POC2, hors périmètre de tout ce plan.

## Intégration au repo existant

**Makefile** — ajouter :
```makefile
SMART_CONTRACT_DIR := smart-contract

contracts-install:
	cd $(SMART_CONTRACT_DIR) && forge install

contracts-build:
	cd $(SMART_CONTRACT_DIR) && forge build

contracts-test:
	cd $(SMART_CONTRACT_DIR) && forge test -vvv
```
Intégrer `contracts-install` dans la cible `install`/`setup` globale, et `contracts-build`/`contracts-test` dans `check`.

**lefthook.yml** — ajouter un bloc scopé :
```yaml
pre-commit:
  commands:
    contracts-fmt:
      root: "smart-contract/"
      glob: "*.sol"
      run: forge fmt --check
    contracts-build:
      root: "smart-contract/"
      glob: "*.sol"
      run: forge build
```
`forge test` reste en CI uniquement pour l'instant (pas de raison de le passer en pre-commit tant qu'il n'y a pas de test lent identifié).

**`.github/workflows/ci.yml`** — nouveau job, parallèle au job `frontend` existant :
```yaml
contracts:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with:
        submodules: recursive
    - uses: foundry-rs/foundry-toolchain@v1
    - run: cd smart-contract && forge fmt --check
    - run: cd smart-contract && forge build
    - run: cd smart-contract && forge test -vvv
```

## Critère de fin

- `make contracts-build` et `make contracts-test` passent en local.
- Le job CI `contracts` passe en parallèle du job `frontend` existant, sur un contrat vide (aucune logique métier requise pour valider cette section).
- Les cinq dépendances (`forge-std`, `openzeppelin-contracts`, `account-abstraction`, `kernel`, `kernel-7579-plugins`) sont installées et se résolvent sans conflit de version à la compilation.

Une fois ce critère atteint, passer à la section 2a (déploiement bidon Kernel/ERC-7579) — voir `plan-smart-contract.md`.