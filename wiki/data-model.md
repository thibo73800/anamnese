# Data model

Migrations:
- [`0001_init.sql`](../supabase/migrations/0001_init.sql) — initial schema
- [`0002_card_explanation.sql`](../supabase/migrations/0002_card_explanation.sql) — adds the `explanation` column

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

create policy "cards: owner full access"
  on cards for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "reviews: owner full access"
  on reviews for all
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
