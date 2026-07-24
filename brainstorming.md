## Décisions actées :

- roadmap POC :
    - 1er :
        - pas de watch tower (WT)
        - modular smart account EIP-7579
        - Kernel / Safe ? -> Kernel (compatibilité WebAuthn/passkey via validator ZeroDev à confirmer en tout début de build, avant d'architecturer dessus)
        - commit-reveal implémenté dès le POC 1 :
            - `keccak256(addressToRecover, broadcasterAddress, newSigner/passKey, salt)`
            - `broadcasterAddress` = stealth address permettant d'initier la tx de recovery
            - au reveal, le contrat doit vérifier explicitement `msg.sender == broadcasterAddress` (recalcul + comparaison du hash), sinon l'inclusion de `broadcasterAddress` ne protège de rien
        - une seule recovery active à la fois : rejet de toute seconde tentative via une variable d'état (type `activeRecovery[account]`), vérifiée au commit
        - newSigner = passkey (WebAuthn), géré directement par le device
            - point de vigilance technique : vérifier la dispo du precompile P-256 (0x0100, RIP-7212 / EIP-7951) sur la chaîne de test choisie, **via un vrai UserOp envoyé à l'EntryPoint**, pas seulement en `eth_call` (des implémentations récentes renvoient un succès en lecture mais échouent en tx réelle)
            - Anvil : dépend du hardfork utilisé au lancement, à vérifier
            - Sepolia : precompile normalement natif depuis Osaka, mais à tester en conditions réelles avant la démo
            - fallback si échec : validator WebAuthn en Solidity pur (plus cher en gas, fonctionne partout)
    - 2eme :
        - Implémentation watch tower
        - ZK : Noir vs Semaphore -> choix reporté, à trancher au démarrage du POC 2 ou après
- Définition des rôles de l'équipe : hors scope pour le contexte IA
    - PO
    - Overviewer / Adaptation
    - Pitcheur
- Choix techniques :
    - Front-end
        - lib permissionless.js -> intégration smart wallet ERC-4337
        - nextJS
        - web app mobile mobile first
    - Smart contract
        - EIP-7579 : https://eips.ethereum.org/EIPS/eip-7579
        - Wallet Kernel compatible EIP-7579
        - MerkleTree pour l'enregistrement des watch towers
        - anonymisation des WT sur le Merkle Tree : ZK avec Noir ou via le projet Semaphore (choix reporté)
- Paramètres économiques :
    - lockValue & lockTime définis par le user, avec recommandation front-end sur la valeur (valeurs précises à définir plus tard)
    - destination des fonds confisqués (rejet par l'owner ou véto WT) -> vers le compte ciblé
    - rotation du Merkle root : effectuée par l'owner, régénère directement un nouveau Merkle tree
- Hors scope explicite pour ce hackathon :
    - pas de gestion du compte privé (stealth address comme identité publique, séparation voir/prendre/censurer)
    - pas de gestion du griefing par un WT malveillant (comportement potentiel identifié, non traité)
    - pas de concurrence entre recoveries (une seule demande active à la fois, cf. ci-dessus)
    - rôles d'équipe : hors scope

## Questions ouvertes (à rediscuter plus tard) :
- Watchtowers :
    - cadre de la config :
        - taille max WT imposés -> 16 WT
        - obligation d'avoir une WT ? Non, mais recommandation front-end
        - précompute address de recovery ? Non, brique supplémentaire à brainstormer si temps disponible
    - process de configuration des WT (génération du commitment, transmission à l'owner, distribution du Merkle proof à la WT) -> question ouverte, à traiter spécifiquement au démarrage du POC 2
    - paymaster pour les WT : si implémentable
    - définir le fonctionnement et les types de WT (pro/wallets, proche, système WT incentivisé) -> pour le pitch


## Résumé discussion : configuration des WT (à reprendre avec l'équipe)

Problème initial. Pour construire le Merkle tree des WT, l'owner devait à l'origine échanger des informations directement avec chaque future WT (secret + accès au Merkle root), ce qui impose une interaction synchrone, répétée à chaque ajout ou suppression de WT.

Piste 1 — identité Semaphore générée localement par la WT. Le secret (trapdoor/nullifier) est généré aléatoirement par la WT elle-même, jamais transmis à qui que ce soit. Seul le commitment public qui en découle doit être transmis à l'owner, par n'importe quel canal non sécurisé (lien, QR code, message en clair) : il ne permet à personne de forger une preuve à la place de la WT. Ça résout déjà largement le problème du secret partagé.

Piste 2 — auto-inscription on-chain (registre public de candidatures). Permettrait à la WT de soumettre elle-même son commitment sans dépendre de l'owner. Problème identifié : si la WT soumet depuis sa vraie adresse, msg.sender est enregistré publiquement et révèle un lien entre son identité et le compte qu'elle surveille — fuite d'indistinguabilité. Deux mitigations évoquées : adresse jetable (burner) à usage unique, ou soumission hors-chaîne avec insertion batchée par l'owner (garde l'indistinguabilité, réintroduit un point de synchronisation).

Le problème du Merkle proof. Un commitment public seul ne suffit pas : la WT a aussi besoin du Merkle path (index + hashes voisins) pour générer sa preuve d'inclusion. Bonne nouvelle : ce n'est pas une donnée secrète — chaque insertion/update de feuille émet un événement public on-chain, et n'importe qui (la WT elle-même, via son app) peut reconstruire l'arbre complet depuis ces logs et en extraire son propre chemin. Le SDK @semaphore-protocol/group fait déjà ça. Donc l'owner n'a rien à transmettre après insertion.

Nouvelle contrainte apportée par l'équipe : secret déterministe non stocké. secret = keccak256(privateKeyOfPassKey, ownerAddress).

Avantage majeur : la WT n'a plus besoin de rien recevoir de l'owner pour générer son identité, ni secret ni configuration initiale — elle calcule seule, à partir de sa propre passkey et de l'adresse (publique) de l'owner.
Bonus : identité régénérable sans backup à gérer, tant que la passkey reste accessible (sync iCloud/Google) ; secret différent et non corrélable par compte surveillé (une même WT physique n'est pas liable entre deux comptes différents).
Réserve technique à vérifier : une clé privée WebAuthn réelle n'est normalement pas extractible (Secure Enclave / TEE). *La traduction implémentable est probablement l'extension WebAuthn PRF (dérivation déterministe liée au credential + un salt, ici ownerAddress), plutôt que le hash littéral de la clé privée. Support navigateur/authenticator à vérifier selon la cible.*
Ce que ça ne résout pas encore : le transfert du commitment (public) de la WT vers l'owner reste à définir (canal direct, ou registre avec les compromis de la piste 2).

État actuel de la question. La génération et la récupération d'identité côté WT semblent bien cadrées (déterministe, sans dépendance à l'owner, Merkle path reconstructible depuis les logs). Reste ouvert : comment la candidature/commitment remonte jusqu'à l'owner sans réintroduire soit une synchronisation lourde, soit une fuite d'indistinguabilité. - paymaster pour les WT : si implémentable - définir le fonctionnement et les types de WT (pro/wallets, proche, système WT incentivisé) -> pour le pitch