import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { DeleteCardButton } from '@/components/delete-card-button'
import { listCards, listAllTags } from '@/app/actions/cards'
import { deriveMode, isDue } from '@/lib/fsrs/mode'

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>
}) {
  const { tag } = await searchParams
  const [cards, tags] = await Promise.all([listCards({ tag }), listAllTags()])
  const now = new Date()
  const dueCount = cards.filter((c) => isDue(c.fsrs_state, now)).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Cartes</h1>
          <p className="text-sm text-muted-foreground">
            {cards.length} {cards.length <= 1 ? 'carte' : 'cartes'}
            {dueCount > 0 && <> · {dueCount} à réviser</>}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            + Nouvelle
          </Link>
          {dueCount > 0 && (
            <Link href="/review" className={buttonVariants({ size: 'sm' })}>
              Réviser ({dueCount})
            </Link>
          )}
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <Link href="/cards">
            <Badge variant={tag ? 'outline' : 'default'}>Tous</Badge>
          </Link>
          {tags.map((t) => (
            <Link key={t} href={`/cards?tag=${encodeURIComponent(t)}`}>
              <Badge variant={tag === t ? 'default' : 'outline'}>{t}</Badge>
            </Link>
          ))}
        </div>
      )}

      {cards.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <p>Aucune carte {tag ? `avec le tag « ${tag} »` : 'pour le moment'}.</p>
          <Link href="/" className={buttonVariants({ variant: 'link' }) + ' mt-2 inline-block'}>
            Créer la première
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {cards.map((card) => {
            const due = isDue(card.fsrs_state, now)
            const mode = deriveMode(card.fsrs_state)
            return (
              <li
                key={card.id}
                className="rounded-lg border p-3 sm:p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{card.term}</h3>
                      {due && <Badge variant="destructive">À réviser</Badge>}
                      <Badge variant="outline" className="text-xs">
                        {mode === 'typing' ? 'Saisie' : 'QCM'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {card.definition}
                    </p>
                    {card.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {card.tags.map((t) => (
                          <Badge key={t} variant="secondary" className="text-xs">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-start gap-1">
                    <Link
                      href={`/cards/${card.id}/edit`}
                      className={buttonVariants({
                        variant: 'ghost',
                        size: 'sm',
                      })}
                    >
                      Modifier
                    </Link>
                    <DeleteCardButton cardId={card.id} term={card.term} />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
