# Conventions & invariants

Read at the start of every coding session. Transverse rules that don't fit in any topic page.

## Dates & serialization

All dates written to the DB are produced by `Date.prototype.toISOString()` — **UTC, `Z` suffix**. The `cards_user_due_idx` index on `(fsrs_state->>'due')` indexes the **raw text** (no `::timestamptz` cast — Postgres requires `IMMUTABLE`). Lexicographic comparison matches chronological comparison **only if** all dates are UTC ISO-8601. Writing any other format silently breaks the index.

See `lib/fsrs/engine.ts`, `supabase/migrations/0001_init.sql`.

## Server Actions

Files marked `'use server'` (in `app/actions/*`) **can only export `async` functions**. Turbopack fails the build on any other export (including `export type { … }`). Shared types live in `lib/types.ts`.

## Next.js 16

- Root middleware file is `proxy.ts` (not `middleware.ts`), export `proxy`. The `middleware` name was renamed.
- `params` and `searchParams` are **`Promise`** — always `await`.
- Before using any Next API, consult `node_modules/next/dist/docs/` — up-to-date docs are bundled with the package; training data is stale.

## Supabase cookies (server client)

The `setAll` adapter in `lib/supabase/server.ts` silently swallows the exception when called from a Server Component (Next forbids cookie writes in RSC). This is **intentional** — the actual session refresh happens in `proxy.ts` which holds a mutable `NextResponse`. Do not remove the try/catch.

## shadcn/ui + `@base-ui/react`

The template in use is not Radix: the generated `Button` **has no `asChild` prop**. For a `<Link>` styled as a button:

```tsx
<Link href="/…" className={buttonVariants({ variant: 'outline', size: 'sm' })}>…</Link>
```

## Client → DB: never direct

Client Components **never** touch Supabase on the DB side. Every mutation flows through a Server Action (`app/actions/*`) which creates its own server-side `createClient()` (session cookies → RLS enforced via `auth.uid()`).

The `service_role` key is used in:
1. Admin scripts (`scripts/admin-*.mjs`) — user management, bypass email flow.
2. Public API route handlers (`app/api/v1/**/route.ts`) — see next section.

Never in any Server Action called from the UI.

## API routes — service role + mandatory filtering

`/api/v1/*` route handlers are Bearer-auth'd (not session-auth'd), so they cannot rely on `auth.uid()`. They use `createServiceClient()` from `lib/supabase/service.ts`, which **bypasses RLS**. The isolation barrier becomes application-level:

**Every query issued from the service-role client MUST filter `.eq('user_id', userId)`** where `userId` is resolved by `verifyApiKey()` (`lib/api-auth/verify.ts`). This is enforced at the `lib/cards/repository.ts` layer — which is the single allowed place where card rows are read or mutated. Server Actions delegate there too.

Violating this invariant = inter-tenant leak. Integration tests assert the presence of the filter on every repo function.

**Proxy exemption**: `lib/supabase/proxy.ts` would otherwise redirect any cookieless request to `/login`. The proxy explicitly skips paths starting with `/api/v1/` so that Bearer-auth'd requests reach the route handler (which then answers 401 itself if the key is missing or invalid). Do not broaden the proxy's auth guard without re-exempting `/api/v1/`.

## API keys — hashing & one-time reveal

Personal API keys (`ana_sk_...`) are hashed with **SHA-256** (`lib/api-auth/keygen.ts#sha256Hex`), not bcrypt/argon2. Rationale: the raw key is 32 Crockford-base32 chars = 160 bits of uniform entropy, so slow-KDFs are unnecessary — this is the Stripe / GitHub PAT pattern.

The raw key is returned **exactly once** from `createApiKey` (`app/actions/api-keys.ts`) and shown in a one-time dialog in `/settings/api-keys`. After that, only `prefix` and `last4` remain visible. Regenerating = revoke + create.

## Cards CRUD — single source of truth

`lib/cards/repository.ts` is the **only** module that mutates or reads the `cards` table (outside of one-off queries in `app/actions/cards.ts` for FSRS review). Both Server Actions (session-auth) and `/api/v1/*` route handlers (Bearer-auth) delegate there.

Why: shared Zod validation, shared FSRS initialization (`initCard()`), and — critically — the mandatory `.eq('user_id', userId)` filter is in one place, not duplicated per caller.

## PWA — minimal service worker, no offline cache

The app is online-only but ships a **minimal service worker** at `public/sw.js`. Its sole purpose is to satisfy Chrome Android's PWA installability criteria (which require a registered SW with a `fetch` handler). The handler is an **empty passthrough** — no caching, no request interception, no offline support.

- Registration: `components/pwa/sw-register.tsx` (only in production — avoids stale SW state during `npm run dev`), mounted once from `app/layout.tsx`.
- Proxy exemption: `/sw.js` is listed as a public asset in `lib/supabase/proxy.ts` so the request reaches the file instead of being redirected to `/login`.
- Install UX: `components/pwa/install-button.tsx` captures `beforeinstallprompt` on Chrome/Edge and exposes a manual trigger; on iOS Safari it falls back to a short "Share → Add to Home Screen" tutorial dialog. Rendered inside the mobile nav sheet (`components/app-nav.tsx`).

**Manifest icons** (`app/manifest.ts`) must declare, at minimum, a **192×192** and a **512×512** PNG — both required by Chrome Android's installability criteria. A third entry with `purpose: 'maskable'` (also 512) is required for proper adaptive-icon rendering on Android launchers; its glyph must fit within the central ~80% safe zone (no `borderRadius`, content well inside the circle). Current icon routes:

- `/icon` (512×512, `purpose: 'any'`) — `app/icon.tsx`
- `/icon-192` (192×192, `purpose: 'any'`) — `app/icon-192/route.tsx`
- `/icon-maskable` (512×512, `purpose: 'maskable'`) — `app/icon-maskable/route.tsx`
- `/apple-icon` (180×180) — `app/apple-icon.tsx`, used only by iOS via auto-generated `<link rel="apple-touch-icon">`, not referenced from the manifest

All four icon paths are listed in `lib/supabase/proxy.ts` `isPublicAsset` so Chrome can fetch them during install evaluation even when the visitor is logged out (e.g. on `/login`).

Do not add offline caching to this SW. If offline becomes a requirement, it needs a dedicated design conversation — the current invariant assumes every request hits the network.

## Mobile navigation — hamburger + Sheet

The authenticated header (`components/app-nav.tsx`) renders:
- Desktop (`md`+): horizontal link list, identical to the legacy layout.
- Mobile (`<md`): a hamburger `<Button size="icon">` that opens a side Sheet with vertical links + Install button + Déconnexion.

The Sheet primitive lives at `components/ui/sheet.tsx` and is built on `@base-ui/react/dialog` (not Radix — see [`#shadcn-ui--base-uireact`](#shadcnui--base-uireact)). Animations use `tw-animate-css` classes (`slide-in-from-left`, etc.) via base-ui's `data-open` / `data-closed` attributes.

## Images — plain `<img>` tag

Images render via `<img src>` directly, **not `next/image`**. The Google CSE source returns arbitrary domains, incompatible with Next's `remotePatterns`. Trade-off accepted: no Vercel optimization, but Wikimedia and Unsplash are already served from optimized CDNs.

Display: `object-contain` + fixed configurable height. **Not** `object-cover` (systematic crop on non-16:9). See `components/image-preview.tsx`.

## Volatile sessions — no persistence (except opt-in add-to-deck)

The `/explore` flow (home page suggested themes → QCM test) uses **ephemeral cards that never touch Supabase**, with one explicit exception: the user can choose to persist a specific volatile card via the Add-to-deck dialog, which calls the regular `createCard` Server Action — producing a brand-new `AnamneseCard`, not converting the volatile one.

Invariants:

- `VolatileCard` ([`lib/types.ts`](../lib/types.ts)) has no `user_id`, no `fsrs_state`, no `created_at`. Its `id` is a `crypto.randomUUID()` minted by `startVolatileSession` ([`app/actions/suggestions.ts`](../app/actions/suggestions.ts)) — not a DB row.
- The QCM component used in volatile sessions ([`components/volatile-review-session.tsx`](../components/volatile-review-session.tsx)) is **not** the shared `review-card-qcm.tsx` — it contains a minimal local variant without the mid-review edit/explanation/image UI (different concerns: no persisted fields to mutate). Don't unify them.
- `startVolatileSession` reads the study profile (via `repoGetRecentStudyProfile`) but never writes to `cards` / `reviews`. Zero `reviews` rows are inserted during a volatile session — including on wrong answers. FSRS scheduling is bypassed entirely. The only DB writes happen through the opt-in Add-to-deck path, which uses the standard `createCard` → `cards` table.
- **Card key includes `reviewedCount`**: `<VolatileQcmCard key={`${card.id}-${reviewedCount}`} />`. Required because re-inserting a wrong answer on a single-card queue keeps the same `card.id` at the head, which would otherwise preserve stale UI state and leave the user stuck on their wrong selection.
- **Shared tags** (2-5) are generated alongside the cards and passed through `startVolatileSession` → `VolatileReviewSession` → `AddVolatileCardDialog` to pre-fill the tag input. They stay stable across restarts via `previousSharedTags`.
- **Restart semantics**: on session end with `E > 0` errors, the client calls `startVolatileSession({ theme, count, keepCards, previousSharedTags })`. The server generates `count - keepCards.length` fresh cards with `excludeTerms = keepCards.map(c => c.term)` passed to the prompt, then concatenates and reshuffles. Preserves error cards + shared tags; introduces fresh angles for the remaining slots.
- **Suggestion cache**: `daily_suggestions` table holds one row per user with today's 6 themes. Consumed themes are lazily replaced on the next home page load (see [[llm-prompts#theme-suggest-prompt-home-page-suggestions]]). Missing-table errors are swallowed so the feature degrades to uncached behavior.

## FSRS — re-insertion & card orientation

- **Re-insertion at end of queue**: only when `rating === 1` (Again). Any other rating removes the card from the current session; it will reappear at the next `getDueCards` once its FSRS `due` has passed. Rule motivated by UI/DB alignment — no more cards "stuck" locally while no longer due in DB.
- **Card orientation**: the **definition** is shown, the user must recall the **term**. QCM if `stability < 2d` (brief familiarization), free typing otherwise. Active recall of the term from the concept is pedagogically stronger than recognition — and the low threshold ensures FSRS calibrates `stability` on a typing signal, not on the easier QCM signal.

See `lib/fsrs/engine.ts`, `lib/fsrs/mode.ts`, `components/review-session.tsx`.

## SQL migrations

- Numbered `000N_name.sql` in `supabase/migrations/`, applied in order.
- **No automatic tracking on the dashboard side**: every time a new migration lands in the repo, warn the user to apply it via the **Dashboard SQL Editor** before testing any code that depends on it.
- No direct `psql` CLI on free tier: `db.<ref>.supabase.co:5432` is **IPv6-only**. The `aws-0-*.pooler.supabase.com` pooler requires knowing the project region and a user in `postgres.<ref>` format. In practice → Dashboard SQL Editor.

See [[operations#db-migration]] for the full procedure.

## `qcm_choices` — shape

```ts
{ distractors: string[3] }
```

**The correct answer is `card.term`**, never a separate `correct` field. Legacy cards may still carry `qcm_choices.correct` (old shape, full definition) — the code **ignores** that field. Both QCM and typing test term recall from the definition.

## Anthropic keys — org-scoped

An `sk-ant-…` key only consumes credit from its **organization/workspace**, not any other. Symptom of a misscoped key: `credit balance too low` while the expected org is funded. Check **which org the key belongs to** in `.env.local` before suspecting anything else.

## Supabase email rate limit (free tier)

**4 emails/hour combined** signup + password reset + magic link. Resets ~1h after the last send. Three workarounds:

1. `scripts/admin-create-user.mjs` — pre-confirmed user via `service_role`, full bypass.
2. Custom SMTP (Resend, Mailgun, Brevo) configured in Supabase → Auth → SMTP Settings — much higher limits.
3. Disable "Confirm email" in dev (Auth → Providers → Email).

## See also

- [[operations#common-troubleshooting]] — symptoms → cause → fix
- [[data-model]] — schema, indexes, RLS
- [[architecture]] — layer breakdown
