import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ApiAuthError, verifyApiKey } from '@/lib/api-auth/verify'
import { createServiceClient } from '@/lib/supabase/service'

export interface ApiRouteCtx {
  userId: string
  keyId: string
  supabase: SupabaseClient
}

export type ApiRouteHandler = (
  request: Request,
  ctx: ApiRouteCtx,
) => Promise<Response>

export function apiError(
  code: string,
  message: string,
  status: number,
): Response {
  return NextResponse.json({ error: { code, message } }, { status })
}

export function withApiKey(fn: ApiRouteHandler) {
  return async (request: Request): Promise<Response> => {
    try {
      const auth = await verifyApiKey(request)
      const supabase = createServiceClient()
      return await fn(request, { ...auth, supabase })
    } catch (err) {
      return handleError(err)
    }
  }
}

export function handleError(err: unknown): Response {
  if (err instanceof ApiAuthError) {
    return apiError(err.code, err.message, 401)
  }
  if (err instanceof ZodError) {
    return apiError('validation_error', formatZodError(err), 422)
  }
  if (err instanceof Error) {
    return apiError('internal_error', err.message, 500)
  }
  return apiError('internal_error', 'Erreur inconnue', 500)
}

function formatZodError(err: ZodError): string {
  return err.issues
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ')
}
