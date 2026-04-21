import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { ANAMNESE_MODEL, getAnthropic } from './client'
import {
  VOLATILE_CARDS_SYSTEM,
  VOLATILE_CARDS_USER,
} from './prompts/volatile-cards'
import type { ProfileSummary } from './prompts/theme-suggest'

const VolatileCardsSchema = z.object({
  sharedTags: z.array(z.string().min(1).max(40)).min(2).max(5),
  cards: z
    .array(
      z.object({
        term: z.string().min(1).max(80),
        definition: z.string().min(1).max(500),
        distractors: z.array(z.string().min(1).max(80)).min(3).max(6),
      }),
    )
    .min(1)
    .max(30),
})

export interface GeneratedVolatileCard {
  term: string
  definition: string
  distractors: [string, string, string]
}

export interface GeneratedVolatileBatch {
  sharedTags: string[]
  cards: GeneratedVolatileCard[]
}

export async function generateVolatileCards(params: {
  theme: string
  count: number
  profile: ProfileSummary | null
  excludeTerms: string[]
  existingTags: string[]
}): Promise<GeneratedVolatileBatch> {
  const safeCount = Math.max(1, Math.min(30, Math.trunc(params.count)))
  const client = getAnthropic()
  const maxTokens = Math.min(8000, 400 + safeCount * 300)

  const response = await client.messages.parse({
    model: ANAMNESE_MODEL,
    max_tokens: maxTokens,
    system: [
      {
        type: 'text',
        text: VOLATILE_CARDS_SYSTEM,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: VOLATILE_CARDS_USER({ ...params, count: safeCount }),
      },
    ],
    output_config: { format: zodOutputFormat(VolatileCardsSchema) },
  })

  if (!response.parsed_output) {
    throw new Error("Claude n'a pas produit une sortie structurée valide.")
  }
  const cards = response.parsed_output.cards.map((c) => {
    const deduped = dedupeKeepOrder(c.distractors, c.term)
    const [d0, d1, d2] = padDistractors(deduped)
    return {
      term: c.term,
      definition: c.definition,
      distractors: [d0, d1, d2] as [string, string, string],
    }
  })
  const sharedTags = normalizeTags(response.parsed_output.sharedTags)
  return { cards, sharedTags }
}

function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags) {
    const t = raw.trim().toLowerCase()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
    if (out.length >= 5) break
  }
  return out
}

function dedupeKeepOrder(distractors: string[], correctTerm: string): string[] {
  const seen = new Set<string>([correctTerm.trim().toLowerCase()])
  const out: string[] = []
  for (const d of distractors) {
    const key = d.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(d.trim())
  }
  return out
}

function padDistractors(distractors: string[]): string[] {
  if (distractors.length >= 3) return distractors.slice(0, 3)
  const padded = [...distractors]
  const generic = ['Aucune de ces réponses', 'Autre proposition', 'Proposition alternative']
  let i = 0
  while (padded.length < 3 && i < generic.length) {
    if (!padded.includes(generic[i])) padded.push(generic[i])
    i++
  }
  return padded
}
