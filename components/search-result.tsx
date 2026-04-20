'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ThemeExplanation } from '@/components/theme-explanation'
import { CardEditor } from '@/components/card-editor'
import { refineThemeExplanation } from '@/app/actions/theme'
import type { CreateCardInput } from '@/app/actions/cards'

type Props = {
  theme: string
  initialExplanation: string
  cardInitial: CreateCardInput
}

export function SearchResult({ theme, initialExplanation, cardInitial }: Props) {
  const [explanation, setExplanation] = useState(initialExplanation)
  const [question, setQuestion] = useState('')
  const [pending, startTransition] = useTransition()

  const onAsk = () => {
    const q = question.trim()
    if (!q) return
    startTransition(async () => {
      try {
        const refined = await refineThemeExplanation({
          theme,
          currentExplanation: explanation,
          question: q,
        })
        setExplanation(refined)
        setQuestion('')
        toast.success('Explication enrichie')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erreur')
      }
    })
  }

  return (
    <div className="space-y-6">
      <ThemeExplanation theme={theme} explanation={explanation} />

      <div className="space-y-2 rounded-lg border border-dashed p-3">
        <label
          htmlFor="followup"
          className="text-xs uppercase tracking-wide text-muted-foreground"
        >
          Une question sur ce concept ?
        </label>
        <div className="flex gap-2">
          <Input
            id="followup"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Pose une question pour approfondir ou clarifier…"
            disabled={pending}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onAsk()
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={onAsk}
            disabled={pending || !question.trim()}
          >
            {pending ? 'En cours…' : 'Poser'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          L&apos;explication au-dessus sera enrichie pour intégrer la réponse.
        </p>
      </div>

      <CardEditor
        initial={{ ...cardInitial, explanation }}
      />
    </div>
  )
}
