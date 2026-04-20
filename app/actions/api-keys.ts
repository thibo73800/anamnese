'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { generateApiKey } from '@/lib/api-auth/keygen'

export interface ApiKeyRow {
  id: string
  label: string
  prefix: string
  last4: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

async function currentUserId() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  return { supabase, userId: user.id }
}

export async function listApiKeys(): Promise<ApiKeyRow[]> {
  const { supabase, userId } = await currentUserId()
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, label, prefix, last4, created_at, last_used_at, revoked_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as ApiKeyRow[]
}

const createLabelSchema = z.string().min(1).max(80)

export async function createApiKey(
  label: string,
): Promise<{ rawKey: string; row: ApiKeyRow }> {
  const parsedLabel = createLabelSchema.parse(label.trim())
  const { supabase, userId } = await currentUserId()
  const gen = await generateApiKey()
  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      user_id: userId,
      label: parsedLabel,
      key_hash: gen.keyHash,
      prefix: gen.prefix,
      last4: gen.last4,
    })
    .select('id, label, prefix, last4, created_at, last_used_at, revoked_at')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Création clé impossible')
  revalidatePath('/settings/api-keys')
  return { rawKey: gen.rawKey, row: data as ApiKeyRow }
}

export async function revokeApiKey(id: string): Promise<void> {
  const { supabase, userId } = await currentUserId()
  const { error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
  revalidatePath('/settings/api-keys')
}
