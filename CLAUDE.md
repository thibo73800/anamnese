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

## Gotchas à connaître avant de toucher au code

1. **Next.js 16 a renommé `middleware` en `proxy`** → fichier `proxy.ts` à la racine, export `proxy`. Les docs à jour sont bundled dans `node_modules/next/dist/docs/` — consulter **avant** d'écrire du code Next 16 (training data souvent obsolète).
2. **`params` et `searchParams` sont des Promises** en Next 15/16 — toujours `await`.
3. **Server Actions avec `'use server'` ne peuvent exporter que des fonctions async.** Pas de `export type { X }` dans ces fichiers (Turbopack lève un export error). Les types vivent dans `lib/types.ts`.
4. **Index SQL sur `fsrs_state->>'due'`** : pas de cast `::timestamptz` (pas IMMUTABLE). On indexe le texte brut — les `.toISOString()` sont toujours en UTC donc lexicographique = chronologique.
5. **Supabase auth cookies** : le server client `setAll` catch silencieusement quand appelé depuis un Server Component (Next interdit l'écriture) — le refresh réel se fait dans `proxy.ts`. C'est intentionnel.
6. **Rate limit email Supabase free tier = 4/h** combiné signup/reset/magic-link. Se réinitialise ~1h après le dernier envoi. Bypass possible via `scripts/admin-create-user.mjs` (user pré-confirmé via service_role).
7. **Direct DB `db.<ref>.supabase.co:5432` est IPv6-only sur free tier.** Depuis un réseau IPv4-only, la migration doit passer par le SQL Editor du dashboard (CLI `supabase db push` demande un access token personnel).
8. **shadcn/ui avec `@base-ui/react`** — la `Button` générée **n'a pas de prop `asChild`**. Pour un Link stylé comme un bouton : `<Link href="…" className={buttonVariants({variant: 'outline'})}>…</Link>`.
9. **Les clés Anthropic sont scoped par organisation**. Une clé ne consomme que le crédit de son org, pas d'une autre. Vérifier que la clé dans `.env.local` appartient à l'org qui a payé.
10. **Migrations empilées** : `supabase/migrations/` contient plusieurs fichiers à appliquer dans l'ordre (`0001_init.sql`, `0002_card_explanation.sql`, …). Pas de suivi automatique côté dashboard — si une session ajoute une migration, prévenir l'utilisateur de l'appliquer via SQL Editor avant de tester un `createCard`.
11. **`qcm_choices` = `{ distractors: string[3] }` seulement** (depuis 2026-04-19). La bonne réponse = `card.term`, pas un champ `correct` séparé. Les anciennes cartes peuvent encore avoir `correct` — ignorer. QCM et typing testent tous les deux le **rappel du terme à partir de la définition**.

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

La doc détaillée est dans [`wiki/`](./wiki/) — architecture, modèle de données, pipelines, flow d'auth, décisions par date. **Mettre à jour à chaque session de travail** : la racine du wiki liste ce qui est à jour.

## Mémoire persistante

Le fichier `~/.claude/projects/<projet>/memory/` contient :
- profil utilisateur (francophone, préfère recommandations cadrées)
- stack figée + raisons
- préférences de collaboration (questions groupées, Q&A avant code)

## Plan original

[`~/.claude/plans/salut-on-va-travailler-optimized-wilkinson.md`](~/.claude/plans/salut-on-va-travailler-optimized-wilkinson.md) — kickoff du 2026-04-19 avec toutes les décisions architecturales.
