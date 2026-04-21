'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CardEditDialog } from '@/components/card-edit-dialog'
import { ImagePreview } from '@/components/image-preview'
import { ExplanationInfo } from '@/components/explanation-info'
import { seededShuffle } from '@/lib/seeded-shuffle'
import type { AnamneseCard, Rating } from '@/lib/types'
import { RatingButtons } from './rating-buttons'

type Props = {
  card: AnamneseCard
  onRate: (rating: Rating, responseText?: string) => Promise<void>
  onCardUpdated: (updated: AnamneseCard) => void
}

export function ReviewCardQcm({ card, onRate, onCardUpdated }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [correctTerm] = useState(card.term)
  const [choices] = useState(() =>
    seededShuffle([card.term, ...card.qcm_choices.distractors], card.id),
  )

  const revealed = selected !== null
  const isCorrect = selected === correctTerm

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
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {isCorrect
                ? 'Bien vu. Note ta confiance pour ajuster la prochaine révision.'
                : 'Pas juste. La bonne réponse est surlignée en vert.'}
            </p>
            <div className="flex shrink-0 items-center gap-1">
              {card.explanation && (
                <ExplanationInfo term={card.term} explanation={card.explanation} />
              )}
              <CardEditDialog card={card} onSaved={onCardUpdated}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Corriger la carte"
                >
                  <Pencil className="text-muted-foreground" />
                </Button>
              </CardEditDialog>
            </div>
          </div>
          <RatingButtons onRate={(rating) => onRate(rating)} />
        </div>
      )}
    </div>
  )
}

