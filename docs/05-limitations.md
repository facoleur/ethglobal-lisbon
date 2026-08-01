# Limitations et trade-offs structurels

Ce ne sont pas des bugs ni des features manquantes : ce sont des compromis assumés par le design, pour la plupart documentés dans [`01-concept.md`](01-concept.md) lui-même. Chaque entrée a un id stable, grep-able, référencé depuis [`06-roadmap.md`](06-roadmap.md) quand une idée future l'adresse.

### `liveness-dependency`
TAR dépend de la capacité de l'owner (ou d'au moins une watch tower) à observer et réagir dans `lockTime`. Un owner durablement incapacité sans watch tower est sans défense. L'opacité du système (indistinguabilité, incertitude de type honeypot) réduit le risque qu'un attaquant *sache* qu'un compte est non défendu, mais ne change pas le fait que si personne ne regarde, la recovery aboutit.

### `capital-requirement`
Initier une recovery exige de staker `lockValue`. Un utilisateur ayant réellement tout perdu peut ne pas être en mesure de produire ce capital. Un marché de "fronting" tiers contre commission est possible en théorie, mais n'existe pas.

### `lockTime-tradeoff`
Pas de valeur universellement correcte pour `lockTime` : trop court, la fenêtre de contestation est insuffisante ; trop long, la recovery légitime devient pénible.

### `key-theft-not-addressed`
TAR traite la perte de clé, pas le vol de clé. Un attaquant qui détient une clé valide a le droit de rejet actif et peut rejeter la recovery de l'owner légitime. Ce n'est pas une régression du design (un attaquant avec une clé valide peut de toute façon vider le compte directement, sans avoir besoin de passer par une recovery) — mais ça marque la limite exacte de ce que le mécanisme protège.

Le fait que le signer soit une passkey (clé dans le Secure Element/TEE du device) réduit fortement la surface par rapport à une seed phrase en clair, mais ne l'élimine pas :
- **Extraction physique de la clé** : quasi impraticable sur un élément sécurisé dédié (StrongBox/Titan M — nécessite un laboratoire de type decapping/fault-injection, hors de portée d'un vol opportuniste). Plus faible sur un TEE logiciel seul (TrustZone sans puce dédiée) — des CVEs d'extraction existent historiquement sur certains chipsets, mais chacune exige une chaîne d'exploitation réelle et patchée dès sa publication, pas une méthode générique.
- **Une signature volée de façon isolée (phishing, coercition ponctuelle) n'a pas d'intérêt spécifique lié au droit de rejet.** Un attaquant capable d'obtenir une seule signature de la victime a bien mieux à faire (vider le compte directement, installer un validator qu'il contrôle) — le "droit de rejet volé" mentionné plus haut n'est pas ce qu'un attaquant chercherait à obtenir via un vol ponctuel.
- **Le droit de rejet ne devient un problème réel qu'en cas de compromission *durable* du signer** — pas un vol isolé : un accès persistant (backdoor installé via une précédente ruse, malware, ou compte cloud compromis si le credential est un passkey *synced* plutôt que *device-bound* — non déterminé pour ce repo, `lib/kernel/register-prf-passkey.ts` délègue `authenticatorSelection`/`residentKey` au serveur passkey ZeroDev, à vérifier par attestation à l'enregistrement). Une fois cet accès durable acquis, l'attaquant peut vider le compte à volonté **et**, si l'owner légitime tente ensuite une recovery TAR depuis un autre device pour reprendre la main, rejeter cette tentative et confisquer son `lockValue` — gardant le contrôle tout en le faisant payer pour essayer de le reprendre. C'est ce scénario précis, pas un vol de signature isolé, qui correspond au "droit de rejet actif" évoqué plus haut.

### `griefing-vetotower`
**Le point le plus sensible du design** (qualifié ainsi dans `01-concept.md`). Une watch tower a un pouvoir "strictement négatif", mais ce pouvoir négatif inclut le fait de vetoter indéfiniment la recovery légitime de l'owner. Pour préserver l'indistinguabilité, un rejet owner et un veto watch tower doivent être identiques on-chain — une watch tower malveillante peut donc confisquer le `lockValue` de l'owner à chaque tentative, et l'owner (qui a justement perdu ses clés) ne peut pas mettre à jour la racine Merkle pour la retirer. Aucune mitigation implémentée à ce stade.

### `private-setting-collusion`
Dans le cadre "adresse privée" (théorisé dans `01-concept.md`, non implémenté — voir `06-roadmap.md`), les recoverers ayant aidé à reconstituer l'adresse peuvent, s'ils colludent, lier le handle public de l'utilisateur à son adresse — même si l'événement de recovery on-chain lui-même ne révèle qu'une rotation de signataire, pas l'identité qui l'a initiée.

### `commitment-spam`
`requestRecovery` est entièrement gratuit (aucune valeur en jeu, seulement le coût du gas). Un attaquant peut soumettre un nombre arbitraire de commitments creux. Accepté explicitement comme limite du POC — aucun mécanisme anti-spam ni d'expiration implémenté.

### `credentialIdHash-staleness`
`TARWebAuthnValidator.setNewOwner` (chemin utilisé par `finalizeRecovery`, V1 et V2) met à jour `pubKeyX`/`pubKeyY` mais pas `credentialIdHash`, contrairement à `rotatePublicKey`. Après une recovery TAR, ce champ stocké devient obsolète. Question ouverte, jamais tranchée — dépend de si une partie du système (front, autre contrat) s'appuie réellement sur `credentialIdHash` après coup.

### `no-real-userop-e2e-test`
Aucun test ne fait passer le cycle complet par un vrai `EntryPoint.handleOps`/`PackedUserOperation` — toute la suite de tests contrats (V1 et V2) exerce la logique en appels directs. Le comportement réel sous bundler/EntryPoint n'est donc validé qu'indirectement, via l'usage en production par le frontend (qui, lui, passe bien par de vrais UserOps pour les actions du compte Kernel — mais pas pour `requestRecovery`/`revealRecovery`/`finalizeRecovery` eux-mêmes, qui sont envoyés en transactions directes par un broadcaster EOA, voir `03-architecture-frontend.md`).

### `zk-group-storage-tradeoff` — [À COMPLÉTER]
Trade-off discuté à plusieurs reprises en dehors du repo, jamais mis par écrit : stockage du Merkle tree/groupe ZK **on-chain vs off-chain**, et **arbre complet vs simple commitment** off-chain. Le choix effectivement implémenté est "groupe Semaphore on-chain (`createGroup`/`addMembers` réels), reconstruit à la demande côté front via les logs d'événements + Blockscout, jamais stocké en DB" (`app/api/defense-group/route.ts`) — mais le raisonnement qui a mené à ce choix plutôt qu'à l'alternative n'est capturé nulle part. À compléter par la personne qui a mené cette discussion.
