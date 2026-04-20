# Journal des décisions

Chronologique, du plus récent au plus ancien. Format : une entrée = un sujet.

---

## 2026-04-20 — Refactor révision en client-side route + règle Encore-only

**Problèmes** :
1. Bug UX : la carte suivante s'affichait déjà "validée" car `<ReviewCardQcm>` / `<ReviewCardTyping>` gardaient leur state local (`selected`, `answer`, `revealed`) entre cartes — pas de `key` sur le composant.
2. Latence 2-3s entre chaque carte : deux round-trips séquentiels (`submitReview` + `router.refresh()` qui refait le RSC + `getDueCard`).
3. La logique de re-insertion initiale (fenêtre 15 min sur `nextDue`) créait un mismatch UI/DB : le compteur "N en file" gardait visibles des cartes rescheduled à +6-10 min alors que côté DB elles n'étaient plus dues. Au reload on voyait "rien à réviser" → incohérence perçue.

**Solution** :
- Nouveau composant [`components/review-session.tsx`](../components/review-session.tsx) : client-side route avec **queue préfetchée de 10 cartes**. Pop synchrone au rate, refetch en arrière-plan via `getDueCardsExcluding(seenIds, 10)` dès que `queue.length <= 3`. `seenRef` évite les doublons, `exhausted` se verrouille quand le serveur renvoie < 10.
- [`app/(app)/review/page.tsx`](../app/(app)/review/page.tsx) devient un RSC minimal qui fetch `getDueCards(10)` et passe à `<ReviewSession>`.
- `ReviewCardQcm` / `ReviewCardTyping` sont désormais **présentationnels** : props `{ card, onRate }`. Le bug `key` disparaît via `key={current.id}` sur le parent → remount à chaque pop.
- `submitReview` passe en **fire-and-forget** côté client (`.then/.catch`). Erreurs via toast. La carte suivante s'affiche immédiatement.
- `revalidatePath('/review')` **retiré** de `submitReview` : il forçait un re-render RSC inutile et coûteux pendant une session active. `/cards` reste revalidé.
- `startTransition` **retiré** de `RatingButtons` : il marquait les setState de pop comme transitions déférables (React 19), ajoutant de la latence. Le double-click est géré implicitement par le remount via `key`.
- `submitReview` renvoie maintenant `{ nextCard: AnamneseCard }` (au lieu de `void`) pour que le client ait l'état FSRS à jour si besoin de re-insérer.
- **Règle de re-insertion finale** : une carte revient en fin de file **uniquement** si rating === 1 (Encore). Rating 2/3/4 → sortie immédiate de la session. Elle réapparaîtra naturellement quand son `due` FSRS sera passé, via `getDueCards` d'une session ultérieure. Ce choix :
  - Supprime le mismatch UI/DB (plus de cartes "stuck" localement mais "not due" en DB)
  - Respecte l'intention FSRS (Again = répéter dans la session courante, les autres ratings sortent de la pile immédiate)
  - Rend le compteur "N en file" fidèle à la réalité persistée

**Nouvelles server actions** ([`app/actions/cards.ts`](../app/actions/cards.ts)) :
- `getDueCards(limit = 10)` — remplace l'usage principal de `getDueCard` pour le préchargement
- `getDueCardsExcluding(excludeIds, limit = 10)` — refetch sans doublons pendant la session

`getDueCard` (single) conservé pour compatibilité, n'est plus utilisé par la page.

**Persistance** : chaque rate reste une écriture atomique `update cards.fsrs_state + insert reviews`. Si l'onglet ferme en plein milieu, les cartes rated sont en DB ; les préfetchées non-rated **ne sont pas consommées** (simple SELECT) et réapparaissent au prochain `/review`. Seul cas de perte : fermeture entre le click et la fin du submit (< 500ms).

---

## 2026-04-20 — Création batch de flashcards via chat (tool use)

**Problème** : la création passait par `/search?q=…` — un thème, une carte. Constituer un set cohérent demandait de répéter N fois le flow sans cohésion (tags par carte, pas de vue d'ensemble).

**Solution** : nouvelle route [`/create`](../app/(app)/create/page.tsx) où l'utilisateur dialogue avec Claude pour générer un set. Claude manipule le set via 4 outils ; l'utilisateur édite librement cartes et tags avant commit.

**Architecture** :
- [`lib/anthropic/batch.ts`](../lib/anthropic/batch.ts) définit 4 tools + fonction `runBatchTurn` qui tourne la boucle agentique côté serveur (max 5 itérations).
- Tools : `create_cards({cards: [{term, definition, distractors[3]}]})`, `edit_card({localId, patch})`, `delete_card({localId})`, `propose_tags({tags})`. Chaque carte générée reçoit un `localId` (UUID client-side) que le LLM utilise pour cibler les éditions.
- System prompt [`lib/anthropic/prompts/batch.ts`](../lib/anthropic/prompts/batch.ts) + helper `formatState(draft, tags)` qui injecte l'état courant comme bloc texte dans **chaque** message utilisateur envoyé à Claude → le modèle voit l'état à jour même si l'utilisateur a édité manuellement entre les tours.
- Côté client, le composant [`components/batch-creator.tsx`](../components/batch-creator.tsx) stocke uniquement `DisplayMessage[]` (texte pur). Les blocs `tool_use` / `tool_result` vivent éphémèrement dans `runBatchTurn` le temps d'un tour — pas de leak dans l'historique affiché.
- Server actions ([`app/actions/batch-create.ts`](../app/actions/batch-create.ts)) :
  - `sendBatchMessage` — un tour de conversation, renvoie `{ history, draftCards, sharedTags }` mis à jour
  - `findImageForDraft({ query })` — trigger manuel du pipeline `findImage()` par carte (opt-in via bouton "Chercher une image")
  - `commitSet({ theme, sharedTags, cards })` — insert batch unique dans `cards` avec `initCard()` + `qcm_choices.distractors` par carte, redirect `/cards?tag=<firstTag>`

**Modèle "set"** : pas d'entité persistée. Un "set" = un batch de cartes partageant des tags communs (stockés dans `cards.tags text[]` existant). Aucune migration SQL. Le filtre par tag `/cards?tag=…` sert déjà de vue de set.

**État temporaire** : 100% client-side (`useState`). Si l'onglet se ferme avant commit, tout est perdu. Acceptable pour MVP — `localStorage` possible si besoin futur.

**Images** : opt-in par carte (bouton "Chercher une image" dans chaque `DraftCardItem`). Pas d'appel automatique au commit pour éviter une latence x N cartes et des images hors-sujet difficiles à corriger après.

**Distracteurs** : générés par Claude directement dans `create_cards` (contrainte `length(3)` dans le JSON schema du tool). Évite un appel séparé au commit.

**Nav** : lien "Créer un set" ajouté dans [`app/(app)/layout.tsx`](../app/(app)/layout.tsx) à côté de Cartes / Révision.

---

## 2026-04-19 — QCM inversé : définition → terme

**Problème** : Le QCM présentait le terme (ex. "Cosmogonie") et demandait de choisir la définition. Pédagogiquement faible — on teste la reconnaissance, pas le rappel actif. Les distracteurs générés étaient donc des définitions alternatives longues.

**Solution** :
- Prompt [`theme-explain.ts`](../lib/anthropic/prompts/theme-explain.ts) réécrit : les distracteurs sont maintenant des **termes** sémantiquement proches (synonymes partiels, concepts adjacents, faux-amis), ≤ 40 caractères.
- `QcmChoices` simplifié : le champ `correct` (qui stockait la définition) est retiré. La bonne réponse = `card.term` (toujours). JSONB tolérant, pas de migration requise.
- `components/review-card-qcm.tsx` inversé : affiche définition + image, 4 termes en choix, valide contre `card.term`.
- `components/review-card-typing.tsx` **déjà dans le bon sens** (définition → saisie du terme), aucun changement.

**Impact données** : les anciennes cartes gardent des distracteurs-définitions dans `qcm_choices.distractors`. Pas de backfill automatique — ajouté un bouton "Supprimer" sur `/cards` pour que l'utilisateur nettoie à la main (2-3 cartes concernées).

---

## 2026-04-19 — Image sans crop + lightbox + URL custom + édition

**Problème** :
- Images affichées en `object-cover h-44` → crop systématique des images non 16:9.
- Pas de preview dans le CardEditor (l'utilisateur ne voyait pas l'image qu'il s'apprêtait à sauver).
- Pas de moyen de coller une URL d'image personnalisée.
- Pas d'UI d'édition d'une carte existante.

**Solution** :
- Nouveau composant [`components/image-preview.tsx`](../components/image-preview.tsx) : hauteur fixe + `object-contain` (plus de crop) + clic → Dialog plein écran (max 95vw/85vh).
- `CardEditor` refondu : preview via `ImagePreview` + bouton "Retirer" + champ URL personnalisée (remplace) + "Restaurer image auto". Supporte `mode: create | edit`.
- Image retirée de `ThemeExplanation` (elle appartient logiquement à la flashcard, pas au thème) pour éviter le doublon visuel.
- Nouvelle server action `updateCard(cardId, input)` avec ownership check.
- Nouvelle page `app/(app)/cards/[id]/edit/page.tsx` + bouton "Modifier" sur `/cards`.
- Quand l'URL custom est utilisée : `image_source` et `image_attribution` = `null` (contrainte SQL tolère `null`, pas besoin d'étendre l'enum).
- `ImagePreview` branché aussi dans `review-card-qcm` et `review-card-typing` → toutes les images sont désormais cliquables pour zoom.

---

## 2026-04-19 — Rendu markdown + Q&A follow-up + explication persistée

**Problème** :
- L'explication renvoyée par Claude contient du markdown (`**gras**`, `*italique*`) qui s'affichait en texte brut (`whitespace-pre-wrap`).
- Après une recherche, aucun moyen de poser une question de clarification à la volée.
- L'explication détaillée n'était utilisable qu'au moment de la création — perdue ensuite, pas accessible en révision.

**Solution** :
- Installé `react-markdown` + `remark-gfm`. Composant wrapper [`components/markdown.tsx`](../components/markdown.tsx) avec styling Tailwind utility (sans `@tailwindcss/typography` pour rester léger).
- Nouveau prompt [`theme-refine.ts`](../lib/anthropic/prompts/theme-refine.ts) + fonction `refineExplanation(theme, currentExplanation, question)` dans `lib/anthropic/theme.ts`. Claude réécrit une **version enrichie** de l'explication qui intègre naturellement la réponse à la question (pas de thread Q&A, une seule version courante).
- Server action [`app/actions/theme.ts`](../app/actions/theme.ts) → `refineThemeExplanation`.
- Nouveau composant client [`components/search-result.tsx`](../components/search-result.tsx) qui orchestre `ThemeExplanation` (markdown) + input follow-up + `CardEditor`. Le state `explanation` est hoisté ici pour que le CardEditor sauvegarde la version finale (éventuellement raffinée).
- Migration SQL [`0002_card_explanation.sql`](../supabase/migrations/0002_card_explanation.sql) : colonne `explanation text` nullable sur `cards`.
- Composant [`components/explanation-info.tsx`](../components/explanation-info.tsx) : bouton icône "i" après révélation de la réponse en review → Dialog avec markdown. Affiché seulement si `card.explanation` non-null (graceful degradation pour les anciennes cartes).

**Breaking** : `createCard` écrit maintenant `explanation` dans la table. **La migration 0002 doit être appliquée avant le premier create sinon INSERT échoue** (colonne inexistante). Rappel : Dashboard SQL Editor, pas CLI (IPv6).

---

## 2026-04-19 — Route callback PKCE `/auth/callback`

**Problème** : Les emails de confirmation Supabase redirigent vers `/?code=<uuid>`. Sans route qui gère ce code, la signature reste inconfirmée et le user ne peut pas se connecter → boucle de rate limit email.

**Solution** :
- Route handler [`app/auth/callback/route.ts`](../app/auth/callback/route.ts) qui appelle `supabase.auth.exchangeCodeForSession(code)` et redirige vers `/` (ou `next` query param).
- `signup` Server Action passe `options: { emailRedirectTo: <origin>/auth/callback }`.
- `signup` retourne maintenant un message "email envoyé, clique le lien" quand `data.session` est null (email confirmation active).
- `isAuthRoute` dans le proxy étendu pour inclure `/auth/*` (sinon unauthed → bouclé vers /login avant que le callback ne run).

**À faire côté Supabase** : ajouter `http://localhost:3000/auth/callback` + URL Vercel équivalente à Redirect URLs (Authentication → URL Configuration).

---

## 2026-04-19 — Migration SQL : index `IMMUTABLE`

**Problème** : `create index cards_user_due_idx on cards (user_id, ((fsrs_state->>'due')::timestamptz))` a échoué — Postgres exige que les expressions indexées soient IMMUTABLE, et `text::timestamptz` ne l'est pas (dépend de `timezone`).

**Solution** : indexer le `text` brut sans cast : `(fsrs_state->>'due')`. Les timestamps sont toujours écrits en ISO 8601 UTC (suffixe Z) via `Date.prototype.toISOString()`, donc lexicographique = chronologique pour `<=` / `>=`.

**Invariant à maintenir** : si on commence à écrire des dates en autre format, l'index devient invalide. Documenté dans [data-model.md](./data-model.md).

---

## 2026-04-19 — Clé Anthropic scoped par organisation

**Problème** : clé fournie initialement (`sk-ant-api03-<redacted>`) n'apparaissait pas dans l'organisation Anthropic de l'utilisateur. Créditer cette org ne débloquait rien car la clé consomme le crédit d'une autre org.

**Solution** : créer une nouvelle clé dans le workspace Default de l'org avec crédit (via Console → Settings → API keys → Create key). Injectée dans `.env.local`.

**À retenir** : les clés Anthropic sont scopées org/workspace. Quand un billing error apparaît sur une clé fraîche, **vérifier que la clé appartient à l'org qui a payé** avant de soupçonner autre chose.

---

## 2026-04-19 — Migration via SQL Editor plutôt que CLI

**Problème** : `psql` pas installé, direct `db.<ref>.supabase.co:5432` IPv6-only (free tier), pooler `aws-0-*.pooler.supabase.com` retourne "tenant not found" sur toutes les régions testées pour ce projet.

**Solution** : appliquer la migration depuis le Dashboard SQL Editor. Le script `scripts/apply-migration.mjs` reste dans le repo pour référence mais ne marche pas sur free tier.

**Action follow-up** : si on upgrade Supabase à Pro, on peut activer l'IPv4 direct et utiliser le CLI proprement.

---

## 2026-04-19 — shadcn/ui avec `@base-ui/react` → pas de `asChild`

**Problème** : le template de `create-next-app` actuel utilise une variante de shadcn/ui basée sur `@base-ui/react` au lieu de Radix. La `Button` générée n'expose pas la prop `asChild` — impossible de faire `<Button asChild><Link>…</Link></Button>`.

**Solution** : pour un Link stylé comme un bouton, utiliser `buttonVariants()` directement :
```tsx
<Link href="/" className={buttonVariants({ variant: 'outline', size: 'sm' })}>…</Link>
```

---

## 2026-04-19 — Export `type` interdit dans Server Actions

**Problème** : Turbopack fait échouer le build si un fichier `'use server'` exporte autre chose qu'une fonction async (ex: `export type { ImageSource }`). Erreur : `Export ImageSource doesn't exist in target module`.

**Solution** : tous les types vivent dans [`lib/types.ts`](../lib/types.ts). Les Server Actions ne ré-exportent rien.

---

## 2026-04-19 — Next.js 16 : `middleware` → `proxy`

**Problème** : training data de Claude pointe vers `middleware.ts` / export `middleware`. Next.js 16 a renommé en `proxy.ts` / export `proxy`. Le middleware marche encore en legacy mais le nouveau projet utilise proxy.

**Solution** : toujours consulter `node_modules/next/dist/docs/` avant d'écrire du code Next 16. Plan d'origine a été adapté (proxy.ts + `lib/supabase/proxy.ts`).

---

## 2026-04-19 — Stack initiale (kickoff)

Décisions prises lors de la session Q&A du kickoff (plan : `~/.claude/plans/salut-on-va-travailler-optimized-wilkinson.md`) :

- **Next.js 15+ + TypeScript** sur Vercel (finalement Next.js 16 car `create-next-app@latest`)
- **Supabase** pour Auth + DB (free tier suffisant pour MVP)
- **Claude** pour génération (Sonnet 4.6 par défaut — bon rapport qualité/prix)
- **FSRS** via `ts-fsrs` (moderne, adopté par Anki récent) ; seuil QCM → saisie à `stability >= 7j`
- **4 boutons FSRS** Again/Hard/Good/Easy (précision max pour l'algo)
- **Distracteurs QCM** générés par Claude à la création (stockés avec la carte)
- **Pipeline images** Wikimedia → Unsplash → Google CSE (Bing retiré par Microsoft août 2025)
- **1 seule carte par recherche** (pas de batch)
- **Online only** pour MVP (PWA installable mais pas de service worker offline)
- **Hors scope MVP** : stats, offline sync, import/export Anki, partage de decks
