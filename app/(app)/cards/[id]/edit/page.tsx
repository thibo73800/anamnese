import Link from 'next/link'
import { notFound } from 'next/navigation'
import { buttonVariants } from '@/components/ui/button'
import { CardEditor } from '@/components/card-editor'
import { createClient } from '@/lib/supabase/server'
import type { AnamneseCard } from '@/lib/types'

export default async function EditCardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !data) notFound()
  const card = data as AnamneseCard

  return (
    <div className="space-y-4">
      <Link
        href="/cards"
        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
      >
        ← Retour aux cartes
      </Link>
      <CardEditor
        mode={{ kind: 'edit', cardId: card.id }}
        initial={{
          term: card.term,
          definition: card.definition,
          tags: card.tags,
          theme: card.theme,
          distractors: card.qcm_choices.distractors,
          image_url: card.image_url,
          image_source: card.image_source,
          image_attribution: card.image_attribution,
          explanation: card.explanation,
        }}
      />
    </div>
  )
}
