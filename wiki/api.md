# Public API (`/api/v1/*`)

Bearer-authenticated REST surface for external clients (Claude Code skill, iOS Shortcuts, custom scripts). Shares the same persistence layer as the UI Server Actions via `lib/cards/repository.ts`.

Implementation: `app/api/v1/**/route.ts` + `lib/api-v1/*` + `lib/api-auth/*`.

## Authentication

Every request:

```
Authorization: Bearer ana_sk_<32 Crockford base32 chars>
Content-Type: application/json
```

The handler (`lib/api-v1/handler.ts#withApiKey`) runs:
1. Extract `Authorization` header, validate format `^ana_sk_[0-9A-HJKMNP-TV-Z]{32}$` → 401 on mismatch.
2. SHA-256 the raw key → lookup in `api_keys` where `revoked_at IS NULL`. Miss → 401.
3. Fire-and-forget update of `last_used_at`.
4. Build `{ userId, keyId, supabase: createServiceClient() }` context.
5. Delegate to the route handler.

The service-role client bypasses RLS. Every query in `lib/cards/repository.ts` **must** filter `.eq('user_id', userId)` — see [[conventions#api-routes--service-role]].

## Error shape

```json
{ "error": { "code": "invalid_api_key", "message": "Clé inconnue" } }
```

Codes: `missing_api_key`, `invalid_api_key`, `revoked_api_key` (401) · `validation_error` (422) · `not_found` (404) · `internal_error` (500).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/cards` | Create one card (`{ card }`) or a batch (`{ cards: [...max 50] }`) |
| `GET` | `/api/v1/cards` | List cards — query `?tag&limit&since&cursor` |
| `GET` | `/api/v1/cards/:id` | Get one card |
| `PATCH` | `/api/v1/cards/:id` | Partial update (term, definition, tags, image_*, explanation) |
| `DELETE` | `/api/v1/cards/:id` | Delete one card |
| `GET` | `/api/v1/tags` | Distinct tag list |
| `GET` | `/api/v1/stats` | Learning counters (7-day window) |

### POST `/api/v1/cards`

**Request body** (`card` or `cards`):

```ts
{
  term: string,                                   // 1..120
  definition: string,                             // 1..600
  tags?: string[],                                // ≤8, each ≤40
  theme?: string | null,                          // ≤200
  distractors?: [string, string, string],         // auto-generated if missing
  image_url?: string | null,                      // must be a URL if present
  image_source?: 'wikimedia'|'unsplash'|'google'|null,
  image_attribution?: string | null,              // ≤400
  explanation?: string | null,                    // markdown, ≤4000
}
```

**Auto-generation**: when `distractors` is missing, the server calls `generateDistractors` (`lib/anthropic/distractors.ts`) using `claude-sonnet-4-6` to produce 3 plausible wrong terms. `explanation` is **never** auto-generated — omit it to store `null`.

**Response** `201`:

```json
{ "card": { "id": "<uuid>", "term": "...", ... } }
// or (batch)
{ "cards": [{ "id": "<uuid>", ... }, ...] }
```

### GET `/api/v1/cards`

Query params:
- `tag` — filter via `cards.tags @> ARRAY[tag]`.
- `limit` — 1..200, default 50.
- `since` — ISO datetime, filters `updated_at >= since` (incremental sync).
- `cursor` — ISO datetime from a previous `next_cursor`; `created_at < cursor`.

Response:
```json
{ "cards": [...], "next_cursor": "<ISO datetime or null>" }
```

### PATCH `/api/v1/cards/:id`

Any subset of: `term`, `definition`, `tags`, `image_url`, `image_source`, `image_attribution`, `explanation`. Empty body → 422.

`theme` and `distractors` cannot be updated via the API (by design — they're set at creation time).

### GET `/api/v1/stats`

```json
{
  "total_cards": 412,
  "due_count": 23,
  "new_count": 17,
  "learning_count": 5,
  "review_count_7d": 94,
  "ratings_7d": { "again": 8, "hard": 12, "good": 60, "easy": 14 }
}
```

`due_count` counts cards whose `fsrs_state->>'due' <= now()`. `new_count` / `learning_count` come from the FSRS `state` field (`0`=New, `1`=Learning, `3`=Relearning). Review counters aggregate `reviews` rows with `reviewed_at >= now() - 7d`.

## Key management

Keys are created, listed, and revoked from `/settings/api-keys` (Server Actions in `app/actions/api-keys.ts`). The raw key is returned **exactly once** at creation time — after that only `prefix` and `last4` remain visible.

Schema in [[data-model#publicapi_keys]]. Hashing rationale: SHA-256 (the raw key carries 160 bits of uniform entropy, so slow-KDFs like bcrypt/argon2 are unnecessary — this is the Stripe / GitHub PAT pattern).

## Claude Code skills

The repo ships a `skills/anamnese/` skill that consumes this API (push, edit, list cards from any Claude Code conversation). Catalog and install instructions live in [[skills#skillsanamnese]]. The skill's `SKILL.md` references this page as the authoritative endpoint reference.

## See also

- [[conventions#api-routes--service-role]] — invariant: API routes always filter `.eq('user_id', userId)`
- [[data-model#publicapi_keys]] — table schema
- [[architecture#public-api]] — layer placement
- [[operations#common-troubleshooting]] — 401 diagnostics
