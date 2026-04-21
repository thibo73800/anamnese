'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createCard } from '@/app/actions/cards'
import type { VolatileCard } from '@/lib/types'

type Props = {
  card: VolatileCard
  theme: string
  suggestedTags: string[]
  onAdded: (persistedCardId: string) => void
  alreadyAdded: boolean
  triggerSize?: 'sm' | 'default'
  triggerVariant?: 'outline' | 'default' | 'ghost'
  triggerLabel?: string
}

export function AddVolatileCardDialog({
  card,
  theme,
  suggestedTags,
  onAdded,
  alreadyAdded,
  triggerSize = 'sm',
  triggerVariant = 'outline',
  triggerLabel,
}: Props) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState(card.term)
  const [definition, setDefinition] = useState(card.definition)
  const [distractor0, setDistractor0] = useState(card.qcm_choices.distractors[0])
  const [distractor1, setDistractor1] = useState(card.qcm_choices.distractors[1])
  const [distractor2, setDistractor2] = useState(card.qcm_choices.distractors[2])
  const [tagsInput, setTagsInput] = useState(suggestedTags.join(', '))
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setTerm(card.term)
    setDefinition(card.definition)
    setDistractor0(card.qcm_choices.distractors[0])
    setDistractor1(card.qcm_choices.distractors[1])
    setDistractor2(card.qcm_choices.distractors[2])
    setTagsInput(suggestedTags.join(', '))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .slice(0, 8)
      const { id } = await createCard({
        term: term.trim(),
        definition: definition.trim(),
        tags,
        theme,
        distractors: [distractor0.trim(), distractor1.trim(), distractor2.trim()],
        image_url: null,
        image_source: null,
        image_attribution: null,
        explanation: null,
      })
      toast.success('Carte ajoutée au deck')
      onAdded(id)
      setOpen(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Impossible d'ajouter la carte",
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (alreadyAdded) {
    return (
      <Button variant="ghost" size={triggerSize} disabled type="button">
        Ajoutée
      </Button>
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) reset()
      }}
    >
      <DialogTrigger
        render={
          <Button variant={triggerVariant} size={triggerSize} type="button" />
        }
      >
        {triggerLabel ?? (
          <>
            <Plus className="size-3.5" />
            Ajouter au deck
          </>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter cette carte au deck</DialogTitle>
          <DialogDescription>
            La carte sera intégrée au cycle FSRS normal. Tu peux ajuster avant
            de valider.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="avcd-term">Terme</Label>
            <Input
              id="avcd-term"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              maxLength={120}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="avcd-def">Définition</Label>
            <Textarea
              id="avcd-def"
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              maxLength={600}
              rows={3}
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Distracteurs</Label>
            <div className="space-y-1">
              <Input
                value={distractor0}
                onChange={(e) => setDistractor0(e.target.value)}
                maxLength={80}
                required
              />
              <Input
                value={distractor1}
                onChange={(e) => setDistractor1(e.target.value)}
                maxLength={80}
                required
              />
              <Input
                value={distractor2}
                onChange={(e) => setDistractor2(e.target.value)}
                maxLength={80}
                required
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="avcd-tags">Tags</Label>
            <Input
              id="avcd-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="histoire, renaissance"
            />
            <p className="text-xs text-muted-foreground">
              Séparés par des virgules.{' '}
              {suggestedTags.length > 0
                ? `Suggérés : ${suggestedTags.join(', ')}.`
                : ''}
            </p>
          </div>
          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" type="button" disabled={submitting} />
              }
            >
              Annuler
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Ajout…' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
