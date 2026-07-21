import { getProgressRecap } from '@/app/actions/cards'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  MASTERY_BAR,
  MASTERY_LABEL,
  MASTERY_ORDER,
} from '@/lib/fsrs/mastery-colors'
import type { ProgressPoint, ProgressRecap } from '@/lib/cards/repository'

export async function ProgressRecap() {
  let recap: ProgressRecap
  try {
    recap = await getProgressRecap()
  } catch (err) {
    console.error('[ProgressRecap] getProgressRecap failed', err)
    return null
  }
  if (recap.total_cards === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Ma progression
        </h2>
        <PhaseBadge phase={recap.phase} />
      </div>

      <Card size="sm">
        <CardContent className="space-y-4">
          <MasteryMeter histogram={recap.histogram} total={recap.total_cards} />
          {recap.series.length >= 2 && <ProgressCurve series={recap.series} />}
        </CardContent>
      </Card>
    </div>
  )
}

function PhaseBadge({ phase }: { phase: ProgressRecap['phase'] }) {
  const learn = phase === 'learn'
  return (
    <Badge
      variant="outline"
      className={
        learn
          ? 'border-green-600/40 bg-green-600/10 text-green-800 dark:text-green-300'
          : 'border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300'
      }
    >
      {learn ? 'Prêt à apprendre' : 'À consolider'}
    </Badge>
  )
}

function MasteryMeter({
  histogram,
  total,
}: {
  histogram: ProgressRecap['histogram']
  total: number
}) {
  const sum = MASTERY_ORDER.reduce((acc, l) => acc + histogram[l], 0) || 1

  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {MASTERY_ORDER.map((level) => {
          const count = histogram[level]
          if (count === 0) return null
          return (
            <div
              key={level}
              className={MASTERY_BAR[level]}
              style={{ width: `${(count / sum) * 100}%` }}
              title={`${MASTERY_LABEL[level]} : ${count}`}
            />
          )
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {MASTERY_ORDER.map((level) => (
          <span key={level} className="inline-flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${MASTERY_BAR[level]}`} />
            {MASTERY_LABEL[level]}
            <span className="font-medium text-foreground">
              {histogram[level]}
            </span>
          </span>
        ))}
        <span className="ml-auto">{total} au total</span>
      </div>
    </div>
  )
}

function ProgressCurve({ series }: { series: ProgressPoint[] }) {
  const maxY = Math.max(1, ...series.map((p) => p.seen))
  const n = series.length

  const points = (key: 'seen' | 'mastered') =>
    series
      .map((p, i) => {
        const x = (i / (n - 1)) * 300
        const y = 100 - (p[key] / maxY) * 100
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')

  const first = series[0]
  const last = series[n - 1]
  const deltaSeen = last.seen - first.seen
  const deltaMastered = last.mastered - first.mastered

  return (
    <div className="space-y-2">
      <svg
        viewBox="0 0 300 100"
        preserveAspectRatio="none"
        className="h-24 w-full"
        role="img"
        aria-label="Évolution des cartes vues et maîtrisées"
      >
        <polyline
          points={points('seen')}
          className="fill-none stroke-foreground/40"
          strokeWidth={2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={points('mastered')}
          className="fill-none stroke-green-600"
          strokeWidth={2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3 bg-foreground/40" />
          Cartes vues
          <span className="font-medium text-foreground">{last.seen}</span>
          {deltaSeen > 0 && <span className="text-foreground/60">+{deltaSeen}</span>}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3 bg-green-600" />
          Maîtrisées
          <span className="font-medium text-foreground">{last.mastered}</span>
          {deltaMastered > 0 && (
            <span className="text-foreground/60">+{deltaMastered}</span>
          )}
        </span>
        <span className="ml-auto">sur ~3 mois</span>
      </div>
    </div>
  )
}
