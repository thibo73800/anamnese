import { Badge } from '@/components/ui/badge'
import { deriveMastery, type MasteryLevel } from '@/lib/fsrs/mode'

const STYLES: Record<MasteryLevel, string> = {
  new: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
  learning: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  consolidated: 'border-lime-500/40 bg-lime-500/10 text-lime-800 dark:text-lime-300',
  mastered: 'border-green-600/40 bg-green-600/10 text-green-800 dark:text-green-300',
}

export function MasteryBadge({ fsrsState }: { fsrsState: unknown }) {
  const { level, label } = deriveMastery(fsrsState)
  return (
    <Badge variant="outline" className={`text-xs ${STYLES[level]}`}>
      {label}
    </Badge>
  )
}
