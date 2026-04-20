import type { ImageHit } from '@/lib/types'

export async function searchGoogle(query: string): Promise<ImageHit | null> {
  const cseId = process.env.GOOGLE_CSE_ID
  const key = process.env.GOOGLE_CSE_KEY
  if (!cseId || !key) return null

  const url = new URL('https://www.googleapis.com/customsearch/v1')
  url.searchParams.set('key', key)
  url.searchParams.set('cx', cseId)
  url.searchParams.set('q', query)
  url.searchParams.set('searchType', 'image')
  url.searchParams.set('num', '1')
  url.searchParams.set('safe', 'active')
  url.searchParams.set('imgSize', 'medium')

  const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 } })
  if (!res.ok) return null

  const data = (await res.json()) as {
    items?: Array<{ link: string; displayLink: string; title: string }>
  }
  const hit = data.items?.[0]
  if (!hit) return null

  return {
    url: hit.link,
    source: 'google',
    attribution: hit.displayLink,
  }
}
