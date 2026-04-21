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
│   ├── page.tsx               # home + SearchBar
│   ├── search/page.tsx        # Server Component: calls explainTheme + findImage
│   ├── create/page.tsx        # minimal RSC → <BatchCreator> (Claude chat + draft set)
│   ├── cards/page.tsx         # list + tag filter + "Due" badge + Edit/Delete
│   ├── cards/[id]/edit/page.tsx  # edit a card (term/def/tags/image/explanation)
│   └── review/page.tsx        # RSC: getDueCards(10) → <ReviewSession> (client-side queue)
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
│   └── batch-create.ts        # sendBatchMessage, findImageForDraft, commitSet (/create batch chat)
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
| `card-editor.tsx` (client) | Create/edit form for a card: term, definition, tags, image (preview + custom URL + remove), distractors (shown in details). `mode: create \| edit` → calls `createCard` or `updateCard`. |
| `image-preview.tsx` (client) | `object-contain` image with fixed height + click → full-screen Dialog with attribution. Reused in CardEditor and review. |
| `delete-card-button.tsx` (client) | Trash icon → confirmation Dialog → `deleteCard`. |
| `explanation-info.tsx` (client) | "i" icon button after reveal in review → markdown Dialog with the full explanation. |
| `review-card-qcm.tsx` (client) | **Presentational.** Shows definition + image, 4 terms to choose from, validates against `card.term`. Props `{ card, onRate }`. |
| `review-card-typing.tsx` (client) | **Presentational.** Free input: shows definition, user types the term, reveals term + image. Props `{ card, onRate }`. |
| `review-session.tsx` (client) | Prefetched card queue + synchronous pop on rate + background refetch. Branches QCM/typing via `deriveMode`. `key={current.id}` on the child → remount between cards. Re-insertion at end of queue **only** on rating=1 (Again). |
| `batch-creator.tsx` (client) | 2-column layout: conversation (Claude chat) + editable draft set (shared tags + `DraftCardItem[]` + commit button). Plain-text history, tools ephemeral on the server side. |
| `draft-card-item.tsx` (client) | Draft set item: term / definition / distractors / "Find an image" button (opt-in). No persistence until the set is committed. |
| `app-nav.tsx` (client) | Responsive header used by `(app)/layout.tsx`: horizontal links on `md`+, hamburger + Sheet on mobile with Install button and Déconnexion. |
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
         └─▶ deriveMode(current.fsrs_state)  (stability >= 7d → typing, else qcm)
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

after reveal: if card.explanation is non-null,
  "i" icon → markdown Dialog with the full explanation
```

**Invariants**:
- DB = source of truth. The local queue is a prefetch convenience: prefetched-but-unrated cards are not consumed (plain SELECT), they reappear in the next `/review`.
- Re-insertion **only** when rating === 1 (Again). Any other rating = immediate exit. The "N in queue" counter stays faithful to what is actually due on the DB side.
- `key={current.id}` on the card components → full remount → local state (`selected`, `answer`, `revealed`) resets for each card.

## Create a set flow (batch via chat)

Route [`/create`](../app/(app)/create/page.tsx).

```
<BatchCreator>  (client — useState for everything)
   │
   ├── history: DisplayMessage[]    // {role, text} — plain text, no tool_use here
   ├── draftCards: DraftCard[]      // {localId, term, definition, distractors[3], image}
   ├── sharedTags: string[]
   └── userInput: string

  user types + sends
         │
         └─▶ sendBatchMessage({ history, userText, draftCards, sharedTags })  (Server Action)
                   │
                   └─▶ runBatchTurn(...)  (lib/anthropic/batch.ts)
                          │
                          ┌────────── loop, max 5 iterations ──────────┐
                          │                                             │
                          │   user message = [formatState(draft,tags),  │
                          │                   userText]                 │
                          │                                             │
                          │   client.messages.create({                  │
                          │     tools: BATCH_TOOLS,                     │
                          │     messages: apiMessages,                  │
                          │   })                                        │
                          │          │                                  │
                          │          ▼                                  │
                          │   response.content contains:                │
                          │     - text blocks (assistant message)       │
                          │     - tool_use blocks                       │
                          │          │                                  │
                          │          ▼                                  │
                          │   applyTool(name, input, state) → new       │
                          │     state + tool_result text                │
                          │          │                                  │
                          │          ▼                                  │
                          │   if stop_reason === 'tool_use':            │
                          │     push tool_results to next msg → loop    │
                          │   else: break                               │
                          └─────────────────────────────────────────────┘
                   │
                   └─▶ { assistantText, draftCards, sharedTags }
         │
         ▼
   client state updated: history += [user, assistant], draft + tags replaced

  user may also:
    - edit term/definition/distractors directly in DraftCardItem
    - delete a card from the draft
    - add/remove a tag manually
    - click "Find an image" on a card (calls findImageForDraft)
    - add an empty card ("+ Add card manually")

  final "Add N cards to the deck" button
         │
         └─▶ commitSet({ theme, sharedTags, cards })
                   │
                   ├── batch INSERT into cards (N rows, single query)
                   │     each with initCard() FSRS + qcm_choices.distractors
                   ├── revalidatePath('/cards'), revalidatePath('/review')
                   └── return { ids, firstTag }
         │
         └─▶ redirect /cards?tag=<firstTag>
```

**Claude tools** (JSON Schema in [`lib/anthropic/batch.ts`](../lib/anthropic/batch.ts)):
- `create_cards({ cards: [{ term, definition, distractors[3] }] })` — adds N cards, assigns UUID `localId`s
- `edit_card({ localId, patch: { term?, definition?, distractors? } })` — edits an existing card
- `delete_card({ localId })` — removes a card from the set
- `propose_tags({ tags: string[] })` — replaces the shared tag list

`localId` is a client-generated UUID from `crypto.randomUUID()`. The LLM receives it via `formatState` and uses it to target `edit_card`/`delete_card`.

## See also

- [[conventions]] — transverse invariants (FSRS Again-only, UTC dates, Server Actions)
- [[fsrs]] — algorithm, QCM/typing threshold, re-insertion
- [[data-model]] — `cards` / `reviews` schema, indexes
- [[llm-prompts]] — theme-explain, theme-refine, batch (tool use)
