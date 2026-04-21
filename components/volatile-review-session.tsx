'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { AddVolatileCardDialog } from '@/components/add-volatile-card-dialog'
import { startVolatileSession } from '@/app/actions/suggestions'
import { seededShuffle } from '@/lib/seeded-shuffle'
import type { VolatileCard } from '@/lib/types'

type Props = {
  theme: string
  count: number
  initialCards: VolatileCard[]
  initialSharedTags: string[]
}

type CardHistory = {
  wrongCount: number
  seen: boolean
}

export function VolatileReviewSession({
  theme,
  count,
  initialCards,
  initialSharedTags,
}: Props) {
  const [queue, setQueue] = useState<VolatileCard[]>(initialCards)
  const [allCards, setAllCards] = useState<VolatileCard[]>(initialCards)
  const [sharedTags, setSharedTags] = useState<string[]>(initialSharedTags)
  const [history, setHistory] = useState<Map<string, CardHistory>>(new Map())
  const [addedMap, setAddedMap] = useState<Map<string, string>>(new Map())
  const [reviewedCount, setReviewedCount] = useState(0)
  const [restarting, startRestart] = useTransition()

  const current = queue[0] ?? null

  const registerResult = useCallback((cardId: string, correct: boolean) => {
    setHistory((prev) => {
      const next = new Map(prev)
      const entry = next.get(cardId) ?? { wrongCount: 0, seen: false }
      next.set(cardId, {
        wrongCount: correct ? entry.wrongCount : entry.wrongCount + 1,
        seen: true,
      })
      return next
    })
  }, [])

  const advance = useCallback(
    (cardId: string, correct: boolean) => {
      setReviewedCount((n) => n + 1)
      registerResult(cardId, correct)
      setQueue((q) => {
        const [head, ...rest] = q
        if (!head) return q
        if (correct) return rest
        return [...rest, head]
      })
    },
    [registerResult],
  )

  const onAdded = useCallback((volatileId: string, persistedId: string) => {
    setAddedMap((prev) => {
      if (prev.has(volatileId)) return prev
      const next = new Map(prev)
      next.set(volatileId, persistedId)
      return next
    })
  }, [])

  const onRestart = useCallback(() => {
    startRestart(async () => {
      try {
        const missedIds = new Set(
          Array.from(history.entries())
            .filter(([, h]) => h.wrongCount > 0)
            .map(([id]) => id),
        )
        const keepCards = allCards.filter((c) => missedIds.has(c.id))
        const { cards, sharedTags: nextTags } = await startVolatileSession({
          theme,
          count,
          keepCards,
          previousSharedTags: sharedTags,
        })
        setQueue(cards)
        setAllCards(cards)
        setSharedTags(nextTags)
        setHistory(new Map())
        setAddedMap(new Map())
        setReviewedCount(0)
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Erreur au redémarrage',
        )
      }
    })
  }, [allCards, history, theme, count, sharedTags])

  const stats = useMemo(() => {
    let correct = 0
    let missed = 0
    for (const card of allCards) {
      const h = history.get(card.id)
      if (!h || !h.seen) continue
      if (h.wrongCount === 0) correct++
      else missed++
    }
    return { correct, missed, added: addedMap.size, total: allCards.length }
  }, [allCards, history, addedMap])

  if (!current) {
    return (
      <RecapScreen
        theme={theme}
        cards={allCards}
        history={history}
        addedMap={addedMap}
        sharedTags={sharedTags}
        stats={stats}
        restarting={restarting}
        onRestart={onRestart}
        onAdded={onAdded}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="truncate text-lg font-semibold">{theme}</h1>
        <div className="shrink-0 text-xs text-muted-foreground">
          {reviewedCount} vue{reviewedCount > 1 ? 's' : ''} · {queue.length}{' '}
          restante{queue.length > 1 ? 's' : ''}
        </div>
      </div>
      <VolatileQcmCard
        key={`${current.id}-${reviewedCount}`}
        card={current}
        theme={theme}
        sharedTags={sharedTags}
        alreadyAdded={addedMap.has(current.id)}
        onAdded={(persistedId) => onAdded(current.id, persistedId)}
        onResult={(correct) => advance(current.id, correct)}
      />
    </div>
  )
}

type RecapProps = {
  theme: string
  cards: VolatileCard[]
  history: Map<string, CardHistory>
  addedMap: Map<string, string>
  sharedTags: string[]
  stats: { correct: number; missed: number; added: number; total: number }
  restarting: boolean
  onRestart: () => void
  onAdded: (volatileId: string, persistedId: string) => void
}

function RecapScreen({
  theme,
  cards,
  history,
  addedMap,
  sharedTags,
  stats,
  restarting,
  onRestart,
  onAdded,
}: RecapProps) {
  const hasMissed = stats.missed > 0

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      <div className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Session terminée
        </p>
        <h1 className="text-2xl font-semibold leading-tight">{theme}</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Cartes" value={stats.total} />
        <StatTile label="Réussies" value={stats.correct} tone="positive" />
        <StatTile label="Ratées" value={stats.missed} tone="negative" />
        <StatTile label="Ajoutées" value={stats.added} tone="accent" />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
        <Link href="/" className={buttonVariants({ variant: 'outline' })}>
          Retour à l&apos;accueil
        </Link>
        {hasMissed && (
          <Button onClick={onRestart} disabled={restarting}>
            {restarting ? 'Génération…' : 'Recommencer'}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Cartes étudiées
        </h2>
        <ul className="space-y-2">
          {cards.map((c) => {
            const h = history.get(c.id)
            const missed = (h?.wrongCount ?? 0) > 0
            return (
              <li
                key={c.id}
                className="rounded-lg border p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      {missed ? (
                        <X className="size-3.5 shrink-0 text-red-600 dark:text-red-400" />
                      ) : (
                        <Check className="size-3.5 shrink-0 text-green-600 dark:text-green-400" />
                      )}
                      <span className="truncate font-medium">{c.term}</span>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {c.definition}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <AddVolatileCardDialog
                      card={c}
                      theme={theme}
                      suggestedTags={sharedTags}
                      alreadyAdded={addedMap.has(c.id)}
                      onAdded={(persistedId) => onAdded(c.id, persistedId)}
                    />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: 'positive' | 'negative' | 'accent'
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-green-700 dark:text-green-400'
      : tone === 'negative'
      ? 'text-red-700 dark:text-red-400'
      : tone === 'accent'
      ? 'text-blue-700 dark:text-blue-400'
      : 'text-foreground'
  return (
    <div className="rounded-lg border p-3 text-center">
      <div className={'text-2xl font-semibold tabular-nums ' + toneClass}>
        {value}
      </div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  )
}

function VolatileQcmCard({
  card,
  theme,
  sharedTags,
  alreadyAdded,
  onAdded,
  onResult,
}: {
  card: VolatileCard
  theme: string
  sharedTags: string[]
  alreadyAdded: boolean
  onAdded: (persistedId: string) => void
  onResult: (correct: boolean) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [choices] = useState(() =>
    seededShuffle([card.term, ...card.qcm_choices.distractors], card.id),
  )
  const correctTerm = card.term
  const revealed = selected !== null
  const isCorrect = selected === correctTerm

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Définition
        </p>
        <p className="mt-1 text-base leading-relaxed">{card.definition}</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          Quel est le terme ?
        </p>
        {choices.map((choice) => {
          const isThisCorrect = choice === correctTerm
          const isThisSelected = choice === selected
          let className =
            'w-full justify-start whitespace-normal h-auto min-h-[44px] py-3 text-left'
          if (revealed) {
            if (isThisCorrect) className += ' border-green-500 bg-green-500/10'
            else if (isThisSelected) className += ' border-red-500 bg-red-500/10'
          }
          return (
            <Button
              key={choice}
              variant="outline"
              className={className}
              disabled={revealed}
              onClick={() => setSelected(choice)}
            >
              {choice}
            </Button>
          )
        })}
      </div>

      {revealed && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {isCorrect
              ? 'Bien vu.'
              : 'Pas juste. La bonne réponse est en vert.'}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {!isCorrect ? (
              <AddVolatileCardDialog
                card={card}
                theme={theme}
                suggestedTags={sharedTags}
                alreadyAdded={alreadyAdded}
                onAdded={onAdded}
              />
            ) : (
              <span />
            )}
            <Button onClick={() => onResult(isCorrect)}>Continuer</Button>
          </div>
        </div>
      )}
    </div>
  )
}

