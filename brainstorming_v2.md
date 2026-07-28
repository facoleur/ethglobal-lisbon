Obbjectif : Définir le POCv2 implémentant la logique des Watch Towers.

Contraintes de l'implémentation: 
    - cadre de la configuration :
        - taille max WT imposés -> 16 WT
        - obligation d'avoir une WT ? Non, mais recommandation front-end
    - Une watch tower doit être indistinguable dans le merkle tree
    - Personne ne doit savoir combien de watch towers il y a pour un smart wallet
    - Vérifier la preuve d'être une watch tower on-chain


Solutions : 
- Utilisation de Semaphore : https://docs.semaphore.pse.dev/
    - Permet de créer des groupes -> un groupe par smart wallet, de taille 16
    - Génère les identités off-chain > les ajoute au groupe
    - Permet d'ajouter, supprimer, modifier les membres d'un groupe
    - Génère les preuves off-chain
    - Peut les prouver on-chain

Process de configuration d'une watch tower : 
- Owner génère un QR code avec son addresse dedans
- WT génère des Idendité Semaphore/commitment avec la valeur étant le hash de l'addresse + random value en entrée. Stocke aussi l'adresse du smart wallet off-chain
- Ses données sont passés avec un nouveau QR code scanné par le owner
- le front-end stocke l'ensemble des commitments off-chain
- le premier commitment est ajouté au groupe on-chain
- la WT est configurée

Le process est le même pour chaque ajout de WT.

Comment on évite l'identification du nombre de watch towers d'un smart wallet en observant le group (qui est publique) ?

Le groupe est recréé à chaque action dessus, le front-end soumet alors un nouveau commitment de la liste préenvoyé par ses WT au moment du setup.
Le groupId change à chaque fois, et est récupérable depuis le contrat via un mapping address to groupId.


Process de challenge de recovery : 
- WT get le group id du smart wallet via le contrat
- WT get les différentes info pour regénérer le tree (getMerkleTreeDepth, getMerkleTreeRoot) et génère la preuve SemaphoreProof
- WT soumet la preuve en appelant la fonction challengeRecovery() qui prends en paramètre une preuve (et plus une signature WebAuthn)
- si vérifié, alors la requestRecovery est refusé