import { SeedInput } from '@/components/seed-input'
import { VolatileConfigurator } from '@/components/volatile-configurator'

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string }>
}) {
  const { theme } = await searchParams
  const trimmed = theme?.trim()

  if (trimmed) {
    return <VolatileConfigurator theme={trimmed} />
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 pt-10 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Explorer</h1>
        <p className="text-sm text-muted-foreground">
          Tape un sujet, on te propose des angles pour l&apos;attaquer puis on
          génère un test volatile.
        </p>
      </div>
      <SeedInput />
      <p className="text-xs text-muted-foreground">
        Exemples : planètes du système solaire, histoire de l&apos;imprimerie,
        théorème de Pythagore…
      </p>
    </div>
  )
}
