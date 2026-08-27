# Documentation TAR — Index

**TAR (Timelock Account Recovery)** est un mécanisme de recovery trustless pour les smart accounts ERC-4337/ERC-7579, développé lors du hackathon ETHGlobal Lisbon. Il remplace les guardians classiques par un jeu économique : n'importe qui peut initier une recovery, mais seulement en stakant une garantie confiscable (`lockValue`) et en attendant une fenêtre de contestation (`lockTime`), pendant laquelle l'owner légitime — ou des watch towers agissant en son nom, dont l'appartenance reste anonyme via une preuve ZK (Semaphore) — peut rejeter la tentative et en confisquer le stake. Un compte défendu et un compte non défendu restent indistinguables de l'extérieur, ce qui prive un attaquant de la certitude qu'un compte est une cible facile.

Cette documentation présente le projet tel qu'il se trouvait à la fin du hackathon : le concept, ce qui a réellement été implémenté, et les limites connues du design.

## Fichiers

- [`01-concept.md`](01-concept.md) — le concept TAR en détail : mécanisme, watch towers, positionnement par rapport à l'existant.
- [`02-architecture-contracts.md`](02-architecture-contracts.md) — ce qui est réellement implémenté côté contrats : composants, statut de maturité, tests.
- [`03-architecture-frontend.md`](03-architecture-frontend.md) — ce qui est réellement implémenté côté frontend : écrans, intégration on-chain, statut de maturité.
- [`04-decisions.md`](04-decisions.md) — décisions techniques non triviales : quoi, pourquoi.
- [`05-limitations.md`](05-limitations.md) — trade-offs structurels assumés par le design.

Diagrammes : [`../diagrams/`](../diagrams/), référencés depuis `01-concept.md`.

## Statuts de maturité utilisés dans `02-` et `03-`

| Statut | Signification |
|---|---|
| 🟢 Déployé + testé | Code écrit, suite de tests dédiée, déployé sur Sepolia ou branché en prod front |
| 🟡 Codé + testé contre mocks | Logique validée par tests, jamais exercée en conditions réelles (ex. pas de vrai EntryPoint/UserOp) |
| 🟠 Intégré, non vérifié en profondeur | Chemin de code présent et branché, pas audité ligne à ligne pour cette doc — à vérifier avant de s'appuyer dessus |
| ⚪ Spec/idée seulement | Rien n'est codé |
