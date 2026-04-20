import { createEmptyCard, fsrs, type Card, type CardInput, type Grade } from 'ts-fsrs'
import type { Rating as AnamneseRating } from '@/lib/types'

const scheduler = fsrs({ enable_fuzz: true })

export function initCard(now: Date = new Date()): Card {
  return createEmptyCard(now)
}

export function reviewCard(
  state: Card | CardInput,
  rating: AnamneseRating,
  now: Date = new Date(),
): { card: Card; previous: Card } {
  const previous = normalizeCard(state)
  const { card } = scheduler.next(previous, now, rating as Grade)
  return { card, previous }
}

/**
 * Les Card sérialisées via JSONB reviennent avec due/last_review en strings.
 * ts-fsrs accepte `CardInput` en entrée qui permet string|Date, mais on normalise
 * pour garder un type Card propre partout ailleurs.
 */
export function normalizeCard(raw: Card | CardInput | unknown): Card {
  const r = raw as Record<string, unknown>
  return {
    due: toDate(r.due),
    stability: r.stability as number,
    difficulty: r.difficulty as number,
    elapsed_days: (r.elapsed_days as number) ?? 0,
    scheduled_days: (r.scheduled_days as number) ?? 0,
    learning_steps: (r.learning_steps as number) ?? 0,
    reps: (r.reps as number) ?? 0,
    lapses: (r.lapses as number) ?? 0,
    state: typeof r.state === 'string' ? stateFromString(r.state) : (r.state as number),
    last_review: r.last_review ? toDate(r.last_review) : undefined,
  }
}

function toDate(v: unknown): Date {
  if (v instanceof Date) return v
  if (typeof v === 'string' || typeof v === 'number') return new Date(v)
  throw new Error(`FSRS: valeur de date invalide: ${JSON.stringify(v)}`)
}

function stateFromString(s: string): number {
  switch (s) {
    case 'New':
      return 0
    case 'Learning':
      return 1
    case 'Review':
      return 2
    case 'Relearning':
      return 3
    default:
      return 0
  }
}
