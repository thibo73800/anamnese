import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { ANAMNESE_MODEL, getAnthropic } from './client'
import {
  THEME_ANGLES_SYSTEM,
  THEME_ANGLES_USER,
} from './prompts/theme-angles'
import type { ProfileSummary } from './prompts/theme-suggest'
import type { ThemeAngle } from '@/lib/types'

const anglesSchema = z.object({
  themes: z
    .array(
      z.object({
        label: z.string().min(1).max(120),
        kind: z.enum(['main', 'angle']),
        rationale: z.string().min(1).max(200),
      }),
    )
    .max(6),
  refusal: z.string().nullable(),
})

export type ProposeAnglesResult =
  | { kind: 'ok'; themes: ThemeAngle[] }
  | { kind: 'refused'; reason: string }

export async function proposeThemeAngles(params: {
  seed: string
  profile: ProfileSummary | null
}): Promise<ProposeAnglesResult> {
  const client = getAnthropic()
  const response = await client.messages.parse({
    model: ANAMNESE_MODEL,
    max_tokens: 800,
    system: [
      {
        type: 'text',
        text: THEME_ANGLES_SYSTEM,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: THEME_ANGLES_USER({ seed: params.seed, profile: params.profile }),
      },
    ],
    output_config: { format: zodOutputFormat(anglesSchema) },
  })
  if (!response.parsed_output) {
    throw new Error("Claude n'a pas produit une sortie structurée valide.")
  }
  const out = response.parsed_output

  if (out.refusal && out.refusal.trim() && out.themes.length === 0) {
    return { kind: 'refused', reason: out.refusal.trim() }
  }

  if (out.themes.length === 0) {
    return {
      kind: 'refused',
      reason: 'Ce sujet ne peut pas être traité. Essaie une autre formulation.',
    }
  }

  const mains = out.themes.filter((t) => t.kind === 'main')
  const angles = out.themes.filter((t) => t.kind === 'angle')
  const compliant = mains.length === 1 && angles.length === 5

  if (compliant) {
    return { kind: 'ok', themes: [mains[0], ...angles] }
  }

  const all = [...mains, ...angles].slice(0, 6)
  const normalized: ThemeAngle[] = all.map((t, i) => ({
    label: t.label,
    rationale: t.rationale,
    kind: i === 0 ? 'main' : 'angle',
  }))
  return { kind: 'ok', themes: normalized }
}
