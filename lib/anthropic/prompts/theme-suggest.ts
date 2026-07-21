export const THEME_SUGGEST_SYSTEM = `Tu es un guide de culture générale pour une app de flashcards.

À partir d'un profil d'étude récent (thèmes dominants, tags, termes révisés), tu proposes des sujets à explorer. Pour chaque centre d'intérêt du profil, remonte vers la grande catégorie de culture générale qui l'englobe : le vaste sujet universel "à connaître" dont ce centre d'intérêt n'est qu'un exemple.

Exemples :
- Titien, Ingres → "Les grands artistes de la Renaissance"
- Les boyards → "Les tsars de Russie"
- Ray Kurzweil → "Les figures majeures de l'intelligence artificielle"

Vise le niveau d'un grand rayon de culture générale : un domaine, une civilisation, un ensemble de grandes figures, un mouvement majeur — quelque chose qu'une personne cultivée situe immédiatement.

Chaque sujet :
- \`label\` : 3 à 6 mots nommant une grande catégorie claire, utilisable telle quelle comme requête de recherche.
- \`rationale\` : une phrase courte (≤ 20 mots) reliant la catégorie à un élément précis du profil.

Couvre des domaines variés. Propose des sujets nouveaux, distincts du profil et des sujets déjà proposés. Écris en français.`

export interface ProfileSummary {
  topThemes: string[]
  topTags: string[]
  recentTerms: string[]
  totalCards: number
}

export function THEME_SUGGEST_USER(params: {
  profile: ProfileSummary
  count: number
  excludeLabels?: string[]
}): string {
  const { profile, count, excludeLabels = [] } = params
  const lines: string[] = []
  lines.push(
    `Profil d'étude récent (${profile.totalCards} carte${profile.totalCards > 1 ? 's' : ''} révisée${profile.totalCards > 1 ? 's' : ''}) :`,
  )
  if (profile.topThemes.length > 0) {
    lines.push('')
    lines.push('Thèmes dominants :')
    for (const t of profile.topThemes) lines.push(`- ${t}`)
  }
  if (profile.topTags.length > 0) {
    lines.push('')
    lines.push('Tags dominants :')
    lines.push(profile.topTags.join(', '))
  }
  if (profile.recentTerms.length > 0) {
    lines.push('')
    lines.push('Échantillon de termes récemment révisés :')
    for (const t of profile.recentTerms) lines.push(`- ${t}`)
  }
  if (excludeLabels.length > 0) {
    lines.push('')
    lines.push('Sujets déjà proposés aujourd\'hui (propose-en de nouveaux) :')
    for (const l of excludeLabels) lines.push(`- ${l}`)
  }
  lines.push('')
  lines.push(`Produis exactement ${count} sujet${count > 1 ? 's' : ''} selon les règles.`)
  return lines.join('\n')
}
