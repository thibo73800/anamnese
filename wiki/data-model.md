# Data model

Migrations:
- [`0001_init.sql`](../supabase/migrations/0001_init.sql) — initial schema
- [`0002_card_explanation.sql`](../supabase/migrations/0002_card_explanation.sql) — adds the `explanation` column
- [`0003_api_keys.sql`](../supabase/migrations/0003_api_keys.sql) — personal API keys table

## Tables

### `public.cards`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK default `gen_random_uuid()` | |
| `user_id` | uuid FK `auth.users(id)` on delete cascade | |
| `term` | text not null | ≤ 120 chars (validated by Zod on the action side) |
| `definition` | text not null | ≤ 600 chars |
| `image_url` | text nullable | URL of the attached image |
| `image_source` | text check in (`wikimedia`,`unsplash`,`google`), nullable | `null` when the user pasted a custom URL |
| `image_attribution` | text nullable | Credit to display (Unsplash requires it). `null` for custom URLs or Wikimedia without extmetadata |
| `tags` | text[] not null default `'{}'` | LLM-suggested, user-editable |
| `theme` | text nullable | Original theme typed by the user |
| `explanation` | text nullable | Detailed markdown version (150-400 words), possibly enriched by clarifying Q&A at creation time. Shown on demand during review via the "i" button. |
| `qcm_choices` | jsonb not null | `{distractors: string[3]}` — 3 **terms** semantically close to the correct `term`. The correct answer = `card.term` (not stored separately). |
| `fsrs_state` | jsonb not null | `Card` serialized from `ts-fsrs` |
| `created_at`, `updated_at` | timestamptz | `set_updated_at` trigger on UPDATE |

**Legacy cards**: some may carry a `qcm_choices.correct` field (old shape, full definition) with likewise long `distractors`. The code ignores that field — the correct answer remains `card.term`. The "Delete" button on `/cards` lets the user remove them manually if needed.

### `public.api_keys`

Personal API keys issued from `/settings/api-keys`, used as Bearer tokens by external clients (e.g. the Claude Code skill in `skills/anamnese/`).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK default `gen_random_uuid()` | |
| `user_id` | uuid FK `auth.users(id)` on delete cascade | |
| `label` | text not null check(length 1..80) | Human-readable name shown in the UI |
| `key_hash` | text not null **unique** | SHA-256 (hex) of the raw key. Raw value never stored. |
| `prefix` | text not null | `ana_sk_` + first 4 chars of the random part — shown in the UI |
| `last4` | text not null | Last 4 chars of the random part — shown in the UI |
| `created_at` | timestamptz default now() | |
| `last_used_at` | timestamptz nullable | Updated fire-and-forget on every successful API call |
| `revoked_at` | timestamptz nullable | Non-null = key is dead; lookup filters on `revoked_at IS NULL` |

Indexes: `api_keys_user_idx (user_id, created_at desc)`, `api_keys_hash_idx` (unique on `key_hash`).

**RLS**: owner-only (`auth.uid() = user_id`). The `/api/v1/*` route handlers bypass this policy on purpose by using the service-role client — see [[conventions#api-routes--service-role]].

**Hashing — SHA-256 (not bcrypt/argon2)**: the raw key is `ana_sk_` + 32 Crockford base32 chars = 160 bits of uniform entropy. Slow-KDFs defend low-entropy human passwords; they're unnecessary (and costly) for high-entropy random tokens. This matches the Stripe / GitHub PAT pattern. Implementation: `lib/api-auth/keygen.ts`.

### `public.reviews`

Review history (audit, future analytics, potential undo).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `card_id`, `user_id` | uuid FK on delete cascade | |
| `rating` | smallint 1..4 | 1=Again, 2=Hard, 3=Good, 4=Easy |
| `mode_used` | text `qcm`\|`typing` | Mode used **for this review** (computed via `deriveMode` at submit time) |
| `response_text` | text nullable | User input in typing mode |
| `reviewed_at` | timestamptz default now() | |
| `previous_state`, `new_state` | jsonb | FSRS snapshots before/after |

### `public.daily_suggestions`

Per-user snapshot of the 6 themes shown on the home page for the current day. Avoids regenerating via Claude on every page visit.

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid PK FK on delete cascade | one row per user, upserted |
| `date` | date | Day the snapshot was produced (UTC). If mismatched with today → regenerate |
| `themes` | jsonb | Array of `{ label, kind: 'deepen'\|'related', rationale, consumed: boolean }` |
| `updated_at` | timestamptz default now() | Maintained by `set_updated_at` trigger |

**Consumption model**: when the user starts a volatile session on a theme, `consumeSuggestedTheme` flips that theme's `consumed: true`. On the next home page load, `getSuggestedThemes` detects consumed slots, calls Claude to regenerate **only** those slots (with `excludeLabels` set to all current labels), merges back and saves. The 6 themes visible on screen are always non-consumed.

## Indexes

```sql
-- Due cards query: order by fsrs_state->>'due' asc, filter by user_id
create index cards_user_due_idx on cards (user_id, (fsrs_state->>'due'));

-- Filter by tag
create index cards_user_tags_idx on cards using gin (tags);

-- Chronological listing
create index cards_user_created_idx on cards (user_id, created_at desc);

-- Per-card history (future reviews panel)
create index reviews_card_idx on reviews (card_id, reviewed_at desc);
create index reviews_user_idx on reviews (user_id, reviewed_at desc);
```

### Why no `::timestamptz` cast in the index

Postgres requires indexed expressions to be `IMMUTABLE`. The `text::timestamptz` cast isn't (potentially depends on `timezone`). So we index the raw `text`.

**Invariant to preserve**: `fsrs_state->>'due'` is always an ISO-8601 string in UTC (`Z` suffix), produced by `Date.prototype.toISOString()`. Lexicographic `<=` / `>=` comparisons on those strings match chronological comparisons. The moment we start writing dates in non-UTC format, this index becomes wrong.

## RLS (Row Level Security)

```sql
alter table cards enable row level security;
alter table reviews enable row level security;
alter table daily_suggestions enable row level security;

create policy "cards: owner full access"
  on cards for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "reviews: owner full access"
  on reviews for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "daily_suggestions: owner full access"
  on daily_suggestions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

All reads/writes from the app go through the **anon** client (session cookies → `auth.uid()` resolved). The `service_role` key bypasses RLS — used only in admin scripts (`scripts/admin-*.mjs`).

## `updated_at` trigger

Standard:

```sql
create or replace function public.set_updated_at() returns trigger ...
  new.updated_at := now();
  return new;

create trigger cards_set_updated_at before update on cards
  for each row execute function public.set_updated_at();
```

Not needed on `reviews` (immutable history).

## See also

- [[conventions#dates--serialization]] — UTC ISO-8601 invariant (which `cards_user_due_idx` depends on)
- [[conventions#qcm_choices--shape]] — contract of the `qcm_choices` column
- [[conventions#sql-migrations]] — migration application procedure
- [[auth-flow]] — RLS via `auth.uid()` on the anon client
