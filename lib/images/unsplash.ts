import type { ImageHit } from '@/lib/types'

export async function searchUnsplash(query: string): Promise<ImageHit | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key) return null

  const url = new URL('https://api.unsplash.com/search/photos')
  url.searchParams.set('query', query)
  url.searchParams.set('per_page', '1')
  url.searchParams.set('content_filter', 'high')
  url.searchParams.set('orientation', 'landscape')

  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${key}` },
    next: { revalidate: 60 * 60 * 24 },
  })
  if (!res.ok) return null

  const data = (await res.json()) as {
    results?: Array<{
      urls: { regular: string; small: string }
      user: { name: string; links: { html: string } }
    }>
  }
  const hit = data.results?.[0]
  if (!hit) return null

  return {
    url: hit.urls.regular,
    source: 'unsplash',
    // Unsplash impose de créditer le photographe.
    attribution: `${hit.user.name} / Unsplash`,
  }
}
