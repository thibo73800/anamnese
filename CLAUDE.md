@AGENTS.md

# Anamnèse — contexte pour Claude

PWA de mémorisation / culture générale / flashcards. Flow: recherche d'un thème → explication LLM (markdown, Q&A follow-up possible) + image → flashcard (terme + définition + explication persistée) → révision FSRS. Le **sens de la carte** : on affiche la **définition** et on devine le **terme** (QCM sur 4 termes quand `stability < 7j`, saisie libre ensuite).

## Stack verrouillée

- **Next.js 16** (App Router, Server Actions, Turbopack) + TypeScript + Tailwind v4 + shadcn/ui
- **Supabase** : Auth (email/password) + Postgres + RLS
- **Anthropic Claude** via `@anthropic-ai/sdk`, modèle par défaut `claude-sonnet-4-6`
- **`ts-fsrs`** (FSRS-4.5)
- **Images** : pipeline hybride Wikimedia Commons → Unsplash → Google CSE
- Déploiement **Vercel** (online-only, pas de service worker offline)

## Pièges fréquents

Avant de toucher au code, lire **[`wiki/conventions.md`](./wiki/conventions.md)** — 12 invariants transverses (Next 16 `proxy`, `params`/`searchParams` en Promise, Server Actions sans `export type`, index SQL sans cast, Supabase cookies, rate limit email, IPv6-only free tier, shadcn sans `asChild`, clés Anthropic scoped org, migrations empilées, forme de `qcm_choices`, FSRS Encore-only, images sans `next/image`).

Dépannage symptôme → cause → fix : [`wiki/operations.md`](./wiki/operations.md) section "Dépannage fréquent".

## Commandes utiles

```bash
npm run dev         # dev server (Turbopack)
npm run build       # build production
npm run typecheck   # tsc --noEmit
npm run test        # vitest (FSRS)
npm run lint        # eslint

# Admin scripts (nécessite .env.local chargé)
set -a && source .env.local && set +a
node scripts/admin-create-user.mjs <email> <password>
node scripts/admin-reset-user.mjs <email>
```

## Wiki

La doc détaillée vit dans [`wiki/`](./wiki/). Elle décrit **l'état actuel uniquement** — pas d'historique, pas de dates de décision, pas de changelog. Git fait l'archéologie.

**Le wiki est toujours rédigé en anglais**, même quand nos échanges sont en français. Ça aligne la doc sur les identifiants du code et les conventions de l'industrie.

**Quand lire le wiki** : avant de toucher à un sous-système, ouvrir la page correspondante pour vérifier les invariants à respecter.

- Architecture / flux : [`wiki/architecture.md`](./wiki/architecture.md)
- Schéma DB / RLS / indexes : [`wiki/data-model.md`](./wiki/data-model.md)
- Auth / proxy / scripts admin : [`wiki/auth-flow.md`](./wiki/auth-flow.md)
- FSRS / modes de révision : [`wiki/fsrs.md`](./wiki/fsrs.md)
- Pipeline images : [`wiki/images-pipeline.md`](./wiki/images-pipeline.md)
- Prompts Claude : [`wiki/llm-prompts.md`](./wiki/llm-prompts.md)
- Setup / migrations / déploiement / dépannage : [`wiki/operations.md`](./wiki/operations.md)
- **Conventions et invariants transversaux** : [`wiki/conventions.md`](./wiki/conventions.md) ← à scanner en début de session

Les liens internes au wiki utilisent le format Obsidian `[[nom]]` (indépendants du chemin). Les liens vers le code gardent les chemins relatifs classiques.

### Méthodologie de mise à jour

À la fin de chaque session, une seule question : **« qu'est-ce que je modifie dans le wiki pour que la prochaine Claude retrouve facilement l'état actuel ? »**

1. Le code a changé → la page topic concernée est-elle encore vraie ? Si non, réécrire **au présent, en anglais** (jamais « previously we did X, now… »). Mettre à jour les références de fichiers (`lib/…`, `components/…`, `supabase/migrations/…`).
2. Une règle transverse a changé ou est née → [`wiki/conventions.md`](./wiki/conventions.md).
3. Un nouveau symptôme de dépannage → `wiki/operations.md` section "Common troubleshooting".
4. Un fichier de code cité a été renommé/déplacé → grep le wiki pour l'ancien chemin, corriger.
5. **Ne jamais** ajouter « on YYYY-MM-DD we decided… ». Si c'est vrai, c'est au présent ; si c'est mort, ça disparaît ; si c'est un invariant, il va dans `conventions.md` sans date.
6. **Langue** : même si cette méthodologie est en français dans ce fichier, tout contenu écrit DANS le wiki doit être en anglais.

**Pas de duplication** : chaque fait a une seule page de référence ; les autres pages linkent.

**Restructuration** : la racine de `wiki/` tolère **jusqu'à ~10 fichiers**. Au-delà, regrouper par domaine en sous-dossiers (`wiki/domain/`, `wiki/stack/`, etc.) et mettre à jour l'index dans `wiki/README.md`. Les wikilinks `[[nom]]` survivent au déplacement tant que les noms restent uniques.

## Mémoire persistante

Le fichier `~/.claude/projects/<projet>/memory/` contient :
- profil utilisateur (francophone, préfère recommandations cadrées)
- stack figée + raisons
- préférences de collaboration (questions groupées, Q&A avant code)

## Plan original

[`~/.claude/plans/salut-on-va-travailler-optimized-wilkinson.md`](~/.claude/plans/salut-on-va-travailler-optimized-wilkinson.md) — plan de kickoff avec toutes les décisions architecturales initiales.
