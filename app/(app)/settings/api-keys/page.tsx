import { listApiKeys } from '@/app/actions/api-keys'
import { ApiKeysManager } from '@/components/settings/api-keys-manager'

export default async function ApiKeysPage() {
  const keys = await listApiKeys()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Clés API</h1>
        <p className="text-sm text-muted-foreground">
          Utilise ces clés pour créer ou modifier tes cartes depuis un client
          externe (par ex. le skill Claude Code).
        </p>
      </div>
      <ApiKeysManager initialKeys={keys} />
    </div>
  )
}
