import type { ImageHit } from '@/lib/types'
import { searchWikimedia } from './wikimedia'
import { searchUnsplash } from './unsplash'
import { searchGoogle } from './google'

/**
 * Pipeline hybride: Wikimedia (gratuit) → Unsplash (gratuit, clé) → Google CSE (quota 100/j).
 * Retourne le premier hit non nul. null si aucune source ne renvoie rien.
 */
export async function findImage(query: string): Promise<ImageHit | null> {
  const q = query.trim()
  if (!q) return null

  try {
    const wiki = await searchWikimedia(q)
    if (wiki) return wiki
  } catch (e) {
    console.warn('wikimedia error', e)
  }

  try {
    const uns = await searchUnsplash(q)
    if (uns) return uns
  } catch (e) {
    console.warn('unsplash error', e)
  }

  try {
    const g = await searchGoogle(q)
    if (g) return g
  } catch (e) {
    console.warn('google cse error', e)
  }

  return null
}
