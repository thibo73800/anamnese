'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Markdown } from '@/components/markdown'
import {
  DraftCardItem,
  emptyDraftCard,
} from '@/components/draft-card-item'
import {
  commitSet,
  sendBatchMessage,
} from '@/app/actions/batch-create'
import type { DisplayMessage, DraftCard } from '@/lib/types'

export function BatchCreator() {
  const router = useRouter()
  const [chatPending, startChat] = useTransition()
  const [commitPending, startCommit] = useTransition()

  const [history, setHistory] = useState<DisplayMessage[]>([])
  const [draftCards, setDraftCards] = useState<DraftCard[]>([])
  const [sharedTags, setSharedTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  const [userInput, setUserInput] = useState('')

  const theme = useMemo(() => {
    const first = history.find((m) => m.role === 'user')
    return first?.text.trim() ?? ''
  }, [history])

  const onSend = () => {
    const userText = userInput.trim()
    if (!userText) return
    startChat(async () => {
      try {
        const next = await sendBatchMessage({
          history,
          userText,
          draftCards,
          sharedTags,
        })
        setHistory(next.history)
        setDraftCards(next.draftCards)
        setSharedTags(next.sharedTags)
        setUserInput('')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erreur Claude')
      }
    })
  }

  const patchCard = (
    localId: string,
    patch: Partial<Omit<DraftCard, 'localId'>>,
  ) => {
    setDraftCards((cards) =>
      cards.map((c) => (c.localId === localId ? { ...c, ...patch } : c)),
    )
  }

  const removeCard = (localId: string) => {
    setDraftCards((cards) => cards.filter((c) => c.localId !== localId))
  }

  const addEmptyCard = () => {
    setDraftCards((cards) => [...cards, emptyDraftCard()])
  }

  const addTag = () => {
    const t = tagDraft.trim().toLowerCase()
    if (!t || sharedTags.includes(t) || sharedTags.length >= 8) {
      setTagDraft('')
      return
    }
    setSharedTags([...sharedTags, t])
    setTagDraft('')
  }

  const removeTag = (t: string) => {
    setSharedTags(sharedTags.filter((x) => x !== t))
  }

  const validateDraft = (): string | null => {
    if (draftCards.length === 0) return 'Aucune carte dans le set'
    for (const c of draftCards) {
      if (!c.term.trim()) return `Une carte n'a pas de terme`
      if (!c.definition.trim()) return `La carte "${c.term}" n'a pas de définition`
      if (c.distractors.some((d) => !d.trim()))
        return `La carte "${c.term}" a des distracteurs vides`
    }
    return null
  }

  const onCommit = () => {
    const err = validateDraft()
    if (err) {
      toast.error(err)
      return
    }
    const effectiveTheme = theme || draftCards[0].term
    startCommit(async () => {
      try {
        const res = await commitSet({
          theme: effectiveTheme,
          sharedTags,
          cards: draftCards,
        })
        toast.success(`${res.ids.length} carte(s) ajoutée(s) au deck`)
        if (res.firstTag) {
          router.push(`/cards?tag=${encodeURIComponent(res.firstTag)}`)
        } else {
          router.push('/cards')
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erreur commit')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Créer un set de cartes</h1>
        <p className="text-sm text-muted-foreground">
          Dialogue avec Claude pour constituer un ensemble cohérent sur un
          thème. Tu peux éditer, supprimer ou ajouter des cartes avant de
          valider.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="space-y-3 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Conversation
            </p>
            {theme && (
              <p className="text-xs text-muted-foreground">
                Thème : <span className="font-medium">{theme}</span>
              </p>
            )}
          </div>

          <div className="max-h-[60vh] min-h-[200px] space-y-3 overflow-y-auto rounded-md bg-muted/30 p-3">
            {history.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Décris le thème : <em>&quot;La Révolution française&quot;</em>,{' '}
                <em>&quot;La photosynthèse&quot;</em>,{' '}
                <em>&quot;Les mouvements de la peinture moderne&quot;</em>…
                Claude te proposera un set initial de cartes et des tags.
              </p>
            )}
            {history.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === 'user'
                    ? 'rounded-md bg-background p-2 text-sm'
                    : 'rounded-md bg-primary/5 p-2 text-sm'
                }
              >
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {m.role === 'user' ? 'Toi' : 'Claude'}
                </p>
                {m.role === 'assistant' ? (
                  <Markdown>{m.text}</Markdown>
                ) : (
                  <p className="whitespace-pre-wrap">{m.text}</p>
                )}
              </div>
            ))}
            {chatPending && (
              <p className="text-sm italic text-muted-foreground">
                Claude réfléchit…
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="batch-input" className="sr-only">
              Message
            </Label>
            <Textarea
              id="batch-input"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder={
                history.length === 0
                  ? 'Propose un thème ou des consignes…'
                  : 'Ajoute, édite, supprime, reformule…'
              }
              disabled={chatPending}
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  onSend()
                }
              }}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                ⌘/Ctrl + Entrée pour envoyer
              </p>
              <Button
                type="button"
                onClick={onSend}
                disabled={chatPending || !userInput.trim()}
              >
                {chatPending ? 'Envoi…' : 'Envoyer'}
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-3 rounded-lg border p-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Set en cours ({draftCards.length} carte
              {draftCards.length > 1 ? 's' : ''})
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Tags partagés</Label>
            <div className="flex flex-wrap gap-1.5">
              {sharedTags.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  Aucun tag pour le moment.
                </span>
              )}
              {sharedTags.map((t) => (
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
              <Button
                type="button"
                variant="outline"
                onClick={addTag}
                disabled={sharedTags.length >= 8}
              >
                +
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {draftCards.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Les cartes proposées par Claude apparaîtront ici.
              </p>
            ) : (
              draftCards.map((card, i) => (
                <DraftCardItem
                  key={card.localId}
                  card={card}
                  index={i}
                  onChange={(patch) => patchCard(card.localId, patch)}
                  onDelete={() => removeCard(card.localId)}
                />
              ))
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addEmptyCard}
              className="w-full"
            >
              + Ajouter une carte manuellement
            </Button>
          </div>

          <Button
            type="button"
            onClick={onCommit}
            disabled={commitPending || draftCards.length === 0}
            className="w-full"
          >
            {commitPending
              ? 'Ajout…'
              : `Ajouter ${draftCards.length} carte${draftCards.length > 1 ? 's' : ''} au deck`}
          </Button>
        </section>
      </div>
    </div>
  )
}
