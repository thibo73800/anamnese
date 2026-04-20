'use server'

import { z } from 'zod'
import { refineExplanation } from '@/lib/anthropic/theme'

const refineSchema = z.object({
  theme: z.string().min(1).max(200),
  currentExplanation: z.string().min(1).max(6000),
  question: z.string().min(1).max(500),
})

export async function refineThemeExplanation(
  input: z.infer<typeof refineSchema>,
): Promise<string> {
  const parsed = refineSchema.parse(input)
  return refineExplanation(parsed)
}
