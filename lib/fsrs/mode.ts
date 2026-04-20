import type { Card } from 'ts-fsrs'
import type { CardMode } from '@/lib/types'
import { normalizeCard } from './engine'

/**
 * Seuil au-delà duquel on passe de QCM à saisie libre.
 * `stability` est en jours chez FSRS.
 */
export const TYPING_MODE_STABILITY_THRESHOLD_DAYS = 7

export function deriveMode(rawState: Card | unknown): CardMode {
  const card = normalizeCard(rawState)
  return card.stability >= TYPING_MODE_STABILITY_THRESHOLD_DAYS ? 'typing' : 'qcm'
}

export function isDue(rawState: Card | unknown, now: Date = new Date()): boolean {
  const card = normalizeCard(rawState)
  return card.due.getTime() <= now.getTime()
}
