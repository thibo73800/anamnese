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
        Idées à explorer
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {themes.map((t) => (
          <Link
            key={t.label}
            href={`/explore?theme=${encodeURIComponent(t.label)}`}
            className="group rounded-lg border p-3 transition-colors hover:bg-accent"
          >
            <div className="text-sm font-medium leading-snug">{t.label}</div>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {t.rationale}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
