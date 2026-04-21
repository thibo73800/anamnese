'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { reviewCard } from '@/lib/fsrs/engine'
import { deriveMode } from '@/lib/fsrs/mode'
import {
  repoCreateCard,
  repoDeleteCard,
  repoListCards,
  repoListTags,
  repoUpdateCard,
  type CreateCardData,
} from '@/lib/cards/repository'
import type { AnamneseCard, Rating } from '@/lib/types'

const createSchema = z.object({
  term: z.string().min(1).max(120),
  definition: z.string().min(1).max(600),
  tags: z.array(z.string().min(1).max(40)).max(8),
  theme: z.string().max(200).nullable(),
  distractors: z.array(z.string().min(1).max(80)).length(3),
  image_url: z.string().url().nullable(),
  image_source: z.enum(['wikimedia', 'unsplash', 'google']).nullable(),
  image_attribution: z.string().max(400).nullable(),
  explanation: z.string().max(4000).nullable(),
})

export type CreateCardInput = z.infer<typeof createSchema>

async function currentCtx() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  return { supabase, userId: user.id }
}

export async function createCard(input: CreateCardInput): Promise<{ id: string }> {
  const parsed = createSchema.parse(input)
  const ctx = await currentCtx()
  const data: CreateCardData = {
    ...parsed,
    distractors: [parsed.distractors[0], parsed.distractors[1], parsed.distractors[2]],
  }
  const res = await repoCreateCard(ctx, data)
  revalidatePath('/cards')
  revalidatePath('/review')
  return res
}

const updateSchema = createSchema.omit({ theme: true })

export async function updateCard(
  cardId: string,
  input: Omit<CreateCardInput, 'theme'>,
): Promise<void> {
  const parsed = updateSchema.parse(input)
  const ctx = await currentCtx()
  const { distractors, ...rest } = parsed
  await repoUpdateCard(ctx, cardId, {
    ...rest,
    qcm_choices: {
      distractors: [distractors[0], distractors[1], distractors[2]],
    },
  })
  revalidatePath('/cards')
  revalidatePath('/review')
}

export async function deleteCard(cardId: string) {
  const ctx = await currentCtx()
  await repoDeleteCard(ctx, cardId)
  revalidatePath('/cards')
  revalidatePath('/review')
}

export async function createCardAndGoReview(input: CreateCardInput) {
  await createCard(input)
  redirect('/cards')
}

export async function listCards(opts: { tag?: string } = {}): Promise<AnamneseCard[]> {
  const ctx = await currentCtx()
  return repoListCards(ctx, { tag: opts.tag, limit: 200 })
}

export async function listAllTags(): Promise<string[]> {
  const ctx = await currentCtx()
  return repoListTags(ctx)
}

export async function getDueCard(): Promise<AnamneseCard | null> {
  const ctx = await currentCtx()
  const now = new Date().toISOString()
  const { data, error } = await ctx.supabase
    .from('cards')
    .select('*')
    .eq('user_id', ctx.userId)
    .lte('fsrs_state->>due', now)
    .order('fsrs_state->>due', { ascending: true })
    .limit(1)
  if (error) throw new Error(error.message)
  return (data?.[0] as AnamneseCard | undefined) ?? null
}

export async function getDueCards(limit: number = 10): Promise<AnamneseCard[]> {
  const ctx = await currentCtx()
  const now = new Date().toISOString()
  const safeLimit = Math.max(1, Math.min(50, Math.trunc(limit)))
  const { data, error } = await ctx.supabase
    .from('cards')
    .select('*')
    .eq('user_id', ctx.userId)
    .lte('fsrs_state->>due', now)
    .order('fsrs_state->>due', { ascending: true })
    .limit(safeLimit)
  if (error) throw new Error(error.message)
  return (data ?? []) as AnamneseCard[]
}

export async function getDueCardsExcluding(
  excludeIds: string[],
  limit: number = 10,
): Promise<AnamneseCard[]> {
  const ctx = await currentCtx()
  const now = new Date().toISOString()
  const safeLimit = Math.max(1, Math.min(50, Math.trunc(limit)))
  let query = ctx.supabase
    .from('cards')
    .select('*')
    .eq('user_id', ctx.userId)
    .lte('fsrs_state->>due', now)
    .order('fsrs_state->>due', { ascending: true })
    .limit(safeLimit)
  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.map((id) => `"${id}"`).join(',')})`)
  }
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as AnamneseCard[]
}

export async function submitReview(params: {
  cardId: string
  rating: Rating
  responseText?: string
}): Promise<{ nextCard: AnamneseCard }> {
  const ctx = await currentCtx()

  const { data: row, error } = await ctx.supabase
    .from('cards')
    .select('*')
    .eq('id', params.cardId)
    .eq('user_id', ctx.userId)
    .single()
  if (error || !row) throw new Error(error?.message ?? 'Carte introuvable')

  const card = row as AnamneseCard
  const mode = deriveMode(card.fsrs_state)
  const { card: next, previous } = reviewCard(card.fsrs_state, params.rating)

  const updateCardQ = ctx.supabase
    .from('cards')
    .update({ fsrs_state: next })
    .eq('id', card.id)
    .eq('user_id', ctx.userId)

  const insertReview = ctx.supabase.from('reviews').insert({
    card_id: card.id,
    user_id: ctx.userId,
    rating: params.rating,
    mode_used: mode,
    response_text: params.responseText ?? null,
    previous_state: previous,
    new_state: next,
  })

  const [updateRes, insertRes] = await Promise.all([updateCardQ, insertReview])
  if (updateRes.error) throw new Error(updateRes.error.message)
  if (insertRes.error) throw new Error(insertRes.error.message)

  revalidatePath('/cards')

  return { nextCard: { ...card, fsrs_state: next } }
}
