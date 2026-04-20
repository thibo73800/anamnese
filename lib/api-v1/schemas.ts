import { z } from 'zod'

const tagSchema = z.string().min(1).max(40)

export const createCardSchema = z.object({
  term: z.string().min(1).max(120),
  definition: z.string().min(1).max(600),
  tags: z.array(tagSchema).max(8).optional(),
  theme: z.string().max(200).nullable().optional(),
  distractors: z
    .array(z.string().min(1).max(80))
    .length(3)
    .optional(),
  image_url: z.string().url().nullable().optional(),
  image_source: z.enum(['wikimedia', 'unsplash', 'google']).nullable().optional(),
  image_attribution: z.string().max(400).nullable().optional(),
  explanation: z.string().max(4000).nullable().optional(),
})

export type CreateCardPayload = z.infer<typeof createCardSchema>

export const createCardsBodySchema = z.union([
  z.object({ card: createCardSchema }),
  z.object({ cards: z.array(createCardSchema).min(1).max(50) }),
])

export const updateCardSchema = z
  .object({
    term: z.string().min(1).max(120).optional(),
    definition: z.string().min(1).max(600).optional(),
    tags: z.array(tagSchema).max(8).optional(),
    image_url: z.string().url().nullable().optional(),
    image_source: z.enum(['wikimedia', 'unsplash', 'google']).nullable().optional(),
    image_attribution: z.string().max(400).nullable().optional(),
    explanation: z.string().max(4000).nullable().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'Au moins un champ requis',
  })

export type UpdateCardPayload = z.infer<typeof updateCardSchema>

export const listCardsQuerySchema = z.object({
  tag: z.string().min(1).max(40).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  since: z.string().datetime().optional(),
  cursor: z.string().datetime().optional(),
})

export const statsQuerySchema = z.object({
  window: z.enum(['7d', '30d']).optional(),
})
