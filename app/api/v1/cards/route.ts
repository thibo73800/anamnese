import { NextResponse } from 'next/server'
import { apiError, withApiKey } from '@/lib/api-v1/handler'
import {
  createCardsBodySchema,
  listCardsQuerySchema,
} from '@/lib/api-v1/schemas'
import {
  normalizeCreatePayload,
  normalizeCreatePayloads,
} from '@/lib/api-v1/normalize'
import {
  repoCreateCard,
  repoCreateCards,
  repoListCards,
} from '@/lib/cards/repository'

export const POST = withApiKey(async (request, ctx) => {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return apiError('validation_error', 'Body JSON invalide', 422)
  }
  const parsed = createCardsBodySchema.parse(body)

  if ('card' in parsed) {
    const data = await normalizeCreatePayload(parsed.card)
    const { id } = await repoCreateCard(ctx, data)
    return NextResponse.json({ card: { id, ...data } }, { status: 201 })
  }

  const rows = await normalizeCreatePayloads(parsed.cards)
  const { ids } = await repoCreateCards(ctx, rows)
  const cards = ids.map((id, i) => ({ id, ...rows[i] }))
  return NextResponse.json({ cards }, { status: 201 })
})

export const GET = withApiKey(async (request, ctx) => {
  const { searchParams } = new URL(request.url)
  const parsed = listCardsQuerySchema.parse({
    tag: searchParams.get('tag') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
    since: searchParams.get('since') ?? undefined,
    cursor: searchParams.get('cursor') ?? undefined,
  })
  const cards = await repoListCards(ctx, parsed)
  const next_cursor =
    cards.length > 0 && cards.length === (parsed.limit ?? 50)
      ? cards[cards.length - 1].created_at
      : null
  return NextResponse.json({ cards, next_cursor })
})
