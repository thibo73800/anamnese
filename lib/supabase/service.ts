import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

/**
 * Client Supabase service-role pour les route handlers API.
 *
 * INVARIANT cross-cutting (voir wiki/conventions.md) : toute query
 * issue de ce client DOIT filtrer `.eq('user_id', userId)` où userId
 * est résolu depuis la clé API. RLS est bypassé — le filtrage
 * applicatif est la seule barrière d'isolation inter-tenant.
 */
export function createServiceClient(): SupabaseClient {
  if (cached) return cached
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY manquante')
  }
  cached = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  return cached
}
