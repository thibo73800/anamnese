import { Suspense } from 'react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { SeedInput } from '@/components/seed-input'
import { SeedAngles } from '@/components/seed-angles'
import { SeedAnglesSkeleton } from '@/components/seed-angles-skeleton'

export default async function ExploreAnglesPage({
  searchParams,
}: {
  searchParams: Promise<{ seed?: string }>
}) {
  const { seed } = await searchParams
  const trimmed = seed?.trim()

  if (!trimmed || trimmed.length < 2) {
    return (
      <div className="mx-auto max-w-xl space-y-6 pt-10 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Explorer</h1>
          <p className="text-sm text-muted-foreground">
            Tape un sujet, on te propose des angles pour l&apos;attaquer.
          </p>
        </div>
        <SeedInput />
        <Link
          href="/"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pt-6">
      <header className="space-y-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Explorer
          </p>
          <h1 className="text-2xl font-semibold leading-tight">
            Angles pour « {trimmed} »
          </h1>
        </div>
        <SeedInput initialValue={trimmed} />
      </header>
      <Suspense fallback={<SeedAnglesSkeleton />}>
        <SeedAngles seed={trimmed} />
      </Suspense>
    </div>
  )
}
