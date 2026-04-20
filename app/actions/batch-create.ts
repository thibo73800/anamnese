'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'
import { createClient } from '@/lib/supabase/server'
import { initCard } from '@/lib/fsrs/engine'
import { runBatchTurn } from '@/lib/anthropic/batch'
import { findImage } from '@/lib/images'
import type {
  DisplayMessage,
  DraftCard,
  ImageHit,
  ImageSource,
} from '@/lib/types'

const imageHitSchema = z
  .object({
    url: z.string().url(),
    source: z.enum(['wikimedia', 'unsplash', 'google']),
    attribution: z.string().nullable(),
  })
  .nullable()

const draftCardSchema = z.object({
  localId: z.string().min(1),
  term: z.string().min(1).max(120),
  definition: z.string().min(1).max(600),
  distractors: z.tuple([
    z.string().min(1).max(80),
    z.string().min(1).max(80),
    z.string().min(1).max(80),
  ]),
  image: imageHitSchema,
})

const displayMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string().min(1),
})

const sendSchema = z.object({
  history: z.array(displayMessageSchema).max(50),
  userText: z.string().min(1).max(2000),
  draftCards: z.array(draftCardSchema).max(100),
  sharedTags: z.array(z.string().min(1).max(40)).max(8),
})

export async function sendBatchMessage(
  input: z.infer<typeof sendSchema>,
): Promise<{
  history: DisplayMessage[]
  draftCards: DraftCard[]
  sharedTags: string[]
}> {
  const parsed = sendSchema.parse(input)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const apiHistory: MessageParam[] = parsed.history.map((m) => ({
    role: m.role,
    content: m.text,
  }))

  const result = await runBatchTurn({
    history: apiHistory,
    userText: parsed.userText,
    draftCards: parsed.draftCards,
    sharedTags: parsed.sharedTags,
  })

  const history: DisplayMessage[] = [
    ...parsed.history,
    { role: 'user', text: parsed.userText },
    { role: 'assistant', text: result.assistantText },
  ]

  return {
    history,
    draftCards: result.draftCards,
    sharedTags: result.sharedTags,
  }
}

const findImageSchema = z.object({
  query: z.string().min(1).max(200),
})

export async function findImageForDraft(
  input: z.infer<typeof findImageSchema>,
): Promise<ImageHit | null> {
  const parsed = findImageSchema.parse(input)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  return findImage(parsed.query)
}

const commitSchema = z.object({
  theme: z.string().min(1).max(200),
  sharedTags: z.array(z.string().min(1).max(40)).max(8),
  cards: z.array(draftCardSchema).min(1).max(50),
})

export async function commitSet(
  input: z.infer<typeof commitSchema>,
): Promise<{ ids: string[]; firstTag: string | null }> {
  const parsed = commitSchema.parse(input)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const cleanTags = Array.from(
    new Set(parsed.sharedTags.map((t) => t.trim().toLowerCase()).filter(Boolean)),
  )

  const rows = parsed.cards.map((c) => {
    const imageSource: ImageSource | null = c.image?.source ?? null
    return {
      user_id: user.id,
      term: c.term,
      definition: c.definition,
      tags: cleanTags,
      theme: parsed.theme,
      image_url: c.image?.url ?? null,
      image_source: imageSource,
      image_attribution: c.image?.attribution ?? null,
      explanation: null,
      qcm_choices: { distractors: c.distractors },
      fsrs_state: initCard(),
    }
  })

  const { data, error } = await supabase
    .from('cards')
    .insert(rows)
    .select('id')

  if (error || !data) {
    throw new Error(error?.message ?? 'Impossible de créer le set')
  }

  revalidatePath('/cards')
  revalidatePath('/review')

  return {
    ids: data.map((r) => r.id),
    firstTag: cleanTags[0] ?? null,
  }
}
