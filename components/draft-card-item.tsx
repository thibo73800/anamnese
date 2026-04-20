'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ImagePreview } from '@/components/image-preview'
import { findImageForDraft } from '@/app/actions/batch-create'
import type { DraftCard, ImageHit } from '@/lib/types'

type Props = {
  card: DraftCard
  index: number
  onChange: (patch: Partial<Omit<DraftCard, 'localId'>>) => void
  onDelete: () => void
}

export function DraftCardItem({ card, index, onChange, onDelete }: Props) {
  const [pending, startTransition] = useTransition()

  const syncDistractor = (i: 0 | 1 | 2, value: string) => {
    const next: [string, string, string] = [...card.distractors]
    next[i] = value
    onChange({ distractors: next })
  }

  const onSearchImage = () => {
    const query = card.term.trim()
    if (!query) {
      toast.error('Renseigne un terme pour chercher une image')
      return
    }
    startTransition(async () => {
      try {
        const hit = await findImageForDraft({ query })
        if (!hit) {
          toast.error('Aucune image trouvée')
          return
        }
        onChange({ image: hit })
        toast.success('Image ajoutée')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erreur image')
      }
    })
  }

  const onRemoveImage = () => onChange({ image: null })

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Carte {index + 1}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={onDelete}
          className="text-destructive"
        >
          Supprimer
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`term-${card.localId}`} className="text-xs">
          Terme
        </Label>
        <Input
          id={`term-${card.localId}`}
          value={card.term}
          onChange={(e) => onChange({ term: e.target.value })}
          maxLength={120}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`def-${card.localId}`} className="text-xs">
          Définition
        </Label>
        <Textarea
          id={`def-${card.localId}`}
          value={card.definition}
          onChange={(e) => onChange({ definition: e.target.value })}
          maxLength={600}
          rows={3}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Image</Label>
        {card.image ? (
          <div className="space-y-1.5">
            <ImagePreview
              url={card.image.url}
              alt={card.term}
              attribution={card.image.attribution}
              heightClass="h-32"
            />
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onRemoveImage}
            >
              Retirer l&apos;image
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSearchImage}
            disabled={pending}
          >
            {pending ? 'Recherche…' : 'Chercher une image'}
          </Button>
        )}
      </div>

      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">
          Distracteurs QCM
        </summary>
        <div className="mt-2 space-y-1.5">
          {card.distractors.map((val, i) => (
            <Input
              key={i}
              value={val}
              onChange={(e) =>
                syncDistractor(i as 0 | 1 | 2, e.target.value)
              }
              maxLength={80}
              placeholder={`Distracteur ${i + 1}`}
            />
          ))}
        </div>
      </details>
    </div>
  )
}

export function emptyDraftCard(): DraftCard {
  return {
    localId: crypto.randomUUID(),
    term: '',
    definition: '',
    distractors: ['', '', ''],
    image: null as ImageHit | null,
  }
}
