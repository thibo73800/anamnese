# Architecture

## Next.js App Router layout

```
app/
├── (auth)/                    # public routes (login, signup)
│   ├── layout.tsx             # centers the 390px card
│   ├── login/page.tsx
│   └── signup/page.tsx
├── (app)/                     # protected routes — layout verifies the session
│   ├── layout.tsx             # nav header + getUser() guard
│   ├── page.tsx               # home + SearchBar + SuggestedThemes
│   ├── search/page.tsx        # Server Component: calls explainTheme + findImage
│   ├── cards/page.tsx         # list + tag filter + "Due" badge + Edit/Delete (modal)
│   ├── review/page.tsx        # RSC: getDueCards(10) → <ReviewSession> (client-side queue)
│   ├── explore/page.tsx       # RSC: if ?theme → VolatileConfigurator, else SeedInput landing
│   ├── explore/angles/page.tsx   # RSC: ?seed → Suspense(<SeedAngles>): 1 main + 5 angles
│   └── explore/session/page.tsx  # RSC: startVolatileSession → <VolatileReviewSession>
├── auth/callback/route.ts     # PKCE route handler: exchanges ?code= for a session
├── api/image-search/route.ts  # server proxy for findImage (avoids exposing keys)
├── api/v1/                    # public REST API — Bearer auth — see [[api]]
│   ├── cards/route.ts         # POST (single or batch), GET (list with tag/since/cursor)
│   ├── cards/[id]/route.ts    # GET, PATCH, DELETE
│   ├── tags/route.ts          # GET (distinct tag list)
│   └── stats/route.ts         # GET (learning counters over a 7-day window)
├── (app)/settings/            # account settings (API keys management UI)
│   ├── api-keys/page.tsx      # list + create dialog + revoke
│   └── page.tsx               # redirect → /settings/api-keys
├── actions/                   # Server Actions (marked 'use server')
│   ├── auth.ts                # signup, login, logout
│   ├── cards.ts               # Session-auth wrappers over lib/cards/repository.ts
│   ├── api-keys.ts            # listApiKeys, createApiKey, revokeApiKey (session-auth)
│   ├── theme.ts               # refineThemeExplanation (search follow-up Q&A)
│   └── suggestions.ts         # getSuggestedThemes, proposeAngles, startVolatileSession (home + explore)
├── layout.tsx                 # root layout, manifest, Toaster, SW registration
├── manifest.ts                # dynamic PWA manifest (3 icon entries: 192, 512, 512-maskable)
├── icon.tsx / apple-icon.tsx  # icons generated via next/og (512, 180)
├── icon-192/route.tsx         # 192×192 icon (Chrome Android installability)
├── icon-maskable/route.tsx    # 512×512 with safe-zone for Android adaptive launchers
└── globals.css

public/
└── sw.js                      # minimal no-op service worker (PWA installability only)

```

## Key components

| Component | Role |
|---|---|
| `search-result.tsx` (client) | Orchestrates the search screen: `ThemeExplanation` (markdown) + follow-up Q&A input + `CardEditor`. Hoists the `explanation` state. |
| `theme-explanation.tsx` (server) | Renders the explanation via `<Markdown>`. |
| `markdown.tsx` (server) | `react-markdown` + `remark-gfm` wrapper with Tailwind utility styling. |
| `card-editor.tsx` (client) | Create-only form for a new card: term, definition, tags, image (preview + custom URL + remove), distractors (shown in details). Used from `/search` via `search-result.tsx`. |
| `card-edit-dialog.tsx` (client) | **Single edit surface** for existing cards. shadcn Dialog wrapping a form for term, definition, explanation, tags, image, and 3 editable distractors. Props `{ card, onSaved?, children (trigger) }` → calls `updateCard`. Used from `/cards` (via `edit-card-button.tsx`) and `/review` (via a pencil button next to `ExplanationInfo`). |
| `edit-card-button.tsx` (client) | Pencil icon trigger rendering `CardEditDialog` with `router.refresh()` as `onSaved`. Mounted in the cards list. |
| `image-preview.tsx` (client) | `object-contain` image with fixed height + click → full-screen Dialog with attribution. Reused in CardEditor, CardEditDialog, and review. |
| `delete-card-button.tsx` (client) | Trash icon → confirmation Dialog → `deleteCard`. |
| `explanation-info.tsx` (client) | "i" icon button after reveal in review → markdown Dialog with the full explanation. |
| `review-card-qcm.tsx` (client) | **Presentational.** Shows definition + image, 4 terms to choose from, validates against the initial `card.term` (snapshot held in local state so mid-review edits never reshuffle visible choices). After reveal: explanation icon + pencil icon → `CardEditDialog`. Props `{ card, onRate, onCardUpdated }`. |
| `review-card-typing.tsx` (client) | **Presentational.** Free input: shows definition, user types the term, reveals term + image. After reveal: explanation icon + pencil icon → `CardEditDialog`. Props `{ card, onRate, onCardUpdated }`. |
| `review-session.tsx` (client) | Prefetched card queue + synchronous pop on rate + background refetch. Branches QCM/typing via `deriveMode`. `key={current.id}` on the child → remount between cards. Re-insertion at end of queue **only** on rating=1 (Again). Exposes `onCardUpdated` that mutates the queued card in place when the user edits it mid-review. |
| `suggested-themes.tsx` (server) | RSC streamed via `<Suspense>` at the bottom of the home page. Calls `getSuggestedThemes()` → 6 themes (3 deepen + 3 related) tailored to the user's recent study profile, or a curated fallback list if profile < 10 cards. Each theme links to `/explore?theme=<label>`. |
| `suggested-themes-skeleton.tsx` (server) | Pulse placeholder rendered as Suspense fallback (6 card-shaped blocks). |
| `volatile-configurator.tsx` (client) | Theme display + native `<input type="range">` (10-30, default 15) → navigates to `/explore/session?theme=…&count=…`. |
| `volatile-review-session.tsx` (client) | In-memory QCM-only queue for volatile sessions. Zero DB writes except opt-in Add-to-deck. Re-inserts card on wrong answer, tracks per-card `history` (wrongCount) + `addedMap` (volatileId → persistedId). **Card element keyed by `${id}-${reviewedCount}`** so a wrong answer on the last remaining card remounts and resets state. End screen is a **recap**: counters (total / correct / missed / added) + per-card list with ✓/✗ badge and an `AddVolatileCardDialog` per row. "Recommencer" regenerates via `startVolatileSession({ keepCards, previousSharedTags })` to preserve the session's shared tags across restarts. Contains its own minimal `VolatileQcmCard` (no edit/explanation/image UI, unlike `review-card-qcm.tsx`). |
| `add-volatile-card-dialog.tsx` (client) | Dialog that persists a volatile card via `createCard`. Pre-filled term / definition / 3 distractors (editable) + tag input seeded with the session's `sharedTags`. Rendered both during the session (after a wrong reveal, before "Continuer") and in every recap row. Becomes a disabled "Ajoutée" badge once the card has been persisted in this session. |
| `seed-input.tsx` (client) | Tiny form (Input + Compass button) on the home page and on the `/explore` landing. On submit, navigates to `/explore/angles?seed=…`. Prop `initialValue` lets the angles page preseed the control. |
| `seed-angles.tsx` (server) | RSC streamed via `<Suspense>` under `/explore/angles`. Calls `proposeAngles({ seed })` → renders the main theme as a prominent card plus 5 angle cards in a 2-column grid. Falls back to a neutral refusal UI when Claude declines, and to a retry CTA on transport errors. Each card links to `/explore?theme=<label>` (existing volatile flow). |
| `seed-angles-skeleton.tsx` (server) | Pulse placeholder rendered as Suspense fallback for `SeedAngles` (1 tall block + 5 angle-sized blocks). |
| `app-nav.tsx` (client) | Responsive header used by `(app)/layout.tsx`: horizontal links on `md`+, hamburger + Sheet on mobile with Install button and Déconnexion. First nav entry is `Explorer` → `/explore`. |
| `ui/sheet.tsx` (client) | Side-anchored drawer primitive (left/right), built on `@base-ui/react/dialog`. Used by `app-nav.tsx`. |
| `pwa/sw-register.tsx` (client) | Registers `/sw.js` in production. Mounted once from the root layout. |
| `pwa/install-button.tsx` (client) | Captures `beforeinstallprompt` (Chrome/Edge) or shows an iOS "Share → Add to Home Screen" dialog. Renders nothing when already installed or unsupported. |

## Layers and responsibilities

| Layer | Responsibility | Examples |
|---|---|---|
| **Proxy** (`proxy.ts` + `lib/supabase/proxy.ts`) | Refresh session cookie, auth guard | Redirects `/` → `/login` if no user |
| **Server Components** (pages) | Data fetching + RSC | `search/page.tsx` calls `explainTheme()` |
| **Server Actions** (`app/actions/*`) | Mutations + auth-checked writes | `createCard`, `submitReview`, `createApiKey` |
| **Route Handlers** (`/api/*`, `/auth/callback`) | Plain HTTP endpoints | PKCE callback, image search proxy, public `/api/v1/*` |
| **Public API** (`app/api/v1/*` + `lib/api-v1/*` + `lib/api-auth/*`) | Bearer-auth'd REST surface for external clients (Claude Code skill) | `POST /api/v1/cards`, `verifyApiKey`, `withApiKey` |
| **Cards repository** (`lib/cards/repository.ts`) | Single source of truth for `cards` CRUD; both Server Actions and API routes delegate here | `repoCreateCard`, `repoListCards`, `repoGetStats` |
| **Client Components** | Interactivity | `CardEditor`, `ReviewCardQcm`, `SearchBar` |
| **`lib/`** | Pure business logic, no React | `fsrs/`, `anthropic/`, `images/`, `supabase/`, `cards/`, `api-auth/`, `api-v1/` |

Rule: Client Components never touch Supabase on the DB side — they go through Server Actions (which verify auth via a server-side `createClient()`).

## Public API

The `/api/v1/*` surface lets external clients (today: the Claude Code skill at `skills/anamnese/`) mutate the deck on behalf of a user. Flow:

```
External client (Claude Code, curl, …)
  │
  │  POST /api/v1/cards
  │  Authorization: Bearer ana_sk_<32 Crockford base32>
  ▼
lib/api-v1/handler.ts#withApiKey(fn)
  │  (1) verifyApiKey(req)   ← lib/api-auth/verify.ts
  │        SHA-256 the raw key → SELECT user_id FROM api_keys WHERE key_hash=? AND revoked_at IS NULL
  │        (service-role client; RLS bypassed)
  │  (2) fire-and-forget UPDATE api_keys SET last_used_at = now()
  │  (3) build ctx = { userId, keyId, supabase: createServiceClient() }
  ▼
route handler (e.g. app/api/v1/cards/route.ts)
  │  Zod-parse body → normalizeCreatePayload (auto-gen distractors if missing)
  ▼
lib/cards/repository.ts  ← single CRUD source shared with Server Actions
  │  .eq('user_id', ctx.userId)  ← MANDATORY (service-role bypasses RLS)
  ▼
cards / reviews tables
```

See [[api]] for the endpoint reference and [[conventions#api-routes--service-role]] for the filtering invariant.

## Create a card flow

```
SearchBar (client) ──push──▶ /search?q=<theme>
                                    │
                             Server Component
                                    │
                       ┌────────────┴────────────┐
                       ▼                         ▼
              explainTheme(theme)         findImage(query)  [if needsImage]
              (lib/anthropic)              (lib/images)
                       │                         │
                       └───────────┬─────────────┘
                                   ▼
                       <SearchResult> (client)
                       ├── ThemeExplanation (markdown)
                       ├── FollowUp input ──▶ refineThemeExplanation
                       │     (user asks Q)     (LLM regenerates enriched explanation)
                       │                             │
                       │                      replaces explanation state
                       │
                       └── CardEditor (prefilled + image preview + custom URL)
                                   │
                        user submit ↓
                                   ▼
                        createCard Server Action
                                   │   (payload includes current `explanation`)
                        ┌──────────┴──────────┐
                        ▼                     ▼
                   supabase INSERT        initCard() FSRS
                                   │
                        revalidatePath + toast
                                   ▼
                              redirect /cards
```

## Review flow

The review page is client-side with a prefetched queue.

```
/review (Server Component, minimal)
   │
   └─▶ getDueCards(10)  ─── order by fsrs_state->>'due' asc, limit 10
                              filter user_id via RLS
         │
         ▼
    <ReviewSession initialCards={...}>  (client)
         │
         ├── queue: AnamneseCard[]   (seeded from initialCards)
         ├── seenRef: Set<id>        (prevents duplicates on refetch)
         └── exhausted: boolean      (true if server returns < PREFETCH_BATCH)

  current = queue[0]
         │
         └─▶ deriveMode(current.fsrs_state)  (stability >= 2d → typing, else qcm)
              │
              ├─── mode=qcm → <ReviewCardQcm key={current.id} card={current} onRate={onRate}>
              └─── mode=typing → <ReviewCardTyping key={current.id} card={current} onRate={onRate}>

  onRate(rating, responseText?) :
         │
         ├── setQueue((q) => q.slice(1))          // synchronous pop → next card is instant
         ├── setReviewedCount++
         │
         ├── if queue.length - 1 <= 3 and !exhausted:
         │       void refetchMore()               // refetch 10 more in the background
         │                                         // via getDueCardsExcluding(seenIds, 10)
         │
         └── submitReview(...)  (fire-and-forget, .then/.catch, no await)
                   │
                   ├── reviewCard(state, rating) via ts-fsrs
                   ├── UPDATE cards.fsrs_state
                   ├── INSERT INTO reviews (history)
                   ├── revalidatePath('/cards')   (not '/review': would cause an expensive re-render)
                   └── return { nextCard }
                         │
                         └── if rating === 1 (Again):
                                setQueue((q) => [...q, nextCard])  // re-insert at end of queue
                             else:
                                 card leaves the session, reappears once due passes

after reveal:
  - "i" icon (if card.explanation is non-null) → markdown Dialog with the full explanation
  - pencil icon → <CardEditDialog> (same modal used in /cards)
       → on save, onCardUpdated(updated) mutates queue[0] in place
         so the displayed definition/explanation refresh immediately.
         qcm choices are snapshotted in useState → no reshuffle.
```

**Invariants**:
- DB = source of truth. The local queue is a prefetch convenience: prefetched-but-unrated cards are not consumed (plain SELECT), they reappear in the next `/review`.
- Re-insertion **only** when rating === 1 (Again). Any other rating = immediate exit. The "N in queue" counter stays faithful to what is actually due on the DB side.
- `key={current.id}` on the card components → full remount → local state (`selected`, `answer`, `revealed`) resets for each card.

## Seed → angles → explore flow

Entry point is the `/explore` landing (also reachable via the `Explorer` nav entry). The user types a free-text seed (a concept, a word, a topic) and Claude proposes one main theme plus five complementary angles. Each proposal links to the existing `/explore?theme=…` configurator → volatile QCM session, so the feature adds no new state downstream. **The home page does not carry a seed input** — it keeps only `SearchBar` (direct theme search) and `SuggestedThemes` (daily profile-based suggestions).

```
/explore (RSC)
   │
   ├── ?theme=<label>  → <VolatileConfigurator theme=…>   (existing flow)
   │
   └── no theme        → landing (<SeedInput /> centered + example hints)
                            │
                            └── on submit → router.push(/explore/angles?seed=<enc>)

/explore/angles (RSC)
   │
   ├── await searchParams → seed
   ├── empty seed → landing (centered SeedInput + back link)
   └── valid seed → header + <Suspense fallback=SeedAnglesSkeleton>
                       <SeedAngles seed=…>
                          │
                          └─▶ proposeAngles({ seed })  (Server Action)
                                │
                                ├── repoGetRecentStudyProfile(ctx, 100) → optional ProfileSummary
                                │      (fed to Claude only when ≥ 10 cards are available)
                                │
                                └── proposeThemeAngles({ seed, profile })  (lib/anthropic/angles.ts)
                                       │   client.messages.parse with zodOutputFormat:
                                       │     { themes: [{ label, kind: 'main'|'angle', rationale }], refusal: string|null }
                                       │   system prompt cached (ephemeral)
                                       │
                                       └── returns either
                                              - { kind: 'ok',     themes: [1 main + 5 angles, normalized] }
                                              - { kind: 'refused', reason: '…' }
                          │
                          └── renders
                                - main theme as a prominent card
                                - 5 angle cards in a sm:grid-cols-2 grid
                                - refusal: neutral message + "Essayer un autre sujet" CTA
                                - transport error (try/catch): "Réessayer" link

  user clicks any card
         │
         └──▶ /explore?theme=<label>   (existing VolatileConfigurator)
                 → /explore/session?theme=…&count=…   (existing volatile QCM)
```

**Invariants**:
- No DB persistence. `proposeAngles` is read-only (profile) + Claude-only (generation). No table, no migration.
- Caching is ephemeral-only (Anthropic system-prompt cache). User-typed seeds are too specific to justify a per-user snapshot table; hit rate would be close to zero.
- The schema is defensive: Zod accepts `themes.length ≤ 6`; if Claude returns a non-compliant `main`/`angle` split, `proposeThemeAngles` normalizes (first item becomes `main`, rest become `angle`, capped at 6).
- Refusal messages from Claude fall back to a generic French sentence when blank.

## Explore flow (suggested themes → volatile QCM session)

Home page bottom section, streamed via `<Suspense>` so the header + `SearchBar` render instantly. Suggestions are **cached for the day** in `daily_suggestions` — Claude runs once per day and only re-runs to replace themes the user has consumed (started a volatile session on). This is the profile-based entry point into the volatile flow; see **Seed → angles → explore flow** above for the user-seeded alternative. Both flows converge on the same `/explore?theme=…` configurator.

```
/ (HomePage, RSC)
   │
   ├── <SearchBar />                     (renders immediately)
   │
   └── <Suspense fallback={Skeleton}>
         │
         └── <SuggestedThemes>           (RSC, async)
                │
                └── getSuggestedThemes() Server Action
                       │
                       ├── repoGetRecentStudyProfile(ctx, 100)
                       │     (joins reviews × cards, distinct on card_id, ordered by reviewed_at desc)
                       │
                       ├── if profile.length < 10 → return FALLBACK_THEMES (6 curated, no Claude, no snapshot)
                       │
                       ├── SELECT date, themes FROM daily_suggestions WHERE user_id = ctx.userId
                       │     │
                       │     ├── no row OR date != today(UTC)
                       │     │      → suggestThemes({ profile, count: 6 })
                       │     │      → UPSERT { themes: [...{consumed:false}] }
                       │     │      → return
                       │     │
                       │     └── row exists, date == today
                       │           ├── no consumed themes → return stored themes as-is
                       │           └── N consumed → suggestThemes({ profile, count: N, excludeLabels: allLabels })
                       │                            → UPSERT merged [...nonConsumed, ...replacements]
                       │                            → return

  user clicks a theme card
         │
         └──▶ /explore?theme=<label>  (VolatileConfigurator, client)
                │
                ├── native <input type="range"> 10..30, default 15
                │
                └── "Lancer le test" → router.push('/explore/session?theme=…&count=…')

/explore/session (RSC)
   │
   ├── startVolatileSession({ theme, count })   (Server Action)
   │         │
   │         ├── repoGetRecentStudyProfile(ctx, 100) → profileSummary (or null if < 10)
   │         │
   │         └── generateVolatileCards({ theme, count, profile, excludeTerms: [] })
   │                    via client.messages.parse (zodOutputFormat:
   │                      { sharedTags: string[2-5], cards: [{ term, definition, distractors[3] }] })
   │                 ▼
   │         shuffle → VolatileCard[] (each with client-generated crypto.randomUUID())
   │
   ├── consumeSuggestedTheme({ label: theme })  (fire-and-forget; no-op if no snapshot)
   │     → flips consumed:true in daily_suggestions for this label
   │     → revalidatePath('/')
   │
   └── <VolatileReviewSession initialCards sharedTags theme count />   (client)

  session loop (zero DB writes except opt-in Add-to-deck via createCard):
    queue: VolatileCard[]              (in-memory)
    history: Map<cardId, { wrongCount, seen }>
    addedMap: Map<volatileId, persistedCardId>
    sharedTags: string[]               (seeded from generation, persisted across restart)

    current = queue[0]
         │
         └── QCM reveal:
               ├── correct → queue.shift(); advance(correct=true)
               │             - no add-to-deck button shown
               └── wrong   → push current to end of queue; advance(correct=false)
                             - history[id].wrongCount++
                             - optional AddVolatileCardDialog here (one-click persistence)

    NOTE: card component keyed by `${current.id}-${reviewedCount}` → forced remount
          on every review. Fixes the "stuck on last card" bug where a wrong answer
          on a single-card queue would re-insert the same card at the same position,
          preserving the stale `selected` state.

  queue empty → RecapScreen:
    - 4 tiles: total / correct / missed / added
    - "Retour à l'accueil" (always) + "Recommencer" (if missed > 0)
    - list of all cards with ✓/✗ badge and an AddVolatileCardDialog per row

  "Recommencer" → startVolatileSession({
        theme,
        count,
        keepCards: allCards.filter(c => history[c.id].wrongCount > 0),
        previousSharedTags: sharedTags  // preserve tags across restarts
      })
     │
     └── regenerates (count - keepCards.length) new cards with
         excludeTerms = keepCards.map(c => c.term)
         shuffle([...keepCards, ...generated]) → new queue
         sharedTags stays stable
```

**Invariants**:
- `VolatileCard` has no `user_id`, no `fsrs_state`. It is never written to Supabase (the opt-in Add-to-deck creates a *new* AnamneseCard via `createCard` instead of persisting the volatile one).
- `startVolatileSession` never touches `cards` or `reviews` tables — only reads the profile and calls Claude.
- Suggestion generation is cached per-user in `daily_suggestions` (UTC day). Within a day, Claude only runs again to replace themes the user has consumed. Cost budget: 1 × 6-theme call + N × (consumed-count)-theme calls per user per day. Typically $0.005-$0.01/user/day.
- Consumption is triggered server-side from the session page after successful card generation, and is a no-op when the user is in fallback mode (profile < 10).
- The fallback theme list short-circuits Claude when the user has no meaningful profile yet — it is never written to `daily_suggestions`.

## See also

- [[conventions]] — transverse invariants (FSRS Again-only, UTC dates, Server Actions)
- [[fsrs]] — algorithm, QCM/typing threshold, re-insertion
- [[data-model]] — `cards` / `reviews` schema, indexes
- [[llm-prompts]] — theme-explain, theme-refine, theme-suggest, theme-angles, volatile-cards
