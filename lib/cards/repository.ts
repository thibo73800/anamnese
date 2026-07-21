import type { SupabaseClient } from '@supabase/supabase-js'
import { initCard, normalizeCard } from '@/lib/fsrs/engine'
import { deriveMastery, masteryFromStability } from '@/lib/fsrs/mode'
import type { AnamneseCard, ImageSource } from '@/lib/types'

export interface CardRepoCtx {
  supabase: SupabaseClient
  userId: string
}

export interface CreateCardData {
  term: string
  definition: string
  tags: string[]
  theme: string | null
  distractors: [string, string, string]
  image_url: string | null
  image_source: ImageSource | null
  image_attribution: string | null
  explanation: string | null
}

export type UpdateCardPatch = Partial<{
  term: string
  definition: string
  tags: string[]
  image_url: string | null
  image_source: ImageSource | null
  image_attribution: string | null
  explanation: string | null
  qcm_choices: { distractors: [string, string, string] }
}>

export interface ListCardsOpts {
  tag?: string
  limit?: number
  since?: string
  cursor?: string
}

export interface RecentStudyCard {
  id: string
  term: string
  definition: string
  theme: string | null
  tags: string[]
  last_reviewed_at: string
}

export interface CardStats {
  total_cards: number
  due_count: number
  new_count: number
  learning_count: number
  review_count_7d: number
  ratings_7d: { again: number; hard: number; good: number; easy: number }
}

export interface MasteryHistogram {
  new: number
  learning: number
  consolidated: number
  mastered: number
}

export interface ProgressPoint {
  /** ISO de la borne hebdomadaire. */
  t: string
  /** Cartes distinctes déjà révisées à cette date (cumul). */
  seen: number
  /** Cartes dont la dernière `stability` connue ≥ 30j à cette date. */
  mastered: number
}

export interface ProgressRecap {
  total_cards: number
  due_count: number
  histogram: MasteryHistogram
  /** Série temporelle ; `[]` quand trop peu de reviews pour tracer une courbe. */
  series: ProgressPoint[]
  ratings_7d: { again: number; hard: number; good: number; easy: number }
  phase: 'learn' | 'consolidate'
}

function rowFromCreate(userId: string, data: CreateCardData) {
  return {
    user_id: userId,
    term: data.term,
    definition: data.definition,
    tags: data.tags,
    theme: data.theme,
    image_url: data.image_url,
    image_source: data.image_source,
    image_attribution: data.image_attribution,
    explanation: data.explanation,
    qcm_choices: { distractors: data.distractors },
    fsrs_state: initCard(),
  }
}

export async function repoCreateCard(
  ctx: CardRepoCtx,
  data: CreateCardData,
): Promise<{ id: string }> {
  const { data: row, error } = await ctx.supabase
    .from('cards')
    .insert(rowFromCreate(ctx.userId, data))
    .select('id')
    .single()
  if (error || !row) throw new Error(error?.message ?? 'Création carte impossible')
  return { id: row.id }
}

export async function repoCreateCards(
  ctx: CardRepoCtx,
  rows: CreateCardData[],
): Promise<{ ids: string[] }> {
  if (rows.length === 0) return { ids: [] }
  const { data, error } = await ctx.supabase
    .from('cards')
    .insert(rows.map((r) => rowFromCreate(ctx.userId, r)))
    .select('id')
  if (error || !data) throw new Error(error?.message ?? 'Création set impossible')
  return { ids: data.map((r) => r.id) }
}

export async function repoGetCard(
  ctx: CardRepoCtx,
  cardId: string,
): Promise<AnamneseCard | null> {
  const { data, error } = await ctx.supabase
    .from('cards')
    .select('*')
    .eq('id', cardId)
    .eq('user_id', ctx.userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as AnamneseCard | null) ?? null
}

export async function repoUpdateCard(
  ctx: CardRepoCtx,
  cardId: string,
  patch: UpdateCardPatch,
): Promise<void> {
  if (Object.keys(patch).length === 0) return
  const { error } = await ctx.supabase
    .from('cards')
    .update(patch)
    .eq('id', cardId)
    .eq('user_id', ctx.userId)
  if (error) throw new Error(error.message)
}

export async function repoDeleteCard(
  ctx: CardRepoCtx,
  cardId: string,
): Promise<void> {
  const { error } = await ctx.supabase
    .from('cards')
    .delete()
    .eq('id', cardId)
    .eq('user_id', ctx.userId)
  if (error) throw new Error(error.message)
}

export async function repoListCards(
  ctx: CardRepoCtx,
  opts: ListCardsOpts = {},
): Promise<AnamneseCard[]> {
  const limit = Math.max(1, Math.min(200, Math.trunc(opts.limit ?? 50)))
  let query = ctx.supabase
    .from('cards')
    .select('*')
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (opts.tag) query = query.contains('tags', [opts.tag])
  if (opts.since) query = query.gte('updated_at', opts.since)
  if (opts.cursor) query = query.lt('created_at', opts.cursor)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as AnamneseCard[]
}

export async function repoListTags(ctx: CardRepoCtx): Promise<string[]> {
  const { data, error } = await ctx.supabase
    .from('cards')
    .select('tags')
    .eq('user_id', ctx.userId)
  if (error) throw new Error(error.message)
  const set = new Set<string>()
  for (const row of data ?? []) for (const t of row.tags ?? []) set.add(t)
  return Array.from(set).sort()
}

export async function repoGetStats(ctx: CardRepoCtx): Promise<CardStats> {
  const nowIso = new Date().toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()

  const [totalRes, dueRes, stateRows, reviewRows] = await Promise.all([
    ctx.supabase
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', ctx.userId),
    ctx.supabase
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', ctx.userId)
      .lte('fsrs_state->>due', nowIso),
    ctx.supabase
      .from('cards')
      .select('fsrs_state')
      .eq('user_id', ctx.userId),
    ctx.supabase
      .from('reviews')
      .select('rating')
      .eq('user_id', ctx.userId)
      .gte('reviewed_at', sevenDaysAgo),
  ])

  if (totalRes.error) throw new Error(totalRes.error.message)
  if (dueRes.error) throw new Error(dueRes.error.message)
  if (stateRows.error) throw new Error(stateRows.error.message)
  if (reviewRows.error) throw new Error(reviewRows.error.message)

  let new_count = 0
  let learning_count = 0
  for (const row of stateRows.data ?? []) {
    const st = (row.fsrs_state as { state?: number | string } | null)?.state
    const n = typeof st === 'string' ? stateNumFromString(st) : (st ?? 0)
    if (n === 0) new_count++
    else if (n === 1 || n === 3) learning_count++
  }

  const ratings = { again: 0, hard: 0, good: 0, easy: 0 }
  for (const row of reviewRows.data ?? []) {
    switch (row.rating) {
      case 1: ratings.again++; break
      case 2: ratings.hard++; break
      case 3: ratings.good++; break
      case 4: ratings.easy++; break
    }
  }

  return {
    total_cards: totalRes.count ?? 0,
    due_count: dueRes.count ?? 0,
    new_count,
    learning_count,
    review_count_7d: reviewRows.data?.length ?? 0,
    ratings_7d: ratings,
  }
}

// Heuristique de phase — seuils ajustables.
const PHASE_DUE_BACKLOG_RATIO = 0.2 // backlog de révisions rapporté aux cartes non maîtrisées
const PHASE_AGAIN_RATIO = 0.3 // part d'échecs récents (rating "Again", 7 j)
const RECAP_DEFAULT_WEEKS = 12 // largeur de la fenêtre de la courbe
const REVIEWS_SCAN_CAP = 20000 // borne dure sur le rejeu d'historique (perf)
const WEEK_MS = 7 * 24 * 3600 * 1000

/**
 * Récap de progression pour la page d'accueil : histogramme de maîtrise courant,
 * courbe reconstruite depuis `reviews`, et signal apprendre/consolider.
 *
 * Approximation assumée : `stability` n'est recalculée qu'au moment d'une review,
 * donc la maîtrise à une date passée = `masteryFromStability(dernier new_state ≤ t)`,
 * la stability étant considérée plate entre deux reviews. Suffisant pour un récap.
 */
export async function repoGetProgressRecap(
  ctx: CardRepoCtx,
  opts?: { weeks?: number },
): Promise<ProgressRecap> {
  const weeks = Math.max(1, Math.min(52, Math.trunc(opts?.weeks ?? RECAP_DEFAULT_WEEKS)))
  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const sevenDaysAgo = new Date(now - WEEK_MS).toISOString()

  const [totalRes, dueRes, stateRows, ratingRows, historyRows] = await Promise.all([
    ctx.supabase
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', ctx.userId),
    ctx.supabase
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', ctx.userId)
      .lte('fsrs_state->>due', nowIso),
    ctx.supabase
      .from('cards')
      .select('fsrs_state')
      .eq('user_id', ctx.userId),
    ctx.supabase
      .from('reviews')
      .select('rating')
      .eq('user_id', ctx.userId)
      .gte('reviewed_at', sevenDaysAgo),
    // Historique complet (borné) pour reconstruire la courbe — 3 colonnes légères.
    ctx.supabase
      .from('reviews')
      .select('card_id, reviewed_at, new_state')
      .eq('user_id', ctx.userId)
      .order('reviewed_at', { ascending: true })
      .limit(REVIEWS_SCAN_CAP),
  ])

  if (totalRes.error) throw new Error(totalRes.error.message)
  if (dueRes.error) throw new Error(dueRes.error.message)
  if (stateRows.error) throw new Error(stateRows.error.message)
  if (ratingRows.error) throw new Error(ratingRows.error.message)
  if (historyRows.error) throw new Error(historyRows.error.message)

  const histogram: MasteryHistogram = { new: 0, learning: 0, consolidated: 0, mastered: 0 }
  for (const row of stateRows.data ?? []) {
    histogram[deriveMastery(row.fsrs_state).level]++
  }

  const ratings = { again: 0, hard: 0, good: 0, easy: 0 }
  for (const row of ratingRows.data ?? []) {
    switch (row.rating) {
      case 1: ratings.again++; break
      case 2: ratings.hard++; break
      case 3: ratings.good++; break
      case 4: ratings.easy++; break
    }
  }

  const series = reconstructProgressSeries(
    (historyRows.data ?? []) as HistoryRow[],
    now,
    weeks,
  )

  const nonMastered = histogram.new + histogram.learning + histogram.consolidated
  const total7d = ratings.again + ratings.hard + ratings.good + ratings.easy
  const againRatio = total7d > 0 ? ratings.again / total7d : 0
  const phase: 'learn' | 'consolidate' =
    (nonMastered > 0 && (dueRes.count ?? 0) >= PHASE_DUE_BACKLOG_RATIO * nonMastered) ||
    againRatio > PHASE_AGAIN_RATIO
      ? 'consolidate'
      : 'learn'

  return {
    total_cards: totalRes.count ?? 0,
    due_count: dueRes.count ?? 0,
    histogram,
    series,
    ratings_7d: ratings,
    phase,
  }
}

interface HistoryRow {
  card_id: string
  reviewed_at: string
  new_state: unknown
}

/**
 * Rejoue tout l'historique des reviews (ordre chronologique) et prend un snapshot
 * à chaque borne hebdomadaire de la fenêtre `[now - weeks, now]`. Les reviews
 * antérieures à la fenêtre alimentent quand même la map (cartes comptées en "vues").
 * Retourne `[]` s'il y a moins de 2 bornes non vides (courbe non pertinente).
 */
function reconstructProgressSeries(
  rows: HistoryRow[],
  now: number,
  weeks: number,
): ProgressPoint[] {
  const boundaries: number[] = []
  for (let i = 0; i <= weeks; i++) boundaries.push(now - (weeks - i) * WEEK_MS)

  const latestStability = new Map<string, number>()
  const series: ProgressPoint[] = []
  let bi = 0

  const snapshot = (t: number): ProgressPoint => {
    let mastered = 0
    for (const s of latestStability.values()) {
      if (masteryFromStability(s).level === 'mastered') mastered++
    }
    return { t: new Date(t).toISOString(), seen: latestStability.size, mastered }
  }

  for (const row of rows) {
    const rt = Date.parse(row.reviewed_at)
    while (bi < boundaries.length && boundaries[bi] < rt) {
      series.push(snapshot(boundaries[bi]))
      bi++
    }
    latestStability.set(row.card_id, normalizeCard(row.new_state).stability)
  }
  while (bi < boundaries.length) {
    series.push(snapshot(boundaries[bi]))
    bi++
  }

  if (series.filter((p) => p.seen > 0).length < 2) return []
  return series
}

export async function repoGetRecentStudyProfile(
  ctx: CardRepoCtx,
  limit = 100,
): Promise<RecentStudyCard[]> {
  const safeLimit = Math.max(1, Math.min(300, Math.trunc(limit)))
  const { data: reviews, error: revErr } = await ctx.supabase
    .from('reviews')
    .select('card_id, reviewed_at')
    .eq('user_id', ctx.userId)
    .order('reviewed_at', { ascending: false })
    .limit(safeLimit * 4)
  if (revErr) throw new Error(revErr.message)

  const orderedIds: string[] = []
  const firstSeen = new Map<string, string>()
  for (const r of reviews ?? []) {
    if (!firstSeen.has(r.card_id)) {
      firstSeen.set(r.card_id, r.reviewed_at as string)
      orderedIds.push(r.card_id as string)
      if (orderedIds.length >= safeLimit) break
    }
  }
  if (orderedIds.length === 0) return []

  const { data: cards, error: cardErr } = await ctx.supabase
    .from('cards')
    .select('id, term, definition, theme, tags')
    .eq('user_id', ctx.userId)
    .in('id', orderedIds)
  if (cardErr) throw new Error(cardErr.message)

  const byId = new Map<string, { id: string; term: string; definition: string; theme: string | null; tags: string[] }>()
  for (const c of cards ?? []) byId.set(c.id as string, c as { id: string; term: string; definition: string; theme: string | null; tags: string[] })

  const out: RecentStudyCard[] = []
  for (const id of orderedIds) {
    const c = byId.get(id)
    if (!c) continue
    out.push({
      id: c.id,
      term: c.term,
      definition: c.definition,
      theme: c.theme,
      tags: c.tags ?? [],
      last_reviewed_at: firstSeen.get(id)!,
    })
  }
  return out
}

function stateNumFromString(s: string): number {
  switch (s) {
    case 'New': return 0
    case 'Learning': return 1
    case 'Review': return 2
    case 'Relearning': return 3
    default: return 0
  }
}
