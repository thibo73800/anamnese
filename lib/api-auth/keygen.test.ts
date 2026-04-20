import { describe, it, expect } from 'vitest'
import {
  API_KEY_PREFIX,
  API_KEY_REGEX,
  generateApiKey,
  sha256Hex,
} from './keygen'

describe('generateApiKey', () => {
  it('produit une clé au format `ana_sk_<32>` accepté par la regex', async () => {
    const { rawKey } = await generateApiKey()
    expect(rawKey.startsWith(API_KEY_PREFIX)).toBe(true)
    expect(rawKey.length).toBe(API_KEY_PREFIX.length + 32)
    expect(API_KEY_REGEX.test(rawKey)).toBe(true)
  })

  it('produit des clés distinctes à chaque appel', async () => {
    const [a, b] = await Promise.all([generateApiKey(), generateApiKey()])
    expect(a.rawKey).not.toBe(b.rawKey)
    expect(a.keyHash).not.toBe(b.keyHash)
  })

  it('retourne un prefix et last4 alignés avec la raw key', async () => {
    const { rawKey, prefix, last4 } = await generateApiKey()
    expect(rawKey.startsWith(prefix)).toBe(true)
    expect(rawKey.endsWith(last4)).toBe(true)
    expect(prefix.length).toBe(API_KEY_PREFIX.length + 4)
    expect(last4.length).toBe(4)
  })

  it('hash = sha256(rawKey) reproductible', async () => {
    const { rawKey, keyHash } = await generateApiKey()
    const recomputed = await sha256Hex(rawKey)
    expect(recomputed).toBe(keyHash)
    expect(keyHash.length).toBe(64) // 32 bytes hex
  })
})

describe('API_KEY_REGEX', () => {
  it('rejette les formats invalides', () => {
    expect(API_KEY_REGEX.test('')).toBe(false)
    expect(API_KEY_REGEX.test('ana_sk_')).toBe(false)
    expect(API_KEY_REGEX.test('ana_sk_ABCDEFGHJKMNPQRSTVWXYZ01234567890')).toBe(false) // 33 chars
    expect(API_KEY_REGEX.test('ana_sk_ABCDEFGHJKMNPQRSTVWXYZ012345678')).toBe(false) // 31 chars
    expect(API_KEY_REGEX.test('ana_sk_ABCDEFGHJKMNPQRSTVWXYZ012345678L')).toBe(false) // 'L' absent de Crockford
    expect(API_KEY_REGEX.test('bearer ana_sk_ABCDEFGHJKMNPQRSTVWXYZ0123456789')).toBe(false)
  })
})
