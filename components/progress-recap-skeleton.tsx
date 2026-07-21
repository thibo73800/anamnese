export function ProgressRecapSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-5 w-28 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="space-y-4 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
        <div className="space-y-2">
          <div className="h-3 w-full animate-pulse rounded-full bg-muted" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-24 w-full animate-pulse rounded bg-muted" />
      </div>
    </div>
  )
}
