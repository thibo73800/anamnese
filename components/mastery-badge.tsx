import { Badge } from '@/components/ui/badge'
import { deriveMastery } from '@/lib/fsrs/mode'
import { MASTERY_BADGE } from '@/lib/fsrs/mastery-colors'

export function MasteryBadge({ fsrsState }: { fsrsState: unknown }) {
  const { level, label } = deriveMastery(fsrsState)
  return (
    <Badge variant="outline" className={`text-xs ${MASTERY_BADGE[level]}`}>
      {label}
    </Badge>
  )
}
