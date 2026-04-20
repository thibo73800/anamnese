'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ImagePreview } from '@/components/image-preview'
import {
  createCard,
  updateCard,
  type CreateCardInput,
} from '@/app/actions/cards'
import type { ImageSource } from '@/lib/types'

type Mode =
  | { kind: 'create' }
  | { kind: 'edit'; cardId: string }

type Props = {
  initial: CreateCardInput
  mode?: Mode
}

export function CardEditor({ initial, mode = { kind: 'create' } }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [term, setTerm] = useState(initial.term)
  const [definition, setDefinition] = useState(initial.definition)
  const [tags, setTags] = useState<string[]>(initial.tags)
  const [tagDraft, setTagDraft] = useState('')
  const [distractors] = useState(initial.distractors)

  const [imageUrl, setImageUrl] = useState<string | null>(initial.image_url)
  const [imageSource, setImageSource] = useState<ImageSource | null>(
    initial.image_source,
  )
  const [imageAttribution, setImageAttribution] = useState<string | null>(
    initial.image_attribution,
  )
  const [customUrlDraft, setCustomUrlDraft] = useState('')
  const autoImage = initial.image_url
  const isCustom = imageUrl !== null && imageUrl !== autoImage

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

  const restoreAuto = () => {
    setImageUrl(initial.image_url)
    setImageSource(initial.image_source)
    setImageAttribution(initial.image_attribution)
    setCustomUrlDraft('')
  }

  const onSubmit = () => {
    startTransition(async () => {
      try {
        const payload = {
          term,
          definition,
          tags,
          theme: initial.theme,
          distractors,
          image_url: imageUrl,
          image_source: imageSource,
          image_attribution: imageAttribution,
          explanation: initial.explanation,
        }
        if (mode.kind === 'edit') {
          await updateCard(mode.cardId, payload)
          toast.success('Carte modifiée')
        } else {
          await createCard(payload)
          toast.success('Carte créée')
        }
        router.push('/cards')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erreur inconnue')
      }
    })
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {mode.kind === 'edit' ? 'Modifier la carte' : 'Nouvelle carte'}
        </p>
        <p className="text-sm text-muted-foreground">
          {mode.kind === 'edit'
            ? 'Ajuste les champs puis enregistre.'
            : 'Édite si besoin, puis valide pour ajouter à ton deck.'}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="term">Terme</Label>
        <Input
          id="term"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          maxLength={120}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="definition">Définition</Label>
        <Textarea
          id="definition"
          value={definition}
          onChange={(e) => setDefinition(e.target.value)}
          maxLength={600}
          rows={4}
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
              heightClass="h-48"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={removeImage}
              >
                Retirer l&apos;image
              </Button>
              {autoImage && isCustom && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={restoreAuto}
                >
                  Restaurer l&apos;image auto
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
            disabled={!customUrlDraft.trim()}
          >
            {imageUrl ? 'Remplacer' : 'Ajouter'}
          </Button>
        </div>
        {!imageUrl && autoImage && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={restoreAuto}
          >
            Restaurer l&apos;image auto
          </Button>
        )}
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
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTag()
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addTag}>
            +
          </Button>
        </div>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          Distracteurs QCM générés ({distractors.length})
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          {distractors.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      </details>

      <Button onClick={onSubmit} disabled={pending} className="w-full">
        {pending
          ? mode.kind === 'edit'
            ? 'Enregistrement…'
            : 'Création…'
          : mode.kind === 'edit'
            ? 'Enregistrer'
            : 'Créer la carte'}
      </Button>
    </div>
  )
}
