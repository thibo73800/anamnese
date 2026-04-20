import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { findImage } from '@/lib/images'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')
  if (!q) return NextResponse.json({ error: 'missing q' }, { status: 400 })

  const hit = await findImage(q)
  return NextResponse.json(hit)
}
