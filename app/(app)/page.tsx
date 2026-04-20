import { SearchBar } from '@/components/search-bar'

export default function HomePage() {
  return (
    <div className="space-y-6 pt-8 sm:pt-16">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Anamnèse
        </h1>
        <p className="text-muted-foreground">
          Tape un thème. On t&apos;explique, puis on en fait une flashcard.
        </p>
      </div>
      <SearchBar />
    </div>
  )
}
