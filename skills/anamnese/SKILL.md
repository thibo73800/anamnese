---
name: anamnese
description: Add, update, list, or query flashcards in the user's Anamnèse deck via the Anamnèse REST API. Use when the user says "retiens ça", "mémorise", "add a flashcard", "save this to Anamnèse", or similar phrasing indicating they want a fact stored for spaced-repetition review.
---

# Anamnèse — flashcard skill

Anamnèse is the user's personal spaced-repetition app (Next.js + Supabase + FSRS). This skill lets you push new cards, edit existing ones, and query the user's deck from any Claude Code conversation.

## When to use this skill

Activate when the user says, in French or English:
- "retiens ça", "mémorise", "ajoute une carte", "enregistre dans Anamnèse"
- "add this to my flashcards", "remember this for me", "save to Anamnèse"
- Or otherwise asks to store a fact for later spaced-repetition review.

Do **not** activate unprompted — wait for an explicit request.

## Environment

Required env vars (set in the user's shell):

```bash
export ANAMNESE_API_KEY="ana_sk_..."      # Bearer token, generated from /settings/api-keys
export ANAMNESE_API_URL="https://<deploy>" # e.g. https://anamnese.vercel.app
```

If either is missing when you need to call the API, tell the user and stop — do not guess.

## Card shape

A card consists of:
- `term` (required) — the concept to recall, ≤120 chars. **In French** (the user's deck is French).
- `definition` (required) — autosufficient explanation, ≤600 chars, 20–60 words.
- `tags` (optional) — array of ≤8 short lowercase tags (`["histoire", "antiquité"]`).
- `theme` (optional) — the broader topic this card belongs to, for future reference.
- `distractors` (optional, tuple of exactly 3) — plausible but wrong **terms** for the QCM review mode. **Prefer leaving this out** — the server auto-generates them via Claude.
- `image_url`, `image_source`, `image_attribution` (optional) — only if the user explicitly provided an image URL. Sources: `"wikimedia"`, `"unsplash"`, `"google"`.
- `explanation` (optional) — longer markdown write-up (≤4000 chars), shown on demand during review. Send only if the user asked for a detailed explanation.

**Review direction**: the user sees the `definition` and must recall the `term`. So:
- `term` = short, precise (a name, a concept).
- `definition` = self-contained, clear without context, does not repeat the term.

## Decision rules

1. **Always confirm before POSTing**, unless the user says "ajoute directement" / "just add it". Show the proposed `term` / `definition` / `tags` as a preview and wait for a yes.
2. **Batch** several facts from the same conversation into a single `POST /cards` with a `cards` array — one request, not N.
3. **Distractors**: do not send them. The server auto-generates 3 plausible alternatives via Claude.
4. **Explanation**: skip it unless the user asked for a detailed write-up. A bare term+definition is enough.
5. **Image**: skip `image_url` unless the user explicitly provided a URL. The API does not fetch images itself.
6. **Tags**: propose 1–3 short lowercase tags. Reuse the user's existing tags when possible — call `GET /tags` first if you're unsure.
7. **Language**: write `term`, `definition`, `tags`, `explanation` in French. The deck is French-only.

## API reference

All endpoints require `Authorization: Bearer $ANAMNESE_API_KEY` and `Content-Type: application/json`. Errors come back as `{ "error": { "code", "message" } }`.

### Create one card

```bash
curl -X POST "$ANAMNESE_API_URL/api/v1/cards" \
  -H "Authorization: Bearer $ANAMNESE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "card": {
      "term": "Paradoxe de Fermi",
      "definition": "Contradiction apparente entre la forte probabilité statistique de l'\''existence de civilisations extraterrestres et l'\''absence d'\''indices observables de leur présence.",
      "tags": ["astronomie", "philosophie"]
    }
  }'
```

### Create a batch of cards (preferred when >1)

```bash
curl -X POST "$ANAMNESE_API_URL/api/v1/cards" \
  -H "Authorization: Bearer $ANAMNESE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "cards": [
      { "term": "...", "definition": "...", "tags": ["..."] },
      { "term": "...", "definition": "...", "tags": ["..."] }
    ]
  }'
```

Max 50 cards per batch.

### List cards

```bash
curl "$ANAMNESE_API_URL/api/v1/cards?limit=20" \
  -H "Authorization: Bearer $ANAMNESE_API_KEY"

# filter by tag
curl "$ANAMNESE_API_URL/api/v1/cards?tag=histoire" \
  -H "Authorization: Bearer $ANAMNESE_API_KEY"

# since a date (for incremental sync)
curl "$ANAMNESE_API_URL/api/v1/cards?since=2026-04-01T00:00:00Z" \
  -H "Authorization: Bearer $ANAMNESE_API_KEY"
```

Response: `{ "cards": [...], "next_cursor": "<ISO datetime or null>" }`. Pass `?cursor=<next_cursor>` to paginate.

### Get, update, delete

```bash
# get
curl "$ANAMNESE_API_URL/api/v1/cards/<id>" -H "Authorization: Bearer $ANAMNESE_API_KEY"

# update tags (typical "reorganize" use-case)
curl -X PATCH "$ANAMNESE_API_URL/api/v1/cards/<id>" \
  -H "Authorization: Bearer $ANAMNESE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "tags": ["histoire", "renaissance"] }'

# delete
curl -X DELETE "$ANAMNESE_API_URL/api/v1/cards/<id>" \
  -H "Authorization: Bearer $ANAMNESE_API_KEY"
```

### List all tags

```bash
curl "$ANAMNESE_API_URL/api/v1/tags" -H "Authorization: Bearer $ANAMNESE_API_KEY"
# → { "tags": ["antiquité", "astronomie", "histoire", ...] }
```

### Learning stats

```bash
curl "$ANAMNESE_API_URL/api/v1/stats" -H "Authorization: Bearer $ANAMNESE_API_KEY"
```

Response:
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

## Error codes

- `401 missing_api_key | invalid_api_key | revoked_api_key` — check `ANAMNESE_API_KEY` env var, and that the key hasn't been revoked in the UI.
- `404 not_found` — the card id doesn't exist or belongs to another user.
- `422 validation_error` — payload shape violated a Zod constraint (message includes the failing path).
- `500 internal_error` — tell the user, don't retry blindly.
