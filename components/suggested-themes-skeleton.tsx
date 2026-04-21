export function SuggestedThemesSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-4 w-48 animate-pulse rounded bg-muted" />
      <div className="grid gap-2 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
            </div>
            <div className="mt-2 h-3 w-full animate-pulse rounded bg-muted" />
            <div className="mt-1 h-3 w-3/4 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}
