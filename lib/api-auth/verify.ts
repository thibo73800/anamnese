import { createServiceClient } from '@/lib/supabase/service'
import { API_KEY_REGEX, sha256Hex } from './keygen'

export class ApiAuthError extends Error {
  constructor(
    public code: 'missing_api_key' | 'invalid_api_key' | 'revoked_api_key',
    message: string,
  ) {
    super(message)
    this.name = 'ApiAuthError'
  }
}

export interface ApiKeyContext {
  userId: string
  keyId: string
}

/**
 * Vérifie l'en-tête `Authorization: Bearer ana_sk_...` d'une requête.
 * - Format invalide / absent → throw ApiAuthError (401).
 * - Clé inconnue ou révoquée → throw ApiAuthError (401).
 * - Met à jour `last_used_at` en fire-and-forget (ne bloque pas la réponse).
 */
export async function verifyApiKey(req: Request): Promise<ApiKeyContext> {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization')
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    throw new ApiAuthError('missing_api_key', 'Header Authorization manquant')
  }
  const raw = header.slice(7).trim()
  if (!API_KEY_REGEX.test(raw)) {
    throw new ApiAuthError('invalid_api_key', 'Format de clé invalide')
  }

  const keyHash = await sha256Hex(raw)
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, user_id, revoked_at')
    .eq('key_hash', keyHash)
    .maybeSingle()

  if (error) throw new ApiAuthError('invalid_api_key', error.message)
  if (!data) throw new ApiAuthError('invalid_api_key', 'Clé inconnue')
  if (data.revoked_at) {
    throw new ApiAuthError('revoked_api_key', 'Clé révoquée')
  }

  void supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => undefined)

  return { userId: data.user_id, keyId: data.id }
}
