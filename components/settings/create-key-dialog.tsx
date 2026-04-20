'use client'

import { useState, useTransition } from 'react'
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
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createApiKey } from '@/app/actions/api-keys'

export function CreateKeyDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}) {
  const [label, setLabel] = useState('')
  const [rawKey, setRawKey] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const reset = () => {
    setLabel('')
    setRawKey(null)
  }

  const handleOpenChange = (v: boolean) => {
    if (!v) reset()
    onOpenChange(v)
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      try {
        const { rawKey } = await createApiKey(label)
        setRawKey(rawKey)
        onCreated()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erreur')
      }
    })
  }

  const copy = async () => {
    if (!rawKey) return
    await navigator.clipboard.writeText(rawKey)
    toast.success('Clé copiée')
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {rawKey ? (
          <>
            <DialogHeader>
              <DialogTitle>Ta clé API</DialogTitle>
              <DialogDescription>
                Copie-la maintenant — elle ne sera plus jamais affichée.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-md border bg-muted/50 p-3">
              <code className="block font-mono text-xs break-all">{rawKey}</code>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={copy}>
                Copier
              </Button>
              <DialogClose render={<Button />}>J&apos;ai copié</DialogClose>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>Créer une clé API</DialogTitle>
              <DialogDescription>
                Donne un nom à la clé pour la reconnaître plus tard (par ex.
                « claude-code-dev », « shortcut-iphone »).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="label">Nom</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="claude-code-dev"
                maxLength={80}
                required
                autoFocus
              />
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" disabled={isPending} />}>
                Annuler
              </DialogClose>
              <Button type="submit" disabled={isPending || !label.trim()}>
                {isPending ? 'Création…' : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
