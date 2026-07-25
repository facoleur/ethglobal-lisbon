# Page Watch Towers dans Settings

## Résumé

Ajouter une entrée “Configure watch towers” dans Settings ouvrant un drawer pleine hauteur. L’owner pourra consulter, ajouter et révoquer jusqu’à 16 watch towers. Cette première version sera entièrement mockée et persistée localement ; la gestion des tentatives de recovery par une watch tower reste hors scope.

## Changements principaux

- Ajouter un store Zustand persisté dans `localStorage` sous une clé dédiée, avec :
  - `WatchTower { id, label, secret, createdAt }`
  - `watchTowers`, `hasHydrated`, `addWatchTower`, `removeWatchTower`
  - limite stricte de 16 entrées et refus des secrets déjà enregistrés.
- Isoler la logique métier et les mocks :
  - `simulateAddWatchTower({ label, secret }): Promise<WatchTower>`
  - `simulateRemoveWatchTower(watchTower): Promise<void>`
  - délais courts et déterministes, sans erreur aléatoire, afin de pouvoir remplacer ensuite ces fonctions par les appels réels.
- Ajouter la ligne Settings avec son titre, son sous-titre et l’ouverture du drawer pleine hauteur.
- Construire le drawer Watch Towers :
  - en-tête avec titre, compteur `n / 16` et fermeture ;
  - état vide explicatif lorsque la liste est vide ;
  - liste scrollable affichant le label et un aperçu masqué du secret ;
  - bouton corbeille accessible sur chaque ligne ;
  - bouton sticky “Add watch tower” avec icône plus en bas ;
  - bouton désactivé et message explicatif lorsque 16 towers sont enregistrées.
- Flux d’ajout :
  - ouvrir le scanner QR existant ;
  - accepter le contenu brut après trim, en refusant un contenu vide ou déjà enregistré ;
  - après un scan valide, ouvrir une étape de saisie du label ;
  - exiger un label non vide, appeler le mock, enregistrer le résultat et afficher un toast ;
  - conserver le drawer principal ouvert et réinitialiser le formulaire après succès ou annulation.
- Flux de révocation :
  - ouvrir un bottom sheet de confirmation depuis la corbeille ;
  - expliquer que le secret précédemment autorisé sera révoqué ;
  - appeler le mock puis supprimer l’entrée locale uniquement en cas de succès ;
  - désactiver les actions pendant l’opération et afficher un toast de résultat.
- Ajouter toutes les copies via `next-intl`, sans texte UI codé en dur, ainsi que les labels accessibles des boutons d’icône.

## Tests et validation

- Vérifier l’état vide, l’ouverture/fermeture du drawer et la persistance après refresh.
- Vérifier l’ajout par QR, la validation du label, l’annulation et les états de chargement.
- Refuser les QR vides, les doublons et une 17e watch tower.
- Vérifier la confirmation de suppression, son annulation et la suppression persistée.
- Vérifier que le secret complet n’est jamais affiché dans la liste.
- Valider sur viewport mobile, safe areas, clavier ouvert et longue liste scrollable.
- Exécuter `npm run typecheck`, `npm run lint` et `npm run build`.

## Hypothèses retenues

- Le QR contient uniquement un secret brut ; aucun format JSON ou versionné n’est exigé.
- Le label est choisi par l’owner après le scan et doit être non vide.
- Les secrets sont stockés localement en clair pour ce mock, mais seulement affichés sous forme masquée.
- La révocation réelle on-chain est simulée par la suppression locale après confirmation.
- Le rôle “ce wallet est lui-même une watch tower” et l’affichage des tentatives de recovery seront réalisés dans une seconde phase.
