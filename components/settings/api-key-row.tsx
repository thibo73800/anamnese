'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
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
import { revokeApiKey, type ApiKeyRow } from '@/app/actions/api-keys'

export function ApiKeyRowView({
  row,
  onChange,
}: {
  row: ApiKeyRow
  onChange: () => void
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const revoked = !!row.revoked_at

  const onRevoke = () => {
    startTransition(async () => {
      try {
        await revokeApiKey(row.id)
        setOpen(false)
        onChange()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erreur')
      }
    })
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border p-3 sm:p-4">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium">{row.label}</h3>
          {revoked && <Badge variant="destructive">Révoquée</Badge>}
        </div>
        <code className="block font-mono text-xs text-muted-foreground">
          {row.prefix}…{row.last4}
        </code>
        <p className="text-xs text-muted-foreground">
          Créée {formatRelative(row.created_at)}
          {' · '}
          {row.last_used_at
            ? `utilisée ${formatRelative(row.last_used_at)}`
            : 'jamais utilisée'}
        </p>
      </div>
      {!revoked && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button variant="ghost" size="sm" />}>
            Révoquer
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Révoquer la clé ?</DialogTitle>
              <DialogDescription>
                « {row.label} » ne pourra plus être utilisée. Cette action est
                irréversible.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" disabled={isPending} />}>
                Annuler
              </DialogClose>
              <Button variant="destructive" onClick={onRevoke} disabled={isPending}>
                {isPending ? 'Révocation…' : 'Révoquer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </li>
  )
}

function formatRelative(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diff = Math.max(0, now - then)
  const min = 60_000
  const hr = 3600_000
  const day = 86400_000
  if (diff < min) return "à l'instant"
  if (diff < hr) return `il y a ${Math.floor(diff / min)} min`
  if (diff < day) return `il y a ${Math.floor(diff / hr)} h`
  if (diff < 30 * day) return `il y a ${Math.floor(diff / day)} j`
  return `le ${new Date(iso).toLocaleDateString('fr-FR')}`
}
