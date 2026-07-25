# Context — Section 2a : Déploiement bidon Kernel/ERC-7579 (ECDSA)

## Objectif

Valider la mécanique Kernel/ERC-7579 (factory, `installModule`, `EntryPoint.handleOps`) avec un validator ECDSA standard, indépendamment du risque WebAuthn/P-256 (section 2b). Adapter le Makefile pour pouvoir déployer un wallet Kernel en une commande.

## Hors scope explicite pour cette section

- Aucun test WebAuthn, aucune signature P-256 — c'est la section 2b, indépendante, peut tourner en parallèle mais ne doit pas être mélangée ici.
- Aucune logique métier TAR (`TARRecoveryExecutor`, commit-reveal, etc.) — c'est la section 3, non définie.
- Le module executor installé ici est un **no-op factice**, uniquement pour valider le mécanisme d'installation ERC-7579 — il n'implémente aucune fonction de recovery.

## Prérequis

Section 1 terminée : dépendances `account-abstraction`, `kernel`, `kernel-7579-plugins` déjà installées dans `smart-contract/lib/`, pipeline `make contracts-build`/`contracts-test` fonctionnel.

## Étapes

1. **EntryPoint** : déployer `EntryPoint` v0.7 sur Anvil (vérifier si l'instance Anvil utilisée le préconfigure à une adresse canonique — sinon déploiement manuel via le script fourni par `eth-infinitism/account-abstraction`).
2. **KernelFactory** : déployer l'implémentation `Kernel` (root) puis `KernelFactory` depuis `lib/kernel/`.
3. **ECDSAValidator** : déployer le validator depuis `lib/kernel-7579-plugins/`.
4. **Adresse contrefactuelle** : calculer l'adresse du compte via `KernelFactory.getAddress(...)`, avec un `salt` et les données d'init (validator ECDSA root + clé publique de test).
5. **Financement** : envoyer de l'ETH à cette adresse (Anvil : comptes préfinancés, trivial).
6. **UserOp de déploiement** : construire un `PackedUserOperation` avec `initCode` = factory + calldata de création, signé avec la clé privée ECDSA de test.
7. **Envoi** : appeler `EntryPoint.handleOps([userOp], beneficiary)` depuis un EOA (self-relay — pas besoin de bundler à ce stade).
8. **Vérification du compte** : confirmer on-chain que le compte existe, que l'`ECDSAValidator` est bien root, et qu'une tx applicative simple (ex. transfert de 0 ETH à soi-même) passe par le même chemin UserOp.
9. **Module executor factice** : écrire un contrat minimal `NoopExecutor` (respecte l'interface `IERC7579Module` type 2, ne fait rien d'autre que confirmer son installation), l'installer via `installModule(2, executor, "")`, vérifier `isModuleInstalled`, puis le désinstaller.
10. **Script Foundry** : encapsuler les étapes 1 à 9 dans `script/DeployKernelBidon.s.sol`, pour qu'il soit rejouable.
11. **Makefile** : ajouter une cible qui appelle ce script sur Anvil.

```makefile
deploy-kernel-anvil:
	cd smart-contract && forge script script/DeployKernelBidon.s.sol --rpc-url http://localhost:8545 --broadcast
```

## Critère de fin

- Un compte Kernel est déployé sur Anvil via un vrai `EntryPoint.handleOps` (pas de mock, pas d'appel direct hors UserOp).
- Le module executor factice s'installe et se désinstalle avec succès.
- `make deploy-kernel-anvil` rejoue tout le scénario de bout en bout sans intervention manuelle, sur une instance Anvil fraîchement lancée.
- Aucune dépendance sur WebAuthn ou P-256 dans le code produit ici.

Une fois ce critère atteint, passer à la section 3 (voir `plan-smart-contract.md`) — pas besoin d'attendre la fin de la section 2b, qui est indépendante.