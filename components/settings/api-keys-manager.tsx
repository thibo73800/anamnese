'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { ApiKeyRow } from '@/app/actions/api-keys'
import { CreateKeyDialog } from './create-key-dialog'
import { ApiKeyRowView } from './api-key-row'

export function ApiKeysManager({ initialKeys }: { initialKeys: ApiKeyRow[] }) {
  const router = useRouter()
  const [openCreate, setOpenCreate] = useState(false)

  const refresh = () => router.refresh()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {initialKeys.length} {initialKeys.length <= 1 ? 'clé' : 'clés'}
        </p>
        <Button size="sm" onClick={() => setOpenCreate(true)}>
          Créer une clé
        </Button>
      </div>

      {initialKeys.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Aucune clé API pour le moment.
        </div>
      ) : (
        <ul className="space-y-2">
          {initialKeys.map((k) => (
            <ApiKeyRowView key={k.id} row={k} onChange={refresh} />
          ))}
        </ul>
      )}

      <CreateKeyDialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        onCreated={refresh}
      />
    </div>
  )
}
