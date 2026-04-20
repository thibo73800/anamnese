import { NextResponse } from 'next/server'
import { apiError, withApiKey } from '@/lib/api-v1/handler'
import { updateCardSchema } from '@/lib/api-v1/schemas'
import {
  repoDeleteCard,
  repoGetCard,
  repoUpdateCard,
} from '@/lib/cards/repository'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  return withApiKey(async (_req, ctx) => {
    const { id } = await params
    const card = await repoGetCard(ctx, id)
    if (!card) return apiError('not_found', 'Carte introuvable', 404)
    return NextResponse.json({ card })
  })(request)
}

export async function PATCH(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  return withApiKey(async (req, ctx) => {
    const { id } = await params
    const existing = await repoGetCard(ctx, id)
    if (!existing) return apiError('not_found', 'Carte introuvable', 404)

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return apiError('validation_error', 'Body JSON invalide', 422)
    }
    const parsed = updateCardSchema.parse(body)
    await repoUpdateCard(ctx, id, parsed)
    const updated = await repoGetCard(ctx, id)
    return NextResponse.json({ card: updated })
  })(request)
}

export async function DELETE(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  return withApiKey(async (_req, ctx) => {
    const { id } = await params
    const existing = await repoGetCard(ctx, id)
    if (!existing) return apiError('not_found', 'Carte introuvable', 404)
    await repoDeleteCard(ctx, id)
    return NextResponse.json({ deleted: true })
  })(request)
}
