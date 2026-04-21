'use client'

import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CardEditDialog } from '@/components/card-edit-dialog'
import type { AnamneseCard } from '@/lib/types'

export function EditCardButton({ card }: { card: AnamneseCard }) {
  const router = useRouter()
  return (
    <CardEditDialog card={card} onSaved={() => router.refresh()}>
      <Button variant="ghost" size="icon-sm" aria-label={`Modifier ${card.term}`}>
        <Pencil className="text-muted-foreground" />
      </Button>
    </CardEditDialog>
  )
}
