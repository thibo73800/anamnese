'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
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
import { ImagePreview } from '@/components/image-preview'
import { updateCard } from '@/app/actions/cards'
import type { AnamneseCard, ImageSource } from '@/lib/types'

type Props = {
  card: AnamneseCard
  onSaved?: (updated: AnamneseCard) => void
  children: ReactNode
}

export function CardEditDialog({ card, onSaved, children }: Props) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const [term, setTerm] = useState(card.term)
  const [definition, setDefinition] = useState(card.definition)
  const [explanation, setExplanation] = useState(card.explanation ?? '')
  const [tags, setTags] = useState<string[]>(card.tags)
  const [tagDraft, setTagDraft] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(card.image_url)
  const [imageSource, setImageSource] = useState<ImageSource | null>(
    card.image_source,
  )
  const [imageAttribution, setImageAttribution] = useState<string | null>(
    card.image_attribution,
  )
  const [customUrlDraft, setCustomUrlDraft] = useState('')
  const initialDistractors = card.qcm_choices.distractors
  const [d0, setD0] = useState(initialDistractors[0] ?? '')
  const [d1, setD1] = useState(initialDistractors[1] ?? '')
  const [d2, setD2] = useState(initialDistractors[2] ?? '')

  const resetFromCard = () => {
    setTerm(card.term)
    setDefinition(card.definition)
    setExplanation(card.explanation ?? '')
    setTags(card.tags)
    setTagDraft('')
    setImageUrl(card.image_url)
    setImageSource(card.image_source)
    setImageAttribution(card.image_attribution)
    setCustomUrlDraft('')
    setD0(card.qcm_choices.distractors[0] ?? '')
    setD1(card.qcm_choices.distractors[1] ?? '')
    setD2(card.qcm_choices.distractors[2] ?? '')
  }

  const handleOpenChange = (next: boolean) => {
    if (next) resetFromCard()
    setOpen(next)
  }

  const addTag = () => {
    const t = tagDraft.trim().toLowerCase()
    if (!t || tags.includes(t)) return
    setTags([...tags, t])
    setTagDraft('')
  }
  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t))

  const removeImage = () => {
    setImageUrl(null)
    setImageSource(null)
    setImageAttribution(null)
    setCustomUrlDraft('')
  }

  const applyCustomUrl = () => {
    const url = customUrlDraft.trim()
    if (!url) return
    try {
      new URL(url)
    } catch {
      toast.error('URL invalide')
      return
    }
    setImageUrl(url)
    setImageSource(null)
    setImageAttribution(null)
    setCustomUrlDraft('')
  }

  const onSubmit = () => {
    const trimmedTerm = term.trim()
    const trimmedDef = definition.trim()
    const distractors: [string, string, string] = [
      d0.trim(),
      d1.trim(),
      d2.trim(),
    ]

    if (!trimmedTerm) {
      toast.error('Le terme ne peut pas être vide')
      return
    }
    if (!trimmedDef) {
      toast.error('La définition ne peut pas être vide')
      return
    }
    if (distractors.some((d) => !d)) {
      toast.error('Les 3 distracteurs doivent être renseignés')
      return
    }
    const termLower = trimmedTerm.toLowerCase()
    if (distractors.some((d) => d.toLowerCase() === termLower)) {
      toast.error('Un distracteur ne peut pas être identique au terme')
      return
    }
    const lowered = distractors.map((d) => d.toLowerCase())
    if (new Set(lowered).size !== 3) {
      toast.error('Les distracteurs doivent être différents entre eux')
      return
    }

    const trimmedExplanation = explanation.trim()
    const payload = {
      term: trimmedTerm,
      definition: trimmedDef,
      tags,
      distractors,
      image_url: imageUrl,
      image_source: imageSource,
      image_attribution: imageAttribution,
      explanation: trimmedExplanation.length > 0 ? trimmedExplanation : null,
    }

    startTransition(async () => {
      try {
        await updateCard(card.id, payload)
        const updated: AnamneseCard = {
          ...card,
          term: payload.term,
          definition: payload.definition,
          tags: payload.tags,
          image_url: payload.image_url,
          image_source: payload.image_source,
          image_attribution: payload.image_attribution,
          explanation: payload.explanation,
          qcm_choices: { distractors },
        }
        onSaved?.(updated)
        setOpen(false)
        toast.success('Carte modifiée')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erreur inconnue')
      }
    })
  }

  const autoImage = card.image_url
  const isCustom = imageUrl !== null && imageUrl !== autoImage

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="max-w-[min(95vw,640px)] sm:max-w-[min(95vw,640px)]">
        <DialogHeader>
          <DialogTitle>Modifier la carte</DialogTitle>
          <DialogDescription className="sr-only">
            Ajuste les champs puis enregistre.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label htmlFor="edit-term">Terme</Label>
            <Input
              id="edit-term"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              maxLength={120}
              disabled={pending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-definition">Définition</Label>
            <Textarea
              id="edit-definition"
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              maxLength={600}
              rows={4}
              disabled={pending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-explanation">Explication</Label>
            <Textarea
              id="edit-explanation"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              maxLength={4000}
              rows={8}
              disabled={pending}
              placeholder="Markdown accepté. Laisser vide pour retirer."
            />
          </div>

          <div className="space-y-2">
            <Label>Distracteurs QCM</Label>
            <p className="text-xs text-muted-foreground">
              3 termes proches mais faux. Différents du terme et entre eux.
            </p>
            <Input
              value={d0}
              onChange={(e) => setD0(e.target.value)}
              maxLength={80}
              disabled={pending}
              aria-label="Distracteur 1"
            />
            <Input
              value={d1}
              onChange={(e) => setD1(e.target.value)}
              maxLength={80}
              disabled={pending}
              aria-label="Distracteur 2"
            />
            <Input
              value={d2}
              onChange={(e) => setD2(e.target.value)}
              maxLength={80}
              disabled={pending}
              aria-label="Distracteur 3"
            />
          </div>

          <div className="space-y-2">
            <Label>Image</Label>
            {imageUrl ? (
              <div className="space-y-2">
                <ImagePreview
                  url={imageUrl}
                  alt={term}
                  attribution={imageAttribution}
                  heightClass="h-40"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={removeImage}
                    disabled={pending}
                  >
                    Retirer l&apos;image
                  </Button>
                  {autoImage && isCustom && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setImageUrl(autoImage)
                        setImageSource(card.image_source)
                        setImageAttribution(card.image_attribution)
                        setCustomUrlDraft('')
                      }}
                      disabled={pending}
                    >
                      Restaurer l&apos;image d&apos;origine
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucune image associée.
              </p>
            )}
            <div className="flex gap-2">
              <Input
                type="url"
                value={customUrlDraft}
                onChange={(e) => setCustomUrlDraft(e.target.value)}
                placeholder="Coller une URL d'image…"
                disabled={pending}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    applyCustomUrl()
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={applyCustomUrl}
                disabled={pending || !customUrlDraft.trim()}
              >
                {imageUrl ? 'Remplacer' : 'Ajouter'}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <Badge
                  key={t}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => removeTag(t)}
                >
                  {t} ×
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                placeholder="Ajouter un tag…"
                disabled={pending}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag()
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={addTag}
                disabled={pending}
              >
                +
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Annuler
          </Button>
          <Button onClick={onSubmit} disabled={pending}>
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
