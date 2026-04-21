'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import {
  repoGetRecentStudyProfile,
  repoListTags,
  type RecentStudyCard,
} from '@/lib/cards/repository'
import { suggestThemes } from '@/lib/anthropic/suggestions'
import { proposeThemeAngles } from '@/lib/anthropic/angles'
import { generateVolatileCards } from '@/lib/anthropic/volatile'
import type { ProfileSummary } from '@/lib/anthropic/prompts/theme-suggest'
import type { SuggestedTheme, ThemeAngle, VolatileCard } from '@/lib/types'

const MIN_PROFILE_CARDS = 10

const FALLBACK_THEMES: SuggestedTheme[] = [
  { label: 'Renaissance italienne', kind: 'related', rationale: "Foyer artistique et intellectuel qui a redéfini l'Europe moderne." },
  { label: 'Révolution française', kind: 'related', rationale: 'Événement charnière qui éclaire toute la politique contemporaine.' },
  { label: 'Mécanique quantique', kind: 'related', rationale: 'Pilier de la physique moderne, riche en concepts contre-intuitifs.' },
  { label: 'Mythologie grecque', kind: 'related', rationale: 'Matrice de références utilisée en littérature, art et psychologie.' },
  { label: 'Impressionnisme', kind: 'related', rationale: "Rupture picturale qui a inventé la peinture moderne à la fin du XIXᵉ siècle." },
  { label: 'Guerre froide', kind: 'related', rationale: 'Grille de lecture des rapports de force du XXᵉ siècle.' },
]

async function currentCtx() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  return { supabase, userId: user.id }
}

function buildProfileSummary(profile: RecentStudyCard[]): ProfileSummary {
  const themeCounts = new Map<string, number>()
  const tagCounts = new Map<string, number>()
  for (const c of profile) {
    if (c.theme && c.theme.trim()) {
      const key = c.theme.trim()
      themeCounts.set(key, (themeCounts.get(key) ?? 0) + 1)
    }
    for (const t of c.tags) {
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
    }
  }
  const topThemes = Array.from(themeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([t]) => t)
  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([t]) => t)
  const recentTerms = profile.slice(0, 15).map((c) => c.term)
  return {
    topThemes,
    topTags,
    recentTerms,
    totalCards: profile.length,
  }
}

type StoredTheme = SuggestedTheme & { consumed: boolean }

type SnapshotCtx = { supabase: SupabaseClient; userId: string }

function todayIso(): string {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function stripStored(t: StoredTheme): SuggestedTheme {
  return { label: t.label, kind: t.kind, rationale: t.rationale }
}

function isMissingTableError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false
  if (err.code === '42P01') return true
  return typeof err.message === 'string' && err.message.includes('daily_suggestions') && err.message.includes('does not exist')
}

async function loadTodaySnapshot(
  ctx: SnapshotCtx,
  date: string,
): Promise<StoredTheme[] | null> {
  const { data, error } = await ctx.supabase
    .from('daily_suggestions')
    .select('date, themes')
    .eq('user_id', ctx.userId)
    .maybeSingle()
  if (error) {
    if (isMissingTableError(error)) {
      console.warn('[suggestions] daily_suggestions table missing — apply migration 0004. Running without cache.')
      return null
    }
    throw new Error(error.message)
  }
  if (!data) return null
  if (data.date !== date) return null
  const themes = data.themes as StoredTheme[] | null
  if (!Array.isArray(themes) || themes.length === 0) return null
  return themes
}

async function saveSnapshot(
  ctx: SnapshotCtx,
  date: string,
  themes: StoredTheme[],
): Promise<void> {
  const { error } = await ctx.supabase
    .from('daily_suggestions')
    .upsert(
      {
        user_id: ctx.userId,
        date,
        themes,
      },
      { onConflict: 'user_id' },
    )
  if (error) {
    if (isMissingTableError(error)) return
    throw new Error(error.message)
  }
}

export async function getSuggestedThemes(): Promise<SuggestedTheme[]> {
  const ctx = await currentCtx()
  const profile = await repoGetRecentStudyProfile(ctx, 100)
  if (profile.length < MIN_PROFILE_CARDS) return FALLBACK_THEMES

  const today = todayIso()
  const summary = buildProfileSummary(profile)

  const existing = await loadTodaySnapshot(ctx, today)
  if (!existing) {
    const fresh = await suggestThemes({ profile: summary, count: 6 })
    const stored: StoredTheme[] = fresh.map((t) => ({ ...t, consumed: false }))
    await saveSnapshot(ctx, today, stored)
    return stored.map(stripStored)
  }

  const consumed = existing.filter((t) => t.consumed)
  if (consumed.length === 0) return existing.map(stripStored)

  const nonConsumed = existing.filter((t) => !t.consumed)
  const excludeLabels = existing.map((t) => t.label)
  let replacements: SuggestedTheme[]
  try {
    replacements = await suggestThemes({
      profile: summary,
      count: consumed.length,
      excludeLabels,
    })
  } catch {
    return nonConsumed.map(stripStored)
  }

  const merged: StoredTheme[] = [
    ...nonConsumed,
    ...replacements.map((t) => ({ ...t, consumed: false })),
  ]
  await saveSnapshot(ctx, today, merged)
  return merged.map(stripStored)
}

const consumeSchema = z.object({ label: z.string().min(1).max(200) })

export async function consumeSuggestedTheme(input: {
  label: string
}): Promise<void> {
  const parsed = consumeSchema.parse(input)
  const ctx = await currentCtx()
  const today = todayIso()

  const existing = await loadTodaySnapshot(ctx, today)
  if (!existing) return

  const target = parsed.label.trim()
  let changed = false
  const updated: StoredTheme[] = existing.map((t) => {
    if (!t.consumed && t.label === target) {
      changed = true
      return { ...t, consumed: true }
    }
    return t
  })
  if (!changed) return

  await saveSnapshot(ctx, today, updated)
  revalidatePath('/')
}

const volatileCardSchema = z.object({
  id: z.string().min(1),
  term: z.string().min(1).max(120),
  definition: z.string().min(1).max(600),
  qcm_choices: z.object({
    distractors: z.array(z.string().min(1).max(120)).length(3),
  }),
})

const startSessionSchema = z.object({
  theme: z.string().min(1).max(200),
  count: z.number().int().min(10).max(30),
  keepCards: z.array(volatileCardSchema).max(30).optional(),
  previousSharedTags: z.array(z.string().min(1).max(40)).max(10).optional(),
})

export async function startVolatileSession(input: {
  theme: string
  count: number
  keepCards?: VolatileCard[]
  previousSharedTags?: string[]
}): Promise<{ cards: VolatileCard[]; sharedTags: string[] }> {
  const parsed = startSessionSchema.parse(input)
  const ctx = await currentCtx()

  const keep: VolatileCard[] = (parsed.keepCards ?? []).map((c) => ({
    id: c.id,
    term: c.term,
    definition: c.definition,
    qcm_choices: {
      distractors: [
        c.qcm_choices.distractors[0],
        c.qcm_choices.distractors[1],
        c.qcm_choices.distractors[2],
      ],
    },
  }))
  const needed = parsed.count - keep.length
  const previousTags = parsed.previousSharedTags ?? []

  if (needed <= 0) {
    return {
      cards: shuffle(keep.slice(0, parsed.count)),
      sharedTags: previousTags,
    }
  }

  const profile = await repoGetRecentStudyProfile(ctx, 100)
  const summary = profile.length >= MIN_PROFILE_CARDS ? buildProfileSummary(profile) : null
  const excludeTerms = keep.map((c) => c.term)
  const existingTags = await repoListTags(ctx)

  const generated = await generateVolatileCards({
    theme: parsed.theme.trim(),
    count: needed,
    profile: summary,
    excludeTerms,
    existingTags,
  })

  const newCards: VolatileCard[] = generated.cards.map((g) => ({
    id: crypto.randomUUID(),
    term: g.term,
    definition: g.definition,
    qcm_choices: { distractors: g.distractors },
  }))

  const sharedTags = previousTags.length > 0 ? previousTags : generated.sharedTags

  return { cards: shuffle([...keep, ...newCards]), sharedTags }
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const proposeAnglesSchema = z.object({
  seed: z.string().min(2).max(200),
})

export async function proposeAngles(input: { seed: string }): Promise<
  | { kind: 'ok'; seed: string; themes: ThemeAngle[] }
  | { kind: 'refused'; seed: string; reason: string }
> {
  const parsed = proposeAnglesSchema.parse(input)
  const ctx = await currentCtx()
  const seed = parsed.seed.trim()

  const profile = await repoGetRecentStudyProfile(ctx, 100)
  const summary =
    profile.length >= MIN_PROFILE_CARDS ? buildProfileSummary(profile) : null

  const res = await proposeThemeAngles({ seed, profile: summary })
  if (res.kind === 'refused') {
    return { kind: 'refused', seed, reason: res.reason }
  }
  return { kind: 'ok', seed, themes: res.themes }
}
