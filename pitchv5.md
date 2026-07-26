# TAR — Full Pitch (4 min)

---

## S1 — Le problème
*~10s*

**Visual:** Photo plein écran — téléphone cassé sur du bitume.

**Spoken:**
> "You lost your phone. Your wallet is gone. Every asset. Gone."

---

## S2 — L'ancienne réponse
*~10s*

**Visual:** Seed phrase manuscrite sur papier froissé.

> *"where did I put it?"*

**Spoken:**
> "The old answer: twelve words to memorize. Nobody does this."

---

## S3 — La fausse solution
*~20s*

**Visual:** Logos iCloud + Google Drive. Sourire mesquin.

> *"Let us hold it for you."*

**Spoken:**
> "So the industry said: let us hold it for you.
> You went from being your own bank — to trusting a bank you've never heard of.
> Subject to hacks. Court orders. Terms of service."

---

## S4 — TAR
*~35s*

**Visual:** Schéma simple, trois lignes.

```
Anyone can attempt recovery.
But it costs money — and time.
Still there? → cancel → they lose everything.
```

**Spoken:**
> "TAR makes recovery open to anyone. But not free.
> Lock money. Wait.
> If you're still around — you cancel, they lose.
> If you genuinely lost your account — you're the only one who knows.
> So you recover. Nobody can beat you to it."

---

## S5 — Watch towers
*~20s*

**Visual:** Deux colonnes.

```
Every wallet today      TAR watch tower
──────────────────      ───────────────
Can access funds   →    Can only say NO
You need trust     →    Trust irrelevant
```

**Spoken:**
> "Add a watch tower — a friend, anyone.
> One job: block a suspicious recovery.
> They cannot touch your funds. A lock, not a key."

---

## S6 — DEMO
*~1 min 45s*

**Visual:** Wallet d'Alice à l'écran. Trois acteurs.

```
👤  Alice   →   The Owner
🦹  Bob     →   The Attacker  
🗼  Carol   →   The Watch Tower
```

**Spoken:**
> "Alice lost her phone. Bob knows it. Let's play it out."

### Séquence 1 — L'attaque échoue (owner actif)
- Bob initie une recovery, stake en jeu, timelock démarre
- Alice reçoit l'alerte → cancel en un clic → Bob perd son stake

**Bob :** *"I just need to wait."*
**Alice :** *"Nice try."*

### Séquence 2 — La watch tower bloque
- Alice pose son téléphone, tourne le dos
- Bob retente → Carol voit l'alerte → Reject → Bob perd encore

**Carol :** *"Not on my watch."*

### Séquence 3 — La vraie recovery
- Alice reprend depuis un nouveau device
- Personne ne peut la challenger — elle seule sait
- Timelock. Compte récupéré.

**Alice :** *"I'm back."*

---

## S7 — Le bluff
*~20s*

**Visual:** Rangée de comptes identiques — impossible de savoir lesquels ont une watch tower.

> *Who has a guardian?*
> *Nobody knows.*

**Spoken:**
> "Some have watch towers. Some don't. The attacker can never tell.
> The uncertainty itself is the shield.
> TAR protects every account — even the ones with nothing set up."

---

## S8 — Closing
*~10s*

**Visual:** Fond noir. Grand. Simple.

> # TAR
> *Lose your phone. Keep your life.*

```
ERC-4337 · ZeroDev · Passkeys · Base
```

---

## NOTES RÉGIE

| Qui | Rôle | Device |
|-----|------|--------|
| Presenter | Narrateur + slides | Laptop |
| Alice | Owner | Mobile (incognito pour S3) |
| Bob | Attacker | Mobile |
| Carol | Watch Tower | Mobile |

**Timing :**
- S1–S5 (intro + concept) : ~1 min 35s
- S6 (demo) : ~1 min 45s
- S7–S8 (twist + closing) : ~30s
- **Total : ~4 min**

**Checklist avant de monter sur scène :**
- [ ] Wallets pré-configurés et connectés
- [ ] Bob et Carol déjà sur leurs interfaces
- [ ] Alice a un "nouveau device" prêt (incognito / second browser)
- [ ] Stake amount réglé bas pour que la tx passe vite
- [ ] Timelock en mode demo (quelques secondes, pas 3 jours)
