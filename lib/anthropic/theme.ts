import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { ANAMNESE_MODEL, getAnthropic } from './client'
import { THEME_EXPLAIN_SYSTEM, THEME_EXPLAIN_USER } from './prompts/theme-explain'
import {
  THEME_REFINE_SYSTEM,
  THEME_REFINE_USER,
} from './prompts/theme-refine'

const ThemeExplanationSchema = z.object({
  explanation: z.string(),
  needsImage: z.boolean(),
  imageQuery: z.string().nullable(),
  card: z.object({
    term: z.string().max(80),
    definition: z.string(),
    suggestedTags: z.array(z.string()).min(1).max(2),
    distractors: z.array(z.string()).length(3),
  }),
})

export type ThemeExplanation = z.infer<typeof ThemeExplanationSchema>

const RefinedExplanationSchema = z.object({
  explanation: z.string(),
})

export async function refineExplanation(params: {
  theme: string
  currentExplanation: string
  question: string
}): Promise<string> {
  const client = getAnthropic()
  const response = await client.messages.parse({
    model: ANAMNESE_MODEL,
    max_tokens: 2000,
    system: [
      {
        type: 'text',
        text: THEME_REFINE_SYSTEM,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: THEME_REFINE_USER(params),
      },
    ],
    output_config: { format: zodOutputFormat(RefinedExplanationSchema) },
  })
  if (!response.parsed_output) {
    throw new Error("Claude n'a pas produit une sortie structurée valide.")
  }
  return response.parsed_output.explanation
}

export async function explainTheme(
  theme: string,
  existingTags: string[],
): Promise<ThemeExplanation> {
  const client = getAnthropic()

  const response = await client.messages.parse({
    model: ANAMNESE_MODEL,
    max_tokens: 2000,
    system: [
      {
        type: 'text',
        text: THEME_EXPLAIN_SYSTEM,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: THEME_EXPLAIN_USER(theme, existingTags) }],
    output_config: { format: zodOutputFormat(ThemeExplanationSchema) },
  })

  if (!response.parsed_output) {
    throw new Error('Claude n\'a pas produit une sortie structurée valide.')
  }
  return response.parsed_output
}
