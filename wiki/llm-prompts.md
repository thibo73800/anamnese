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
- 5 structured fields: explanation (150-300 words, **simple markdown** — bold/italic), card (term ≤40 chars + definition 20-50 words), 3 distractors, 1-4 tags, `needsImage` flag + `imageQuery`
- Distractors: **3 terms** semantically close to the correct term (partial synonyms, adjacent concepts, false friends, neighboring disciplines), ≤ 40 chars. **Not definitions** — the QCM tests term recall from the definition (see [[fsrs#card-orientation-definition--term]]).
- Hard constraints: no emoji, self-sufficient definition, if the theme is vague → pick an emblematic angle

**Prompt cache** enabled via `cache_control: { type: 'ephemeral' }` on the system block → the stable prompt is cached by Anthropic, cutting latency and cost on subsequent calls (~90% savings on the cached portion).

### User prompt

Just `Thème: <trim(theme)>` — everything else lives in the system. This separation is what makes caching effective (user message varies, system doesn't).

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
    suggestedTags: string[].min(1).max(4),
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
- **Not shared with the UI** — the creation flow in `/create` already gets distractors via `batch.ts` tools. This prompt is only for the Bearer-auth'd API path where the caller (e.g. the Claude Code skill) may not want to ship distractors themselves.

### Cost

`max_tokens: 400`, ~300 input tokens + ~100 output tokens → ~$0.001 per card on Sonnet 4.6. Users calling the API with batches of 50 without distractors pay ~$0.05 per batch.

### Rate considerations

The route handler runs `Promise.all(payloads.map(normalizeCreatePayload))` — batches of N cards without distractors fire N parallel Claude calls. No application rate limiting today (the Bearer-auth'd deployment is single-user). If this grows into multi-tenant, add a per-key token bucket before production traffic.

## Batch chat (set creation)

[`lib/anthropic/batch.ts`](../lib/anthropic/batch.ts) + [`lib/anthropic/prompts/batch.ts`](../lib/anthropic/prompts/batch.ts). Powers the `/create` route.

### Differences from `theme-explain`

- **No `client.messages.parse`** — we use `client.messages.create` to get raw `tool_use` blocks.
- **4 custom tools** instead of a single output schema:
  - `create_cards({ cards: [{ term, definition, distractors[3] }] })`
  - `edit_card({ localId, patch })`
  - `delete_card({ localId })`
  - `propose_tags({ tags: string[] })`
- **Agentic loop** server-side (`runBatchTurn`, max 5 iterations). Each iteration:
  1. Call Claude with `messages` + `tools`
  2. If `stop_reason === 'tool_use'`: each tool is validated (Zod), applied to local state (`draftCards`, `sharedTags`), and a `tool_result` is composed with a textual summary
  3. The `tool_result`s are injected into a `user` message and we loop
  4. Otherwise exit and return the final free text
- **Current state injected at every turn** via `formatState(draft, tags)` at the top of each user message. The model always sees the live truth, even after manual edits by the user in the UI between turns.
- **LocalId** = client UUID. The system prompt instructs `edit_card`/`delete_card` to target via the `localId` provided in the current state. More robust than a numeric index that shifts on deletion.
- **Client history**: the component only stores `DisplayMessage[]` (role + text). `tool_use` / `tool_result` blocks live ephemerally inside `runBatchTurn` for the duration of a turn — they don't accumulate on the client or bloat the request.

### System prompt

Defines 2 phases:
1. **First turn** (empty set): 6-10 initial cards via `create_cards` + tags via `propose_tags` + a short text message recapping.
2. **Subsequent turns**: edit/delete/add rather than rebuild. May call multiple tools in a single turn.

Quality rules for card shape match `theme-explain` (French, short terms, 20-60 word definition, distractors as close terms not sentences).

`cache_control: ephemeral` on the system prompt (default 5-min cache TTL).

### Server action contract

```ts
sendBatchMessage({ history, userText, draftCards, sharedTags })
  → { history, draftCards, sharedTags }       // updated state

findImageForDraft({ query })
  → ImageHit | null                            // opt-in image pipeline trigger

commitSet({ theme, sharedTags, cards })
  → { ids, firstTag }                          // batch INSERT + revalidate
```

### Observed cost

Higher than `theme-explain`: the system prompt is longer (4 tool descriptions) and we do **several turns per user message** (each tool_use triggers a relance). In practice: 1-3 iterations per message, ~2-5k cumulative input tokens, ~1-2k output tokens. **Cost per message ≈ $0.02-$0.05** on Sonnet 4.6. A full set (2-4 user messages) → $0.05-$0.20.

## Possible evolutions

- **Prompt caching with 1h TTL** (`cache_control: { type: 'ephemeral', ttl: '1h' }`) if the system grows and daily traffic warrants it. Current 5-min default is fine.
- **Adaptive thinking** (`thinking: { type: 'adaptive' }`) not enabled: the task doesn't warrant it (simple structured extraction). Enable it if we want deeper/more nuanced explanations.
- **Retry on `refusal`**: no handling currently. If it triggers on a sensitive theme, the UI just shows the Anthropic error. Monitor.

## See also

- [[architecture#create-a-set-flow-batch-via-chat]] — client `BatchCreator` ↔ Server Action loop
- [[architecture#public-api]] — where `distractors.ts` plugs in
- [[api]] — `POST /api/v1/cards` contract (triggers the distractors prompt on missing field)
- [[conventions#anthropic-keys--org-scoped]] — org/workspace invariant
- [[fsrs#card-orientation-definition--term]] — motivates distractor shape
- [[data-model]] — where generated cards land
