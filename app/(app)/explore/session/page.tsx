import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import {
  consumeSuggestedTheme,
  startVolatileSession,
} from '@/app/actions/suggestions'
import { VolatileReviewSession } from '@/components/volatile-review-session'

export default async function VolatileSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string; count?: string }>
}) {
  const { theme: rawTheme, count: rawCount } = await searchParams
  const theme = rawTheme?.trim()
  const parsed = parseInt(rawCount ?? '15', 10)
  const count = Math.max(10, Math.min(30, Number.isFinite(parsed) ? parsed : 15))

  if (!theme) {
    return (
      <div className="space-y-4 pt-10 text-center">
        <p className="text-muted-foreground">Aucun thème fourni.</p>
        <Link href="/" className={buttonVariants({ variant: 'outline' })}>
          Retour à l&apos;accueil
        </Link>
      </div>
    )
  }

  let cards
  let sharedTags: string[] = []
  let errorMessage: string | null = null
  try {
    const res = await startVolatileSession({ theme, count })
    cards = res.cards
    sharedTags = res.sharedTags
    await consumeSuggestedTheme({ label: theme }).catch(() => {
      /* snapshot may not exist (fallback mode); ignore */
    })
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'Erreur inconnue'
  }

  if (errorMessage || !cards) {
    return (
      <div className="mx-auto max-w-lg space-y-4 pt-10 text-center">
        <h1 className="text-xl font-semibold">Génération impossible</h1>
        <p className="text-sm text-muted-foreground">
          {errorMessage ?? 'Erreur inconnue'}
        </p>
        <div className="flex justify-center gap-2">
          <Link
            href={`/explore?theme=${encodeURIComponent(theme)}`}
            className={buttonVariants({ variant: 'outline' })}
          >
            Réessayer
          </Link>
          <Link href="/" className={buttonVariants()}>
            Retour
          </Link>
        </div>
      </div>
    )
  }

  return (
    <VolatileReviewSession
      theme={theme}
      count={count}
      initialCards={cards}
      initialSharedTags={sharedTags}
    />
  )
}
