'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { initCard, reviewCard } from '@/lib/fsrs/engine'
import { deriveMode } from '@/lib/fsrs/mode'
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

export async function createCard(input: CreateCardInput): Promise<{ id: string }> {
  const parsed = createSchema.parse(input)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const fsrs_state = initCard()
  const qcm_choices = { distractors: parsed.distractors }

  const { data, error } = await supabase
    .from('cards')
    .insert({
      user_id: user.id,
      term: parsed.term,
      definition: parsed.definition,
      tags: parsed.tags,
      theme: parsed.theme,
      image_url: parsed.image_url,
      image_source: parsed.image_source,
      image_attribution: parsed.image_attribution,
      explanation: parsed.explanation,
      qcm_choices,
      fsrs_state,
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Impossible de créer la carte')

  revalidatePath('/cards')
  revalidatePath('/review')
  return { id: data.id }
}

const updateSchema = createSchema.omit({ theme: true, distractors: true })

export async function updateCard(
  cardId: string,
  input: Omit<CreateCardInput, 'theme' | 'distractors'>,
): Promise<void> {
  const parsed = updateSchema.parse(input)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const { error } = await supabase
    .from('cards')
    .update({
      term: parsed.term,
      definition: parsed.definition,
      tags: parsed.tags,
      image_url: parsed.image_url,
      image_source: parsed.image_source,
      image_attribution: parsed.image_attribution,
      explanation: parsed.explanation,
    })
    .eq('id', cardId)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)

  revalidatePath('/cards')
  revalidatePath('/review')
}

export async function deleteCard(cardId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('cards').delete().eq('id', cardId)
  if (error) throw new Error(error.message)
  revalidatePath('/cards')
  revalidatePath('/review')
}

export async function createCardAndGoReview(input: CreateCardInput) {
  await createCard(input)
  redirect('/cards')
}

export async function listCards(opts: { tag?: string } = {}): Promise<AnamneseCard[]> {
  const supabase = await createClient()
  const query = supabase
    .from('cards')
    .select('*')
    .order('created_at', { ascending: false })
  const { data, error } = opts.tag ? await query.contains('tags', [opts.tag]) : await query
  if (error) throw new Error(error.message)
  return (data ?? []) as AnamneseCard[]
}

export async function listAllTags(): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('cards').select('tags')
  if (error) throw new Error(error.message)
  const set = new Set<string>()
  for (const row of data ?? []) for (const t of row.tags ?? []) set.add(t)
  return Array.from(set).sort()
}

export async function getDueCard(): Promise<AnamneseCard | null> {
  const supabase = await createClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .lte('fsrs_state->>due', now)
    .order('fsrs_state->>due', { ascending: true })
    .limit(1)
  if (error) throw new Error(error.message)
  return (data?.[0] as AnamneseCard | undefined) ?? null
}

export async function getDueCards(limit: number = 10): Promise<AnamneseCard[]> {
  const supabase = await createClient()
  const now = new Date().toISOString()
  const safeLimit = Math.max(1, Math.min(50, Math.trunc(limit)))
  const { data, error } = await supabase
    .from('cards')
    .select('*')
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
  const supabase = await createClient()
  const now = new Date().toISOString()
  const safeLimit = Math.max(1, Math.min(50, Math.trunc(limit)))
  let query = supabase
    .from('cards')
    .select('*')
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
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const { data: row, error } = await supabase
    .from('cards')
    .select('*')
    .eq('id', params.cardId)
    .single()
  if (error || !row) throw new Error(error?.message ?? 'Carte introuvable')

  const card = row as AnamneseCard
  const mode = deriveMode(card.fsrs_state)
  const { card: next, previous } = reviewCard(card.fsrs_state, params.rating)

  const updateCard = supabase
    .from('cards')
    .update({ fsrs_state: next })
    .eq('id', card.id)

  const insertReview = supabase.from('reviews').insert({
    card_id: card.id,
    user_id: user.id,
    rating: params.rating,
    mode_used: mode,
    response_text: params.responseText ?? null,
    previous_state: previous,
    new_state: next,
  })

  const [updateRes, insertRes] = await Promise.all([updateCard, insertReview])
  if (updateRes.error) throw new Error(updateRes.error.message)
  if (insertRes.error) throw new Error(insertRes.error.message)

  revalidatePath('/cards')

  return { nextCard: { ...card, fsrs_state: next } }
}

