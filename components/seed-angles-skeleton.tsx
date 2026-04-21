export function SeedAnglesSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        </div>
        <div className="mt-3 h-3 w-full animate-pulse rounded bg-muted" />
        <div className="mt-1 h-3 w-5/6 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-4 w-12 animate-pulse rounded bg-muted" />
            </div>
            <div className="mt-2 h-3 w-full animate-pulse rounded bg-muted" />
            <div className="mt-1 h-3 w-3/4 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}
