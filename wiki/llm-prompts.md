# LLM prompts

## Client

[`lib/anthropic/client.ts`](../lib/anthropic/client.ts) — lazy init + export `ANAMNESE_MODEL = 'claude-sonnet-4-6'`.

Why Sonnet 4.6 rather than Opus 4.7:
- Task is structured and fairly simple (summary + term extraction + distractors)
- Sonnet 4.6 costs 5× less than Opus 4.7 ($3/$15 vs $5/$25 per M tokens)
- Quality observed in tests: more than sufficient, flawless French

To upgrade on niche or obscure themes: change the constant. No other modification needed.

## theme-explain prompt

[`lib/anthropic/prompts/theme-explain.ts`](../lib/anthropic/prompts/theme-explain.ts)

### System prompt

Strict frame:
- French output required
- 5 structured fields: explanation (150-300 words, **simple markdown** — bold/italic), card (term ≤40 chars + definition 20-50 words), 3 distractors, 1-2 tags (reuse-first policy, see below), `needsImage` flag + `imageQuery`
- Distractors: **3 terms** semantically close to the correct term (partial synonyms, adjacent concepts, false friends, neighboring disciplines), ≤ 40 chars. **Not definitions** — the QCM tests term recall from the definition (see [[fsrs#card-orientation-definition--term]]).
- Hard constraints: no emoji, self-sufficient definition, if the theme is vague → pick an emblematic angle

**Prompt cache** enabled via `cache_control: { type: 'ephemeral' }` on the system block → the stable prompt is cached by Anthropic, cutting latency and cost on subsequent calls (~90% savings on the cached portion).

### User prompt

`Thème: <trim(theme)>` followed by the **existing-tags hint** (see below). The Server Component `app/(app)/search/page.tsx` fetches the user's distinct tags via `repoListTags` and passes them to `explainTheme(theme, existingTags)`. The system prompt stays stable (cached); only the user message varies.

### Existing-tags hint (cross-cutting)

Two prompts — `theme-explain` and `volatile-cards` — share a single helper [`lib/anthropic/prompts/tags-hint.ts`](../lib/anthropic/prompts/tags-hint.ts) → `formatExistingTagsHint(existingTags: string[])`. It emits a block listing the user's current tag set and instructs Claude to (a) reuse existing tags exactly, (b) only introduce a new tag when the card is clearly off-theme, (c) never emit spelling variants of an existing tag. Source of the list: [`repoListTags`](../lib/cards/repository.ts) (distinct, sorted).

## Structured output

[`lib/anthropic/theme.ts`](../lib/anthropic/theme.ts) uses `client.messages.parse()` + `zodOutputFormat(ThemeExplanationSchema)` — the TS SDK's recommended pattern. The Zod schema is auto-converted to JSON Schema and the response is validated SDK-side.

Schema:

```ts
{
  explanation: string,
  needsImage: boolean,
  imageQuery: string | nullable,
  card: {
    term: string.max(80),
    definition: string,
    suggestedTags: string[].min(1).max(2),
    distractors: string[].length(3),
  }
}
```

If `response.parsed_output === null` → throw. Never seen in practice on this prompt, but it signals a malformed response (Claude can't emit output that violates the schema with structured outputs, but `refusal` remains possible).

## theme-refine prompt (follow-up Q&A)

[`lib/anthropic/prompts/theme-refine.ts`](../lib/anthropic/prompts/theme-refine.ts)

Called from `SearchResult` when the user asks a clarifying question below the initial explanation.

### Contract

Input:
- `theme` (original theme)
- `currentExplanation` (current version, possibly already enriched by a previous turn)
- `question` (what the user is asking)

Structured output:
```ts
{ explanation: string }  // enriched version, 150-400 words, simple markdown
```

### Expected behavior

The LLM should **enrich** the existing explanation, not replace it with a separate FAQ:
- Weave the clarification in at the right spot in the text.
- Preserve the essence of the original explanation.
- No "Q:… A:…", no sidebar section.
- If the question is off-topic, answer to the extent it relates to the theme; otherwise rephrase slightly.

### Persistence

The final version (after 0, 1, N refinement turns) is saved into `cards.explanation` at `createCard` time. Accessible afterwards during review via the "i" button (`ExplanationInfo`). Intermediate turns are **ephemeral** — no Q&A history is kept.

## Observed cost

- Cached input (stable system prompt): ~0.3-0.5k tokens
- Non-cached input (short user message): ~30 tokens
- Output (explanation + JSON): ~800-1200 tokens
- **Cost per theme ≈ $0.004-$0.008** on Sonnet 4.6

A `refineExplanation` call has comparable cost (max_tokens 2000, input = current explanation + question). No shared prompt-cache TTL with `explainTheme` — distinct system prompts.

So $5 of credit ≈ 600-1200 generated flashcards. Comfortable for dev.

## Distractors (public API auto-gen)

[`lib/anthropic/distractors.ts`](../lib/anthropic/distractors.ts)

Standalone prompt used by `POST /api/v1/cards` when the payload omits `distractors` (see [[api]]). Given `{ term, definition, theme? }`, returns exactly 3 wrong-but-plausible terms for the QCM review mode.

### Differences from `theme-explain`

- **No structured output helper** — uses `client.messages.create` with a plain system prompt that instructs Claude to return a bare JSON object `{"distractors": [...]}`. Parsed with a tolerant extractor (`indexOf('{')` / `lastIndexOf('}')`) then Zod-validated.
- **No prompt cache** — the system prompt is short enough that caching wouldn't amortize. Single-shot call per invocation.
- **Not shared with the UI** — the volatile flow already gets distractors via `volatile.ts`, and the single-card `/search` flow gets them via `theme.ts`. This prompt is only for the Bearer-auth'd API path where the caller (e.g. the Claude Code skill) may not want to ship distractors themselves.

### Cost

`max_tokens: 400`, ~300 input tokens + ~100 output tokens → ~$0.001 per card on Sonnet 4.6. Users calling the API with batches of 50 without distractors pay ~$0.05 per batch.

### Rate considerations

The route handler runs `Promise.all(payloads.map(normalizeCreatePayload))` — batches of N cards without distractors fire N parallel Claude calls. No application rate limiting today (the Bearer-auth'd deployment is single-user). If this grows into multi-tenant, add a per-key token bucket before production traffic.

## theme-angles prompt (seed exploration)

[`lib/anthropic/prompts/theme-angles.ts`](../lib/anthropic/prompts/theme-angles.ts) + [`lib/anthropic/angles.ts`](../lib/anthropic/angles.ts)

Called by `proposeAngles({ seed })` ([`app/actions/suggestions.ts`](../app/actions/suggestions.ts)) when the user submits a free-text seed from the home page or the `/explore` landing. Produces one main theme plus five angle themes, each linking into the existing `/explore?theme=…` flow. See [[architecture#seed--angles--explore-flow]].

### Input

```ts
{
  seed: string                   // user-typed, 2..200 chars
  profile: ProfileSummary | null // injected only when ≥ 10 reviewed cards exist
}
```

### Output

Structured via `client.messages.parse` + `zodOutputFormat`:

```ts
{
  themes: [{
    label: string.min(1).max(120),
    kind: 'main' | 'angle',
    rationale: string.min(1).max(200)
  }].max(6),
  refusal: string | null
}
```

The server wrapper (`proposeThemeAngles`) enforces the 1-main + 5-angle split. If Claude deviates, the first item is promoted to `main` and the rest become `angle` (capped at 6). If `themes` is empty or `refusal` is non-blank, the call returns `{ kind: 'refused', reason }` — the UI renders a neutral message and a "Essayer un autre sujet" CTA.

### Expected behavior

- The `main` theme is the canonical reading of the seed (e.g. seed `"planètes du système solaire"` → main `"Les planètes du système solaire"`).
- The five `angle` themes cover sub-domains, facets, actors, periods, neighboring concepts, or applications — always within the seed's semantic field.
- Labels are 3-8 French words, usable directly as a theme parameter (no leading articles stripped, no emoji).
- Rationales are ≤ 20-word sentences saying *what the angle covers*, not meta ("pour approfondir").
- Refusal is triggered for vulgar, personal, or empty seeds — structured output, no throw.

### Caching

- **Anthropic ephemeral cache** on the system prompt (same pattern as `theme-suggest`).
- **No DB cache**: user-typed seeds are too specific for a cross-session hit rate. `proposeAngles` is stateless (no table, no migration). Repeated submissions of the same seed will re-call Claude.

### Cost

`max_tokens: 800`, ~350-token system prompt (cached ephemeral), ~100-token user prompt, ~400-token output → **~$0.003-$0.005 per call** on Sonnet 4.6. Budget assumption: ≤ 5 submissions per active user per day.

## theme-suggest prompt (home page suggestions)

[`lib/anthropic/prompts/theme-suggest.ts`](../lib/anthropic/prompts/theme-suggest.ts) + [`lib/anthropic/suggestions.ts`](../lib/anthropic/suggestions.ts)

Called by `getSuggestedThemes()` ([`app/actions/suggestions.ts`](../app/actions/suggestions.ts)) to populate the bottom section of the home page with 6 tailored themes.

### Input

```ts
suggestThemes({
  profile: ProfileSummary,        // compacted from last 100 reviewed cards
  count?: number,                 // 1..6, default 6
  excludeLabels?: string[]        // passed on partial regeneration to avoid duplicates
})
```

Where `ProfileSummary`:

```ts
{
  topThemes: string[]    // up to 10, sorted by count
  topTags: string[]      // up to 10, sorted by count
  recentTerms: string[]  // 15 most recently reviewed (chronological)
  totalCards: number
}
```

### Output

Structured via `client.messages.parse` + `zodOutputFormat`. Schema length is derived from `count`:

```ts
{ themes: [{
    label: string.min(1).max(80),
    kind: 'deepen' | 'related',
    rationale: string.min(1).max(200)
  }].length(count) }
```

For `count = 6`: prompt targets **3 deepen + 3 related**. For partial regeneration (`count < 6`), the prompt asks Claude to balance as best it can on the remaining budget.

### Fallback (profile too small)

When `profile.length < 10`, `getSuggestedThemes()` short-circuits and returns a hard-coded `FALLBACK_THEMES` list of 6 curated general-knowledge themes — **no Claude call, no snapshot written**.

### Daily cache (profile ≥ 10)

Backed by the `daily_suggestions` table ([[data-model#publicdaily_suggestions]]). `getSuggestedThemes()`:
1. Loads the user's snapshot if its `date` matches today (UTC).
2. No snapshot or stale → generate 6, UPSERT.
3. Snapshot exists with `N > 0` consumed themes → regenerate `N` replacements with `excludeLabels = allCurrentLabels`, merge with non-consumed, UPSERT.

Consumption is triggered server-side from `/explore/session` after a successful generation, via `consumeSuggestedTheme({ label })`.

**Graceful degradation**: if the `daily_suggestions` table doesn't exist yet (migration not applied), both `loadTodaySnapshot` and `saveSnapshot` detect Postgres error `42P01` and silently skip caching — the feature still works, just without the per-day optimization.

### Cost

`max_tokens: 800`, stable ~300-token system prompt (cached ephemeral), ~100-token user prompt, ~400-token output → **~$0.003-$0.005 per call** on Sonnet 4.6. With daily cache: 1 full call + typically 0-3 partial calls per user per day.

## volatile-cards prompt (explore session generation)

[`lib/anthropic/prompts/volatile-cards.ts`](../lib/anthropic/prompts/volatile-cards.ts) + [`lib/anthropic/volatile.ts`](../lib/anthropic/volatile.ts)

Called by `startVolatileSession({ theme, count, keepCards? })` ([`app/actions/suggestions.ts`](../app/actions/suggestions.ts)) to generate the QCM deck of a volatile session (never persisted).

### Input

```ts
{
  theme: string
  count: number                      // 10..30
  profile: ProfileSummary | null     // null if < 10 reviewed cards
  excludeTerms: string[]             // terms kept from previous failed session (Recommencer flow)
  existingTags: string[]             // distinct tags from the user's deck (repoListTags), injected as reuse hint
}
```

### Output

Structured via `client.messages.parse` + `zodOutputFormat`:

```ts
{
  sharedTags: string[].min(2).max(5),   // 2-5 tags describing the theme
  cards: [{
    term: string.min(1).max(80),
    definition: string.min(1).max(500),
    distractors: string[].min(3).max(6)  // loosened; sliced to 3 post-parse
  }].min(1).max(30)
}
```

**Why `min(3).max(6)` on distractors**: Claude's structured output sometimes emits 4 distractors on long batches despite the schema. We accept 3-6, then `dedupeKeepOrder` (drops the correct term if it slips in and any duplicates) + `padDistractors` (defensive fallback) + `slice(0, 3)` in [`lib/anthropic/volatile.ts`](../lib/anthropic/volatile.ts) produce the required tuple `[string, string, string]`.

**`sharedTags`** are surfaced to the user only if they choose to persist a volatile card to their permanent deck via the Add-to-deck dialog — they pre-fill the tag input (comma-separated, editable). They are preserved across restarts via `previousSharedTags`. The prompt forces **reuse-first** against `existingTags`: at most 1 new tag per lot, and only when the theme diverges from what the user already has.

### Card format constraints (prompt-enforced)

- **`term`**: ≤ 40 chars. Allowed shapes: proper name, historical period, date, century, technical concept, keyword. Forbidden: full sentences, conjugated verbs, unneeded leading articles.
- **`definition`**: 20-50 words, self-sufficient, mobile-readable. **Must not contain the term** (the game is to guess the term from the definition).
- **`distractors`**: exactly 3, same type as the correct term (date↔date, person↔person, concept↔concept), similar length/style, plausible but false.
- **Difficulty calibration**: when `profile` is provided, the prompt explicitly asks Claude to match the vocabulary and precision level observed in the sample terms.
- **Exclusion**: when `excludeTerms` is non-empty (Recommencer flow), the prompt tells Claude to avoid those terms AND avoid citing them as distractors.

### Restart strategy (Recommencer)

On session end with `E > 0` errors, the user can restart. The client calls `startVolatileSession({ theme, count, keepCards: cardsInMissedIds })`. The server:
1. Extracts `excludeTerms` from `keepCards`.
2. Calls `generateVolatileCards` with `count = N - E` and those `excludeTerms`.
3. Concatenates `[...keepCards, ...generated]` and reshuffles.

This preserves the sticky error cards (so the user re-faces them) while introducing fresh angles for the remaining slots.

### Cost

`max_tokens ≈ 400 + 300 × count` (capped at 8000), input ~600 tokens (stable + user) → **~$0.02 for 10 cards, ~$0.05 for 30** on Sonnet 4.6. System prompt cached ephemeral.

## Possible evolutions

- **Prompt caching with 1h TTL** (`cache_control: { type: 'ephemeral', ttl: '1h' }`) if the system grows and daily traffic warrants it. Current 5-min default is fine.
- **Adaptive thinking** (`thinking: { type: 'adaptive' }`) not enabled: the task doesn't warrant it (simple structured extraction). Enable it if we want deeper/more nuanced explanations.
- **Retry on `refusal`**: no handling currently. If it triggers on a sensitive theme, the UI just shows the Anthropic error. Monitor.

## See also

- [[architecture#seed--angles--explore-flow]] — where `theme-angles` plugs in
- [[architecture#explore-flow-suggested-themes--volatile-qcm-session]] — where `theme-suggest` and `volatile-cards` plug in
- [[architecture#public-api]] — where `distractors.ts` plugs in
- [[api]] — `POST /api/v1/cards` contract (triggers the distractors prompt on missing field)
- [[conventions#anthropic-keys--org-scoped]] — org/workspace invariant
- [[fsrs#card-orientation-definition--term]] — motivates distractor shape
- [[data-model]] — where generated cards land
