# Context — Milestone E : Script de déploiement Sepolia (`TARWebAuthnValidator` + `TARRecoveryExecutor`)

## Objectif

Déployer séquentiellement, sur Sepolia, le validator (`TARWebAuthnValidator`) puis l'executor (`TARRecoveryExecutor`, paramétré avec l'adresse du validator), pour que le front puisse ensuite initialiser des comptes Kernel et y installer ces deux modules. Remplace l'approche en deux temps envisagée précédemment (mock puis vrai validator) — ici on déploie directement le vrai validator.

## Hors scope explicite pour cette milestone

- **Pas de création de compte utilisateur dans ce script** : il déploie les deux contrats "singleton" (un validator, un executor, partagés par tous les comptes), pas un compte Kernel individuel. La création de compte + installation des modules est faite ensuite par le front, par utilisateur.
- **Pas de test E2E via `EntryPoint`/UserOp** : ce script utilise des transactions directes (le déployeur est un EOA classique) — c'est la Milestone F.
- **Pas de logique de test unitaire additionnelle** : les tests métier sont couverts par les Milestones B/C, ce script n'ajoute que le déploiement.

## Prérequis

- `TARRecoveryExecutor.sol` (Milestones A/B/C) fonctionnel et testé.
- `TARWebAuthnValidator.sol` (fork du collègue, `setNewOwner`) **présent dans le repo** à `src/validators/TARWebAuthnValidator.sol` — à confirmer avant de lancer le script, sinon la compilation échoue.
- RPC Sepolia configuré + clé de déploiement financée en ETH testnet (réutilise la config de la section 2b si déjà en place).

## Adresses Kernel v3.3 sur Sepolia (déploiement déterministe, mêmes adresses sur toutes les chaînes supportées)

| Contrat | Adresse |
|---|---|
| Meta Factory | `0xd703aaE79538628d27099B8c4f621bE4CCd142d5` |
| Factory (KernelFactory) | `0x2577507b78c2008Ff367261CB6285d44ba5eF2E9` |
| Kernel (implémentation) | `0xd6CEDDe84be40893d153Be9d467CD6aD37875b28` |

Le rôle exact de "Meta Factory" par rapport à "Factory" (registre/whitelist vs création directe de compte) n'est pas encore vérifié en détail — à confirmer dans la doc ZeroDev avant que le front ne s'appuie dessus pour la création de comptes. Ce script n'a besoin d'aucune des deux : il déploie seulement `TARWebAuthnValidator` et `TARRecoveryExecutor`, pas de compte.

## Fichier

```
smart-contract/
  script/
    DeployTARSepolia.s.sol
```

## Séquence de déploiement

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import {TARWebAuthnValidator} from "../src/validators/TARWebAuthnValidator.sol";
import {TARRecoveryExecutor} from "../src/TARRecoveryExecutor.sol";

contract DeployTARSepolia is Script {
    function run() external {
        vm.startBroadcast();

        TARWebAuthnValidator validator = new TARWebAuthnValidator();
        TARRecoveryExecutor executor = new TARRecoveryExecutor(address(validator));

        vm.stopBroadcast();

        console2.log("TARWebAuthnValidator deployed at:", address(validator));
        console2.log("TARRecoveryExecutor deployed at:", address(executor));
    }
}
```

**Commande** :
```bash
forge script script/DeployTARSepolia.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --verify
```

## Point d'attention sur l'encodage `onInstall` du validator (pour la suite, côté front)

Le code source réel de `WebAuthnValidator.onInstall` (dont `TARWebAuthnValidator` hérite le comportement par fork) décode ainsi :
```solidity
(WebAuthnValidatorData memory webAuthnData,) = abi.decode(_data, (WebAuthnValidatorData, bytes32));
```
Le `_data` attendu doit donc être encodé comme **`(WebAuthnValidatorData, bytes32)`**, pas seulement `WebAuthnValidatorData` seul — le second `bytes32` est décodé puis ignoré dans le corps de la fonction, mais son absence ferait revert le décodage ABI. Le front doit le savoir pour construire correctement l'`initData` au moment d'installer le validator sur un compte : `abi.encode(WebAuthnValidatorData(pubKeyX, pubKeyY), bytes32(0))` (n'importe quelle valeur de remplissage fonctionne pour ce second champ, il n'est jamais utilisé).

## Sortie attendue

- Deux adresses de contrats déployés sur Sepolia, loggées par le script et présentes dans `broadcast/DeployTARSepolia.s.sol/11155111/run-latest.json` (format standard Foundry).
- Recommandation : copier ces deux adresses dans un fichier court et stable pour le front (`deployments/sepolia.json` ou équivalent), plutôt que de leur faire relire le JSON de broadcast Foundry à chaque fois.

## Ce que le front fait ensuite (hors périmètre de ce script, pour information)

Par utilisateur : création d'un compte via `KernelFactory` (adresse ci-dessus) avec `TARWebAuthnValidator` comme validator root (passkey de l'utilisateur en `initData`, format ci-dessus), puis installation de `TARRecoveryExecutor` comme module executor (type 2) avec `updateRecoveryParams`/`onInstall` (`lockValue`, `lockTime` choisis par l'utilisateur). Signatures exactes des appels `KernelFactory` à vérifier contre l'ABI réelle du contrat à cette adresse — pas supposées ici pour éviter d'induire le front en erreur avec un format inventé.

## Critère de fin

- `TARWebAuthnValidator` et `TARRecoveryExecutor` déployés sur Sepolia, adresses vérifiées sur un explorateur de blocs.
- Adresses documentées dans un fichier stable, accessible au front.
- Le script est rejouable (`forge script ... --broadcast`) sans intervention manuelle au-delà de la commande elle-même.

Une fois ce critère atteint, le front peut commencer l'intégration (création de comptes, installation des modules) en parallèle de la Milestone F (test E2E via UserOp/EntryPoint), qui reste dépendante de la section 2b.