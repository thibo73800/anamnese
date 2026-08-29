'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { deleteCard } from '@/app/actions/cards'

type Props = {
  cardId: string
  term: string
  /**
   * Called after a successful delete. When provided, the caller owns the
   * post-delete update (e.g. removing the card from a client-side review
   * queue) and the default `router.refresh()` is skipped.
   */
  onDeleted?: (cardId: string) => void
}

export function DeleteCardButton({ cardId, term, onDeleted }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const onConfirm = () => {
    startTransition(async () => {
      try {
        await deleteCard(cardId)
        setOpen(false)
        if (onDeleted) onDeleted(cardId)
        else router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erreur')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Supprimer ${term}`}
          />
        }
      >
        <Trash2 className="text-muted-foreground" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer la carte ?</DialogTitle>
          <DialogDescription>
            « {term} » sera supprimée définitivement. Cette action est irréversible.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>
            Annuler
          </DialogClose>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Suppression…' : 'Supprimer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
