# Wealthly — Script de démo pour pitch investisseurs

> **Durée totale recommandée : 90-120 secondes.**
> 3 plans, 1 voice-over par plan.
> Format Loom / QuickTime / OBS — résolution 1080p.

---

## 🎬 Plan 0 — Hook (5 sec)

**Voice-over :**
> « Wealthly, c'est l'app qui montre à une famille où va son argent et combien elle vaut, en temps réel. »

**Visuel :**
- Lancer le **Mode Présentation** (⇧⌘P ou menu user → "Mode présentation")
- Laisser jouer la première transition

---

## 🎬 Plan 1 — Overview (Dashboard) — 25-30 sec

**Voice-over :**
> « En un coup d'œil, le patrimoine net : ici 457 000 €. Liquidités, placements, immo, dettes — tout est agrégé en temps réel depuis les banques via DSP2. Aucun calcul manuel. »
>
> *(pointer vers le KPI hero)*
>
> « Et juste à côté, le cashflow du mois : combien vous dépensez de plus ou de moins que d'habitude. La décision est prise en 3 secondes. »

**Pointer :**
1. Le grand chiffre patrimoine net (hero)
2. La décomposition Actifs − Passifs juste dessous
3. Le widget MiniCashflow à droite ("ce mois-ci vs mois type")
4. Glisser vers la liste de comptes en bas (sync DSP2 visible)

**Insight clé à dire :**
> « Là où Linxo ou Bankin' s'arrêtent au compte courant, Wealthly inclut le patrimoine ENTIER : immobilier, prêts, PEA, crypto, assurance vie. »

---

## 🎬 Plan 2 — Budget mensuel (Sankey) — 30-35 sec

**Voice-over :**
> « Maintenant le budget. Deux Sankey diagrammes côte à côte : à gauche le mois TYPE — votre plan habituel. À droite le mois RÉEL. »
>
> *(pointer les 2 sankey)*
>
> « En face à face, vous voyez immédiatement où vous avez dérivé. 380 € de plus en restos ce mois ? Visible en 2 secondes. »
>
> « Wealthly intègre aussi le décalage salaire fin-de-mois — le virement du 28 avril qui finance mai est automatiquement comptabilisé sur le bon mois. Aucun outil français standard ne fait ça. »

**Pointer :**
1. Le Sankey "Mois type" à gauche
2. Le Sankey "Réel" à droite — montrer la branche Restaurants ou autre catégorie
3. Le KPI strip en haut (Entrées / Dépenses / Épargne / Reste à vivre)
4. Mentionner le toggle Décalage salaire fin de mois (Réglages → Foyer)

**Insight clé :**
> « Le Sankey rend visible ce qu'un tableau Excel rend INVISIBLE. Notre arme : la dataviz finance-grade en click-click. »

---

## 🎬 Plan 3 — Patrimoine (Wealth) — 30-35 sec

**Voice-over :**
> « Et voilà la pièce maîtresse : le patrimoine complet. Hero financier à gauche — PEA, assurance vie, crypto, livrets. Hero immobilier à droite — résidence principale moins le crédit. »
>
> *(pointer les 2 hero cards)*
>
> « Chaque classe d'actif drilable : on clique sur PEA, on voit les titres, les performances, les frais. Idem pour l'immo : valeur estimée, mensualité, capital restant dû, plus-value latente. »
>
> « Pour une famille, c'est la première fois qu'elle voit son patrimoine net AVEC son cashflow AVEC ses dettes, dans un seul écran. Open-source backend, DSP2 compliant, 2FA obligatoire. »

**Pointer :**
1. Hero "Financier" à gauche (PEA, AV, crypto)
2. Hero "Immobilier" à droite (avec breakdown Brut/Crédit/Net)
3. Une category card (cliquer pour expand)
4. Mentionner le bouton "Démo gratuite" / appel à action

**Insight clé :**
> « TAM en France : 8 millions de foyers avec >100k€ de patrimoine + crédit immo. Pricing 5€/mois, churn cible <3%, LTV >180€. »

---

## 🎬 Plan 4 — Closing (5 sec)

**Voice-over :**
> « Wealthly. Vue patrimoine. Vue cashflow. Vue budget. Une seule app. Disponible aujourd'hui. »

**Visuel :**
- Retour Dashboard, hero plein écran
- Logo Wealthly bottom-right si tu veux finir branding

---

## 🛠️ Setup technique pour le tournage

**Avant de lancer Loom / OBS :**

1. **Connecte tes vraies banques** ou utilise le mode démo (`localStorage.setItem('wealthly:demo', '1')` puis F5)
2. **Mode démo recommandé** pour la prise — chiffres beaux, pas de risque d'exposer tes vraies données
3. **Theme light** (papier chaud) — meilleur contraste à la vidéo
4. **Browser** : Chrome ou Arc, fenêtre maximisée, zoom 100 %
5. **Cache amounts** : OFF (sinon investisseurs voient `···`)
6. **Cache l'extension Loom toolbar** pour ne pas être dans le frame

**Pendant la prise :**

- Pas de musique de fond pour la voix → ajoute en post
- Vise UN seul take par plan (3 takes par jour max, sinon tu perds le naturel)
- Laisse 1 seconde de respiration entre les plans (pour le cut au montage)
- Mode Présentation : lance-le AU DÉBUT du plan 1, laisse-le jouer auto, parle par-dessus

**Post-prod minimum :**

- Cut entre les 4 plans
- Musique douce (Epidemic Sound "Cinematic Tension" ou similaire) volume −18 dB
- Sous-titres FR (auto Loom OK)
- Logo end-card 1.5 s
- Export 1080p MP4, <50 MB

---

## 📝 Pitch deck slides recommandés en complément

1. **Le problème** : 8M foyers FR, patrimoine éclaté, outils dépassés (Excel / Linxo plafonné)
2. **La solution** : Wealthly, agrégation patrimoine + cashflow + budget
3. **Démo vidéo** (le MP4 que tu viens de produire)
4. **Le marché** : TAM, pricing, comparables (Linxo 3M users, Finary 200K)
5. **L'équipe / la roadmap** : open-source backend, DSP2, IA categorization
6. **Ask** : montant + use of funds

---

*Document généré 2026-05-21 pour pitch investisseurs.*
