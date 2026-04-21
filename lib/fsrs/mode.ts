import type { Card } from 'ts-fsrs'
import type { CardMode } from '@/lib/types'
import { normalizeCard } from './engine'

/**
 * Seuil au-delà duquel on passe de QCM à saisie libre.
 * `stability` est en jours chez FSRS.
 *
 * Valeur basse volontaire : le QCM sert à la familiarisation initiale (voir
 * définition + distracteurs). Dès que la carte atteint ~2j de stability (≈ après
 * un premier QCM réussi), on bascule en typing pour que FSRS calibre sa
 * `stability` sur un signal réellement représentatif de la rétention active.
 */
export const TYPING_MODE_STABILITY_THRESHOLD_DAYS = 2

export function deriveMode(rawState: Card | unknown): CardMode {
  const card = normalizeCard(rawState)
  return card.stability >= TYPING_MODE_STABILITY_THRESHOLD_DAYS ? 'typing' : 'qcm'
}

export function isDue(rawState: Card | unknown, now: Date = new Date()): boolean {
  const card = normalizeCard(rawState)
  return card.due.getTime() <= now.getTime()
}

/**
 * Paliers de maîtrise basés sur `stability` (jours de rétention estimés par FSRS).
 * Le palier "Nouvelle" couvre la phase QCM (familiarisation) ; les autres
 * reflètent l'évolution sous signal typing.
 */
export type MasteryLevel = 'new' | 'learning' | 'consolidated' | 'mastered'

export interface Mastery {
  level: MasteryLevel
  label: string
}

export function deriveMastery(rawState: Card | unknown): Mastery {
  const { stability } = normalizeCard(rawState)
  if (stability < TYPING_MODE_STABILITY_THRESHOLD_DAYS) return { level: 'new', label: 'Nouvelle' }
  if (stability < 14) return { level: 'learning', label: 'Apprentissage' }
  if (stability < 30) return { level: 'consolidated', label: 'Consolidée' }
  return { level: 'mastered', label: 'Maîtrisée' }
}
