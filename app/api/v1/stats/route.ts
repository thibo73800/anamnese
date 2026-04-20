import { NextResponse } from 'next/server'
import { withApiKey } from '@/lib/api-v1/handler'
import { repoGetStats } from '@/lib/cards/repository'

export const GET = withApiKey(async (_request, ctx) => {
  const stats = await repoGetStats(ctx)
  return NextResponse.json(stats)
})
