import type { ImageHit } from '@/lib/types'

/**
 * Recherche Wikimedia Commons. Pas de clé requise.
 * On utilise le générateur `search` pour trouver un fichier, puis on demande imageinfo
 * pour récupérer l'URL et le crédit.
 */
export async function searchWikimedia(query: string): Promise<ImageHit | null> {
  const url = new URL('https://commons.wikimedia.org/w/api.php')
  url.searchParams.set('action', 'query')
  url.searchParams.set('format', 'json')
  url.searchParams.set('generator', 'search')
  url.searchParams.set('gsrsearch', `${query} filetype:bitmap|drawing`)
  url.searchParams.set('gsrlimit', '3')
  url.searchParams.set('gsrnamespace', '6') // File namespace
  url.searchParams.set('prop', 'imageinfo')
  url.searchParams.set('iiprop', 'url|extmetadata|size')
  url.searchParams.set('iiurlwidth', '800')
  url.searchParams.set('origin', '*')

  const res = await fetch(url, {
    headers: { 'User-Agent': 'AnamneseApp/1.0 (https://anamnese.app)' },
    next: { revalidate: 60 * 60 * 24 },
  })
  if (!res.ok) return null

  const data = (await res.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          title: string
          imageinfo?: Array<{
            url: string
            thumburl?: string
            width: number
            height: number
            extmetadata?: { Artist?: { value?: string }; LicenseShortName?: { value?: string } }
          }>
        }
      >
    }
  }

  const pages = Object.values(data.query?.pages ?? {})
  for (const p of pages) {
    const info = p.imageinfo?.[0]
    if (!info) continue
    if (info.width < 320) continue // trop petit pour être utile
    const artist = stripHtml(info.extmetadata?.Artist?.value ?? '')
    const license = info.extmetadata?.LicenseShortName?.value ?? ''
    return {
      url: info.thumburl ?? info.url,
      source: 'wikimedia',
      attribution: [artist, license].filter(Boolean).join(' · ') || 'Wikimedia Commons',
    }
  }
  return null
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}
