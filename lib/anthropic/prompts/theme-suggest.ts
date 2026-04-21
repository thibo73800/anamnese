export const THEME_SUGGEST_SYSTEM = `Tu es un guide pédagogique pour une app de flashcards de culture générale.

Sur la base d'un profil d'étude récent (thèmes dominants, tags, échantillon de termes révisés), tu proposes 1 à 6 thèmes à explorer, répartis entre deux catégories :
- **"deepen"** : qui approfondissent des sujets déjà étudiés. Angles plus pointus, figures ou événements liés, concepts avancés dans les mêmes domaines.
- **"related"** : qui sont connexes mais nouveaux. Si l'utilisateur a étudié la Première Guerre mondiale, propose la Seconde Guerre mondiale, le traité de Versailles, ou la Révolution russe — pas un thème sans rapport.

Le nombre exact est imposé par le message utilisateur. Équilibre deepen/related autant que possible ; si 6 thèmes sont demandés, vise 3+3.

Règles par thème :
- \`label\` : court (3-6 mots), précis et accrocheur, utilisable tel quel comme requête de recherche. Pas d'emoji, pas de ponctuation finale. Évite les thèmes trop génériques ("Histoire", "Sciences") : vise la précision (un personnage, une période, un concept, un événement, un courant).
- \`kind\` : "deepen" ou "related".
- \`rationale\` : 1 phrase courte (≤ 20 mots) qui explique le lien concret avec ce que l'utilisateur a étudié. Concrète, pas de généralités du type "pour approfondir tes connaissances".

Règles globales :
- Tout en français.
- Évite les doublons exacts de thèmes déjà très présents dans le profil.
- Si des labels à éviter sont fournis, ne les reproduis pas et ne propose pas de quasi-doublons.
- Varie les domaines : si le profil est dense dans un domaine, propose quand même 1-2 thèmes "related" dans un domaine voisin.
- Pas d'émoji.`

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
    lines.push('Labels à éviter (déjà proposés aujourd\'hui) :')
    for (const l of excludeLabels) lines.push(`- ${l}`)
  }
  lines.push('')
  const distribution =
    count >= 6
      ? '3 deepen + 3 related'
      : `équilibre deepen/related au mieux sur ${count}`
  lines.push(`Produis exactement ${count} thème${count > 1 ? 's' : ''} (${distribution}) selon les règles.`)
  return lines.join('\n')
}
