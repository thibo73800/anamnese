'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ImagePreview } from '@/components/image-preview'
import { ExplanationInfo } from '@/components/explanation-info'
import type { AnamneseCard, Rating } from '@/lib/types'
import { RatingButtons } from './rating-buttons'

type Props = {
  card: AnamneseCard
  onRate: (rating: Rating, responseText?: string) => Promise<void>
}

export function ReviewCardQcm({ card, onRate }: Props) {
  const [selected, setSelected] = useState<string | null>(null)

  const choices = useMemo(() => {
    const arr = [card.term, ...card.qcm_choices.distractors]
    return shuffle(arr, card.id)
  }, [card])

  const revealed = selected !== null
  const isCorrect = selected === card.term

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Définition</p>
        <p className="mt-1 text-base leading-relaxed">{card.definition}</p>
        {card.image_url && (
          <div className="mt-3">
            <ImagePreview
              url={card.image_url}
              alt=""
              attribution={card.image_attribution}
              heightClass="h-48"
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Quel est le terme ?</p>
        {choices.map((choice) => {
          const isThisCorrect = choice === card.term
          const isThisSelected = choice === selected
          let className = 'w-full justify-start whitespace-normal h-auto py-3 text-left'
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
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {isCorrect
                ? 'Bien vu. Note ta confiance pour ajuster la prochaine révision.'
                : 'Pas juste. La bonne réponse est surlignée en vert.'}
            </p>
            {card.explanation && (
              <ExplanationInfo term={card.term} explanation={card.explanation} />
            )}
          </div>
          <RatingButtons onRate={(rating) => onRate(rating)} />
        </div>
      )}
    </div>
  )
}

function shuffle<T>(arr: T[], seed: string): T[] {
  const rng = mulberry32(hash(seed))
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
