const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const RAW_LENGTH = 32
export const API_KEY_PREFIX = 'ana_sk_'
export const API_KEY_REGEX = /^ana_sk_[0-9A-HJKMNP-TV-Z]{32}$/

export interface GeneratedKey {
  rawKey: string
  keyHash: string
  prefix: string
  last4: string
}

/**
 * Génère une clé `ana_sk_<32 Crockford base32>` (160 bits d'entropie)
 * et son hash SHA-256 (hex). La valeur brute ne doit apparaître que
 * dans la réponse `createApiKey` — jamais stockée.
 */
export async function generateApiKey(): Promise<GeneratedKey> {
  const bytes = new Uint8Array(RAW_LENGTH)
  crypto.getRandomValues(bytes)
  let random = ''
  for (let i = 0; i < RAW_LENGTH; i++) {
    random += CROCKFORD_ALPHABET[bytes[i] % 32]
  }
  const rawKey = `${API_KEY_PREFIX}${random}`
  const keyHash = await sha256Hex(rawKey)
  return {
    rawKey,
    keyHash,
    prefix: `${API_KEY_PREFIX}${random.slice(0, 4)}`,
    last4: random.slice(-4),
  }
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input),
  )
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
