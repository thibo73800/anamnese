# FSRS & review modes

## Library

[`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs) (FSRS-4.5), minimal wrapper in [`lib/fsrs/engine.ts`](../lib/fsrs/engine.ts).

## Internal API

```ts
initCard(now?: Date): Card                    // new card, state = New
reviewCard(state, rating, now?)               // applies the rating → { card, previous }
  // rating ∈ {1,2,3,4} = Again | Hard | Good | Easy
normalizeCard(raw): Card                      // restores Date objects after JSONB round-trip
```

FSRS parameters:
- `enable_fuzz: true` — adds a bit of random noise to intervals so many cards don't fall on the same day
- Everything else = defaults (`request_retention: 0.9`, `maximum_interval: 36500`, FSRS-5 decay)

## JSON round-trip

`Card` uses `Date` objects, `ts-fsrs` serializes them to ISO strings via `JSON.stringify`. On Supabase `SELECT` we get strings back. `normalizeCard` converts `due` / `last_review` back to `Date` and `state` from text → int enum before calling `scheduler.next()` again.

If you edit `fsrs_state` manually (debug), keep the same format — any non-ISO-8601 string crashes `new Date(…)`.

## QCM → typing threshold

[`lib/fsrs/mode.ts`](../lib/fsrs/mode.ts)

```ts
export const TYPING_MODE_STABILITY_THRESHOLD_DAYS = 2

deriveMode(state) → 'typing' if stability >= 2, else 'qcm'
```

**Why `stability`** and not `reps`:
- `reps` ignores answer quality (3 Good in a row ≠ 3 Again)
- `stability` predicts how many days the card will stay retained → a direct measure of "how well it's learned"

**Why such a low threshold (2 days)**:
FSRS calibrates `stability` on the grades it receives. If the card stays in QCM for many reviews, every grade reflects *recognition* from 4 choices — an easier task than free recall. The resulting `stability` then overestimates typing-level retention.
By switching to typing very early (after ~1 successful QCM), we:
- Keep QCM as a brief familiarization phase (the user sees definition, image, distractors once)
- Force the bulk of calibration to happen on the real retrieval signal
- Accept that early typings will fail more often — those Agains are legitimate signal, not noise

If only "Again" is rated, `stability` stays < 2 and the card stays in QCM — correct behavior (the user never graduated out of familiarization).

Tweak the threshold: change the constant, nothing else needs touching. Existing cards will flip automatically the next time `deriveMode` is called.

## Mastery levels

[`lib/fsrs/mode.ts`](../lib/fsrs/mode.ts) exposes `deriveMastery(state)` returning `{ level, label }` based on `stability`:

| Level | `stability` (days) | Label (FR) | Meaning |
|---|---|---|---|
| `new` | < 2 | Nouvelle | QCM familiarization phase |
| `learning` | 2 – 14 | Apprentissage | Typing active, stability being calibrated |
| `consolidated` | 14 – 30 | Consolidée | Typing reliable |
| `mastered` | ≥ 30 | Maîtrisée | Mature, long-interval retention (Anki-mature territory) |

The lower boundary (2) matches the QCM→typing threshold so "leaving the red palier" visually matches "unlocking typing". Rendered on the cards list via [`components/mastery-badge.tsx`](../components/mastery-badge.tsx) — replaces the former QCM/Saisie badge since the mode is now implicit in the mastery level.

Note: `lapses` is intentionally ignored in v1 (simpler single-rule mapping). If cards with many lapses end up mis-classified in practice, add a "Difficile" override.

## Rating UI

4 FSRS buttons ([`components/rating-buttons.tsx`](../components/rating-buttons.tsx)):

| Button | Rating | Meaning | Effect on the current session |
|---|---|---|---|
| Again | 1 | I couldn't recall, show me again soon | **Pushed to end of queue** (the only rating that does this) |
| Hard | 2 | Got it but barely | Leaves the session, reappears once `due` has passed |
| Good | 3 | OK, normal cadence | Leaves the session |
| Easy | 4 | Too obvious, space it more | Leaves the session |

In QCM mode, the reveal happens on **clicking an option** — no separate "Show answer" button needed.
In typing mode, click "Reveal" after typing, then rate.

## Review session

The `/review` page is client-side with a prefetched queue of 10 cards, managed by [`components/review-session.tsx`](../components/review-session.tsx).

- **Prefetch**: the RSC calls `getDueCards(10)` and passes the list to `<ReviewSession>`. Background refetch via `getDueCardsExcluding(seenIds, 10)` once the queue drops to ≤ 3.
- **Synchronous pop** on rate: the next card appears on the next paint (no server round-trip awaited).
- **Persistence**: each rate is an atomic `update cards.fsrs_state + insert reviews`. Prefetched unrated cards are not consumed on the DB side.
- **Again-only re-insertion**: only rating 1 re-pushes the card to the end of the queue. Any other rating = immediate exit, natural reappearance at the next `getDueCards`. This choice aligns UI and DB: the "N in queue" counter stays faithful to what is actually due in persistence.
- **Fire-and-forget** on `submitReview`: `.then/.catch`, no `await`. Lets the UI advance without waiting for the DB commit. Errors surface via toast.
- `key={current.id}` on `<ReviewCardQcm>` / `<ReviewCardTyping>` → full remount between cards, local state reset.

Detailed flow in [[architecture#review-flow]].

## Card orientation: definition → term

- **QCM**: shows the **definition** + image, 4 **terms** to choose from, validates against `card.term`.
- **Typing**: shows the **definition**, user types the **term**, reveals term + image.

We test vocabulary recall from the concept — pedagogically stronger than recognition. QCM distractors are semantically close terms (partial synonyms, false friends), not alternative definitions. The correct answer = `card.term`; there is no `correct` field in `qcm_choices` (see [[conventions#qcm_choices--shape]]).

After reveal, if `card.explanation` is non-null, an "i" icon button opens a markdown Dialog with the detailed explanation.

## Tests

[`lib/fsrs/engine.test.ts`](../lib/fsrs/engine.test.ts) — 7 Vitest tests:
- Init (state New, reps=0)
- Each rating 1..4 applies without crash, `due` in the future
- Again after 2 Goods → increments `lapses`
- Easy > Good on `stability`
- JSON round-trip preserves behavior
- `deriveMode` returns `qcm` on a fresh card
- `deriveMode` flips exactly at `stability >= 2`
- `deriveMastery` returns the 4 expected levels across the boundaries (0, 2, 14, 30)

`npm test` to re-run.

## See also

- [[architecture#review-flow]] — full client-side session flow
- [[conventions#fsrs--re-insertion--card-orientation]] — Again-only invariant and card orientation
- [[data-model]] — `fsrs_state` and `qcm_choices` structure
- [[llm-prompts]] — prompt that generates the distractors (close terms)
