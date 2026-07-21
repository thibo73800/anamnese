import type { MasteryLevel } from './mode'

/** Ordre croissant de maîtrise — sert au meter segmenté et aux légendes. */
export const MASTERY_ORDER: MasteryLevel[] = [
  'new',
  'learning',
  'consolidated',
  'mastered',
]

/** Classes du badge outline (source unique, consommée par MasteryBadge). */
export const MASTERY_BADGE: Record<MasteryLevel, string> = {
  new: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
  learning: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  consolidated: 'border-lime-500/40 bg-lime-500/10 text-lime-800 dark:text-lime-300',
  mastered: 'border-green-600/40 bg-green-600/10 text-green-800 dark:text-green-300',
}

/** Aplats pleins pour la barre segmentée — même progression rouge→vert. */
export const MASTERY_BAR: Record<MasteryLevel, string> = {
  new: 'bg-red-500',
  learning: 'bg-orange-500',
  consolidated: 'bg-lime-500',
  mastered: 'bg-green-600',
}

/** Libellés courts (le label long vit dans deriveMastery). */
export const MASTERY_LABEL: Record<MasteryLevel, string> = {
  new: 'Nouvelles',
  learning: 'Apprentissage',
  consolidated: 'Consolidées',
  mastered: 'Maîtrisées',
}
