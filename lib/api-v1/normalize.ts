import { generateDistractors } from '@/lib/anthropic/distractors'
import type { CreateCardData } from '@/lib/cards/repository'
import type { CreateCardPayload } from './schemas'

/**
 * Convertit un payload API en `CreateCardData` utilisable par le
 * repository. Si les distractors sont absents, appelle Claude pour les
 * générer. Les champs optionnels deviennent null.
 */
export async function normalizeCreatePayload(
  p: CreateCardPayload,
): Promise<CreateCardData> {
  const distractors: [string, string, string] = p.distractors
    ? [p.distractors[0], p.distractors[1], p.distractors[2]]
    : await generateDistractors({
        term: p.term,
        definition: p.definition,
        theme: p.theme ?? null,
      })

  return {
    term: p.term,
    definition: p.definition,
    tags: (p.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean),
    theme: p.theme ?? null,
    distractors,
    image_url: p.image_url ?? null,
    image_source: p.image_source ?? null,
    image_attribution: p.image_attribution ?? null,
    explanation: p.explanation ?? null,
  }
}

export async function normalizeCreatePayloads(
  payloads: CreateCardPayload[],
): Promise<CreateCardData[]> {
  return Promise.all(payloads.map(normalizeCreatePayload))
}
