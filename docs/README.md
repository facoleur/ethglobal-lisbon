# Documentation TAR — Index

Ce dossier est la référence technique du projet **TAR (Timelock Account Recovery)**, issu du hackathon ETHGlobal Lisbon. Il remplace l'ensemble des documents de travail du hackathon (brainstormings, pitchs, docs de contexte par milestone) — supprimés une fois leur contenu utile extrait ici ; l'historique complet reste consultable via `git log`.

## Fichiers

- [`01-concept.md`](01-concept.md) — le concept TAR : pourquoi, comment, positionnement par rapport à l'existant. Théorie pure, indépendante de l'implémentation. (= ancien `paper.md`, déplacé tel quel.)
- [`02-architecture-contracts.md`](02-architecture-contracts.md) — ce qui est réellement implémenté côté `contracts/` : contrats, statut de maturité, tests.
- [`03-architecture-frontend.md`](03-architecture-frontend.md) — ce qui est réellement implémenté côté `frontend/` : écrans, hooks, intégration on-chain, statut de maturité.
- [`04-decisions.md`](04-decisions.md) — décisions techniques non triviales : quoi, pourquoi. Format volontairement court.
- [`05-limitations.md`](05-limitations.md) — trade-offs structurels assumés par le design (pas des bugs, pas des features manquantes). Chaque entrée a un id stable, référencé depuis la roadmap quand une idée future l'adresse.
- [`06-roadmap.md`](06-roadmap.md) — idées futures non implémentées.

Diagrammes : [`../diagrams/`](../diagrams/), référencés depuis `01-concept.md`.

## Statuts de maturité utilisés dans `02-` et `03-`

| Statut | Signification |
|---|---|
| 🟢 Déployé + testé | Code écrit, suite de tests dédiée, déployé sur Sepolia ou branché en prod front |
| 🟡 Codé + testé contre mocks | Logique validée par tests, jamais exercée en conditions réelles (ex. pas de vrai EntryPoint/UserOp) |
| 🟠 Intégré, non vérifié en profondeur | Chemin de code présent et branché, pas audité ligne à ligne pour cette doc — à vérifier avant de s'appuyer dessus |
| ⚪ Spec/idée seulement | Rien n'est codé |

## Comment faire évoluer cette doc

Toute nouvelle feature ou décision technique doit être reflétée ici — voir la règle correspondante dans le `CLAUDE.md` racine. Concrètement, à chaque changement :

- Nouveau composant / changement de statut de maturité → `02-` ou `03-`.
- Choix technique non évident → une ligne dans `04-decisions.md` (Décision / Pourquoi).
- Nouveau trade-off structurel découvert → une nouvelle entrée avec un id stable dans `05-limitations.md`.
- Une limitation résolue par une feature → marquer l'entrée `05-` comme résolue (renvoi vers la décision dans `04-`), et retirer l'item correspondant de `06-roadmap.md` s'il y en avait un.

Aucune de ces étapes n'est appliquée automatiquement — si une dérive est suspectée, chaque limitation/décision a un id ou un nom grep-able à travers les fichiers.
