import { Markdown } from '@/components/markdown'

export function ThemeExplanation({
  explanation,
  theme,
}: {
  explanation: string
  theme: string
}) {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Thème</p>
        <h2 className="text-2xl font-semibold">{theme}</h2>
      </div>
      <Markdown>{explanation}</Markdown>
    </section>
  )
}
