# Budget mensuel — refonte (suppression Budgets, intro Mois type)

Date : 2026-05-14
Status : approved (brainstorm conversationnel)

## Contexte

Aujourd'hui Yotori Finance a deux onglets distincts pour gérer le budget :
- **Suivi mensuel** (Monthly.jsx) — vue opérationnelle d'un mois donné
- **Budgets** (Budgets.jsx) — vue stratégique avec méthode 50/30/20, plafonds par catégorie, objectifs d'épargne

Les deux font doublon en pratique. L'utilisateur veut une vue unique "Budget mensuel" centrée sur un **Mois type** paramétrable, comparable à chaque mois réel, avec un Sankey visuel.

## Objectifs

1. **Supprimer l'onglet Budgets** entièrement
2. **Refondre Monthly** autour du concept de "Mois type"
3. **Sankey 3 niveaux** (entrées / catégories / sous-catégories) du Mois type
4. **Comparaison réel vs Mois type** sur la même page
5. **Suppression des Goals d'épargne** (pas utilisés)
6. **Bouton "Analyse 50/30/20"** → modal d'analyse comparative

## Architecture

### Backend
- Nouveau champ `User.ref_month` (JSON, nullable) — stocke le Mois type
- Endpoints :
  - `GET /me/ref-month` → retourne le JSON
  - `PUT /me/ref-month` → met à jour
- Suppression des endpoints `/goals/*` (et table `goals` archivée mais non droppée par sécurité)

### Frontend
- `Monthly.jsx` refondu (suppression onglets Budget/Évolution, layout nouveau)
- Nouveau composant `RefMonthEditor.jsx` (drawer latéral 480px)
- Nouveau composant `RefMonthSankey.jsx` (recharts Sankey)
- Nouveau composant `FiftyThirtyTwentyModal.jsx`
- `Budgets.jsx` supprimé
- `Goals` retiré de YotoriApp + Dashboard

## Structure de données `ref_month`

```json
{
  "version": 1,
  "updated_at": "2026-05-14",
  "lines": [
    {
      "id": "uuid",
      "category_id": "salary",
      "kind": "income" | "expense" | "saving",
      "label": "Salaire Alice",
      "amount": 3850,
      "locked": true
    }
  ]
}
```

- `kind: saving` distingue l'épargne des dépenses classiques (utile pour le Sankey + 50/30/20)
- `locked` = quand l'utilisateur a saisi la valeur, ne pas l'écraser au resync historique

## Page "Budget mensuel" — layout

1. **Header** : titre + carrousel mois + boutons `[Éditer mois type]` `[📊 50/30/20]` `[📈 Évolution]`
2. **KPI strip** : 4 cellules (Revenus / Dépenses / Épargne / Reste à vivre) avec sous-ligne `vs <valeur mois type>`
3. **Sankey du mois type** : 3 colonnes (Entrées → Catégories → Sous-catégories)
4. **Table comparaison** : 3 sections (Entrées / Sorties / Épargne), groupée par catégorie, dépliable vers sous-catégories. Colonnes : Catégorie / Mois type / Ce mois / Écart / Barre de progression
5. **Footer** : Total entrées / Total sorties / Total épargne / Balance

## Éditeur Mois type (drawer)

- Drawer latéral droit 480px
- Lignes groupées par catégorie + bouton `+ Ajouter une sous-catégorie`
- Chaque ligne :
  - Input montant
  - Sous le champ : `≈ X €/mois (3 mois)` en gris OU `Pas assez d'historique` si <2 mois
  - Icône cadenas 🔒/🔓 cliquable
- Bouton global `[Resync tout depuis l'historique]` — repeuple les lignes **non lock**
- Logique de suggestion :
  - Médiane sur les 3 derniers mois complets (exclut mois en cours)
  - Besoin d'au moins 2 mois avec ≥1 transaction dans la catégorie
- Totals live en bas (Entrées / Sorties / Épargne / Balance)
- Persistance : optimiste (PUT vers backend, fallback localStorage)

## Sankey Mois type

- Composant `<Sankey/>` de recharts
- 3 colonnes : Entrées (une node par ligne `kind=income`) → Catégories (group by `category_id`) → Sous-catégories (lignes individuelles `kind=expense|saving`)
- Node finale "Reste à vivre" si Balance > 0
- État vide → CTA `[Configurer mon mois type]`

## Modal Analyse 50/30/20

- Modal centrée
- Visuel barre 3 segments : Besoins essentiels / Envies / Épargne (sur Mois type ET sur Mois réel courant côte-à-côte)
- Mapping catégories → besoins/envies/épargne (existant dans Budgets.jsx, à porter)
- Reco actionnable : "Tu épargnes 25%, l'objectif est 20% → bravo !" ou "Tes envies pèsent 38% (cible 30%) → essaie de réduire les restau/loisirs"

## Comportements UX clés

- **Catégories inattendues** dans le mois réel (pas dans Mois type) → ligne visible en bas du groupe avec marqueur `?` et action "Ajouter au Mois type"
- **Barre de progression** : verte sous 100%, orange dès dépassement (seule couleur conservée — pas de code couleur sur écart numérique)
- **Sidebar** : reste plate. "Budget mensuel" = 1 entrée, sous-actions dans la page
- **Évolution 6 mois** : reste accessible via bouton header dans une modal (pas dans Analyse, c'est différent)

## Migration / cleanup

1. Migration alembic créant `users.ref_month` (JSON, nullable) — bien que `create_all` suffise pour les nouveaux
2. Suppression de `Budgets.jsx`, route `'budgets'`, sidebar entry
3. Suppression de `Goals` partout (YotoriApp état + Dashboard cards + Budgets.jsx)
4. `setBudget`/`budgets` état supprimé de YotoriApp.jsx
5. Localisation : nouvelles clés `dashboard.refMonth.*`, suppression clés `views.budgets.*`

## Hors scope

- Pas de versioning du Mois type (un seul actif à la fois)
- Pas de Mois type par membre (un seul pour le foyer)
- Pas de Mois type saisonnier (été vs hiver)

## Risques

- Régression Dashboard : il consomme `budgets` et `goals` aujourd'hui. À auditer.
- Backend migration : si Supabase prod a déjà des users, `create_all()` ne fait pas l'ALTER → ajouter colonne manuellement OU faire une vraie migration alembic.
