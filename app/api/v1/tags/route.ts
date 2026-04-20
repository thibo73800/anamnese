import { NextResponse } from 'next/server'
import { withApiKey } from '@/lib/api-v1/handler'
import { repoListTags } from '@/lib/cards/repository'

export const GET = withApiKey(async (_request, ctx) => {
  const tags = await repoListTags(ctx)
  return NextResponse.json({ tags })
})
