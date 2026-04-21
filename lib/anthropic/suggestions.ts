import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { ANAMNESE_MODEL, getAnthropic } from './client'
import {
  THEME_SUGGEST_SYSTEM,
  THEME_SUGGEST_USER,
  type ProfileSummary,
} from './prompts/theme-suggest'
import type { SuggestedTheme } from '@/lib/types'

function buildSchema(count: number) {
  return z.object({
    themes: z
      .array(
        z.object({
          label: z.string().min(1).max(80),
          kind: z.enum(['deepen', 'related']),
          rationale: z.string().min(1).max(200),
        }),
      )
      .min(count)
      .max(count),
  })
}

export async function suggestThemes(params: {
  profile: ProfileSummary
  count?: number
  excludeLabels?: string[]
}): Promise<SuggestedTheme[]> {
  const count = Math.max(1, Math.min(6, params.count ?? 6))
  const client = getAnthropic()
  const response = await client.messages.parse({
    model: ANAMNESE_MODEL,
    max_tokens: 800,
    system: [
      {
        type: 'text',
        text: THEME_SUGGEST_SYSTEM,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: THEME_SUGGEST_USER({
          profile: params.profile,
          count,
          excludeLabels: params.excludeLabels,
        }),
      },
    ],
    output_config: { format: zodOutputFormat(buildSchema(count)) },
  })
  if (!response.parsed_output) {
    throw new Error("Claude n'a pas produit une sortie structurée valide.")
  }
  return response.parsed_output.themes
}

export type { ProfileSummary }
