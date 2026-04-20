'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ImagePreview } from '@/components/image-preview'
import { ExplanationInfo } from '@/components/explanation-info'
import type { AnamneseCard, Rating } from '@/lib/types'
import { RatingButtons } from './rating-buttons'

type Props = {
  card: AnamneseCard
  onRate: (rating: Rating, responseText?: string) => Promise<void>
}

export function ReviewCardTyping({ card, onRate }: Props) {
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Définition</p>
        <p className="mt-1 text-base leading-relaxed">{card.definition}</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="answer">
          Quel est le terme ?
        </label>
        <Textarea
          id="answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={2}
          disabled={revealed}
          placeholder="Tape le terme…"
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {!revealed ? (
        <Button onClick={() => setRevealed(true)} className="w-full">
          Révéler la réponse
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/40 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Terme</p>
                <p className="mt-1 text-xl font-semibold">{card.term}</p>
              </div>
              {card.explanation && (
                <ExplanationInfo term={card.term} explanation={card.explanation} />
              )}
            </div>
            {card.image_url && (
              <div className="mt-3">
                <ImagePreview
                  url={card.image_url}
                  alt={card.term}
                  attribution={card.image_attribution}
                  heightClass="h-48"
                />
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Évalue ta mémorisation:
          </p>
          <RatingButtons onRate={(rating) => onRate(rating, answer)} />
        </div>
      )}
    </div>
  )
}
