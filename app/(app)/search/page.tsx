import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SearchBar } from '@/components/search-bar'
import { SearchResult } from '@/components/search-result'
import { explainTheme } from '@/lib/anthropic/theme'
import { findImage } from '@/lib/images'

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  if (!q || !q.trim()) redirect('/')

  return (
    <div className="space-y-6">
      <SearchBar initialValue={q} />
      <Suspense fallback={<SearchSkeleton />}>
        <SearchResultLoader theme={q} />
      </Suspense>
      <div className="pt-2">
        <Link href="/" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          ← Nouvelle recherche
        </Link>
      </div>
    </div>
  )
}

async function SearchResultLoader({ theme }: { theme: string }) {
  let explanation
  try {
    explanation = await explainTheme(theme)
  } catch (err) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <p className="font-medium">Impossible de générer l&apos;explication.</p>
        <p className="text-muted-foreground">
          {err instanceof Error ? err.message : 'Erreur inconnue'}
        </p>
      </div>
    )
  }

  const image = explanation.needsImage && explanation.imageQuery
    ? await findImage(explanation.imageQuery)
    : null

  return (
    <SearchResult
      theme={theme}
      initialExplanation={explanation.explanation}
      cardInitial={{
        term: explanation.card.term,
        definition: explanation.card.definition,
        tags: explanation.card.suggestedTags,
        theme,
        distractors: explanation.card.distractors,
        image_url: image?.url ?? null,
        image_source: image?.source ?? null,
        image_attribution: image?.attribution ?? null,
        explanation: explanation.explanation,
      }}
    />
  )
}

function SearchSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-60 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}
