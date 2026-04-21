import Link from 'next/link'
import { getSuggestedThemes } from '@/app/actions/suggestions'

export async function SuggestedThemes() {
  let themes
  try {
    themes = await getSuggestedThemes()
  } catch (err) {
    console.error('[SuggestedThemes] getSuggestedThemes failed', err)
    return null
  }
  if (themes.length === 0) return null

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        Idées pour approfondir
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {themes.map((t) => (
          <Link
            key={t.label}
            href={`/explore?theme=${encodeURIComponent(t.label)}`}
            className="group rounded-lg border p-3 transition-colors hover:bg-accent"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-medium leading-snug">{t.label}</div>
              <span
                className={
                  'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ' +
                  (t.kind === 'deepen'
                    ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300')
                }
              >
                {t.kind === 'deepen' ? 'Approfondir' : 'Connexe'}
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
