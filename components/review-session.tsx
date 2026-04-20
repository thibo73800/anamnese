'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { buttonVariants } from '@/components/ui/button'
import { ReviewCardQcm } from '@/components/review-card-qcm'
import { ReviewCardTyping } from '@/components/review-card-typing'
import {
  getDueCardsExcluding,
  submitReview,
} from '@/app/actions/cards'
import { deriveMode } from '@/lib/fsrs/mode'
import type { AnamneseCard, Rating } from '@/lib/types'

const PREFETCH_THRESHOLD = 3
const PREFETCH_BATCH = 10
const AGAIN_RATING: Rating = 1

type Props = {
  initialCards: AnamneseCard[]
}

export function ReviewSession({ initialCards }: Props) {
  const [queue, setQueue] = useState<AnamneseCard[]>(initialCards)
  const [reviewedCount, setReviewedCount] = useState(0)
  const [exhausted, setExhausted] = useState(
    initialCards.length < PREFETCH_BATCH,
  )
  const fetchingRef = useRef(false)
  const seenRef = useRef<Set<string>>(
    new Set(initialCards.map((c) => c.id)),
  )

  const current = queue[0] ?? null

  const refetchMore = useCallback(async () => {
    if (fetchingRef.current || exhausted) return
    fetchingRef.current = true
    try {
      const more = await getDueCardsExcluding(
        Array.from(seenRef.current),
        PREFETCH_BATCH,
      )
      if (more.length === 0) {
        setExhausted(true)
        return
      }
      for (const c of more) seenRef.current.add(c.id)
      if (more.length < PREFETCH_BATCH) setExhausted(true)
      setQueue((q) => [...q, ...more])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      fetchingRef.current = false
    }
  }, [exhausted])

  const onRate = useCallback(
    async (rating: Rating, responseText?: string) => {
      const card = queue[0]
      if (!card) return

      const projectedLength = queue.length - 1
      setQueue((q) => q.slice(1))
      setReviewedCount((n) => n + 1)

      if (projectedLength <= PREFETCH_THRESHOLD && !exhausted) {
        void refetchMore()
      }

      submitReview({ cardId: card.id, rating, responseText })
        .then(({ nextCard }) => {
          if (rating === AGAIN_RATING) {
            setQueue((q) => [...q, nextCard])
          }
        })
        .catch((err) => {
          toast.error(
            err instanceof Error
              ? err.message
              : 'Erreur lors de la sauvegarde',
          )
        })
    },
    [queue, exhausted, refetchMore],
  )

  const headerStats = useMemo(() => {
    return `${reviewedCount} révisée${reviewedCount > 1 ? 's' : ''} · ${queue.length} en file`
  }, [queue.length, reviewedCount])

  if (!current) {
    return (
      <div className="space-y-4 pt-10 text-center">
        <h1 className="text-2xl font-semibold">Session terminée</h1>
        <p className="text-muted-foreground">
          {reviewedCount > 0
            ? `Tu as révisé ${reviewedCount} carte${reviewedCount > 1 ? 's' : ''}. Plus rien à faire pour l'instant.`
            : "Aucune carte à réviser pour l'instant. Reviens plus tard."}
        </p>
        <div className="flex justify-center gap-2">
          <Link href="/cards" className={buttonVariants({ variant: 'outline' })}>
            Mes cartes
          </Link>
          <Link href="/create" className={buttonVariants()}>
            + Nouveau set
          </Link>
        </div>
      </div>
    )
  }

  const mode = deriveMode(current.fsrs_state)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Révision</h1>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{headerStats}</span>
          <span>·</span>
          <span>Mode {mode === 'typing' ? 'saisie' : 'QCM'}</span>
        </div>
      </div>
      {mode === 'qcm' ? (
        <ReviewCardQcm key={current.id} card={current} onRate={onRate} />
      ) : (
        <ReviewCardTyping key={current.id} card={current} onRate={onRate} />
      )}
    </div>
  )
}
