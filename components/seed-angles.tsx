import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { proposeAngles } from '@/app/actions/suggestions'

export async function SeedAngles({ seed }: { seed: string }) {
  let result: Awaited<ReturnType<typeof proposeAngles>>
  try {
    result = await proposeAngles({ seed })
  } catch (err) {
    console.error('[SeedAngles] proposeAngles failed', err)
    return (
      <div className="space-y-3 rounded-lg border p-4 text-center">
        <p className="text-sm text-muted-foreground">
          Impossible de générer des angles pour ce sujet. Réessaie dans un
          instant.
        </p>
        <Link
          href={`/explore/angles?seed=${encodeURIComponent(seed)}`}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Réessayer
        </Link>
      </div>
    )
  }

  if (result.kind === 'refused') {
    return (
      <div className="space-y-3 rounded-lg border p-4 text-center">
        <p className="text-sm text-muted-foreground">{result.reason}</p>
        <Link
          href="/explore"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Essayer un autre sujet
        </Link>
      </div>
    )
  }

  const main = result.themes.find((t) => t.kind === 'main') ?? result.themes[0]
  const angles = result.themes.filter((t) => t !== main)

  return (
    <div className="space-y-4">
      <Link
        href={`/explore?theme=${encodeURIComponent(main.label)}`}
        className="group block rounded-lg border bg-accent/30 p-4 transition-colors hover:bg-accent"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="text-base font-semibold leading-snug">
            {main.label}
          </div>
          <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-foreground/10 text-foreground">
            Thème principal
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{main.rationale}</p>
      </Link>

      <div className="grid gap-2 sm:grid-cols-2">
        {angles.map((t) => (
          <Link
            key={t.label}
            href={`/explore?theme=${encodeURIComponent(t.label)}`}
            className="group rounded-lg border p-3 transition-colors hover:bg-accent"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-medium leading-snug">{t.label}</div>
              <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                Angle
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {t.rationale}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
