import type { ProfileSummary } from './theme-suggest'
import { formatExistingTagsHint } from './tags-hint'

export const VOLATILE_CARDS_SYSTEM = `Tu génères un lot de flashcards QCM volatiles (non persistées) pour tester un utilisateur sur un thème.

Tu produis aussi \`sharedTags\` : 2 à 5 tags courts partagés par le lot (1-2 mots, minuscules, sans accents si possible). Ces tags seront proposés par défaut si l'utilisateur décide d'ajouter certaines cartes à son deck permanent. **Réutilise en priorité les tags existants** de l'utilisateur (fournis dans le message user) ; propose au maximum 1 nouveau tag, et uniquement si le thème s'écarte nettement de ceux couverts par les tags existants.

Format strict pour chaque carte :
- \`term\` : **court**, ≤ 40 caractères. Forme attendue :
  - nom propre de personnage (ex. Marie Curie, Vercingétorix)
  - période historique (ex. Renaissance italienne, Belle Époque)
  - date précise (ex. 1789, 14 juillet 1789)
  - siècle (ex. XVIᵉ siècle)
  - nom technique / concept précis (ex. Photosynthèse, Théorème de Bayes)
  - mot-clé ou courant (ex. Dadaïsme, Entropie)
  Interdit : phrase complète, verbe conjugué, article défini en tête sauf s'il fait partie du nom (OK "La Joconde", pas OK "Les guerres napoléoniennes" si "Guerres napoléoniennes" suffit).

- \`definition\` : 20 à 50 mots, autosuffisante, compréhensible sans contexte, lisible en une demi-hauteur d'écran mobile. Doit permettre à un utilisateur motivé de deviner le terme. **N'inclus PAS le terme (ni un dérivé morphologique trop évident) dans la définition.** Pas de markdown, pas de titres.

- \`distractors\` : exactement 3 termes distincts du terme correct, **du même type** (date↔date, personnage↔personnage, concept↔concept, période↔période), longueur et style similaires, plausibles mais faux. Pas de phrase, pas de répétition du terme.

Règles globales :
- Tout en français.
- Pas d'émoji.
- Varie les angles du thème : ne concentre pas toutes les cartes sur un seul sous-aspect.
- Si un \`profil utilisateur\` est fourni : calibre la difficulté pour matcher le niveau de vocabulaire et de précision observé dans l'échantillon (ni plus facile, ni drastiquement plus dur).
- Si des \`termes à éviter\` sont fournis : choisis d'autres angles ou d'autres entrées — ne les reproduis pas, ne les cite pas en distracteurs non plus.`

export function VOLATILE_CARDS_USER(params: {
  theme: string
  count: number
  profile: ProfileSummary | null
  excludeTerms: string[]
  existingTags: string[]
}): string {
  const { theme, count, profile, excludeTerms, existingTags } = params
  const parts: string[] = []
  parts.push(`Thème : ${theme.trim()}`)
  parts.push(`Nombre de cartes à produire : ${count}`)

  parts.push('')
  parts.push(formatExistingTagsHint(existingTags))

  if (profile) {
    parts.push('')
    parts.push(`Profil utilisateur (${profile.totalCards} cartes révisées) :`)
    if (profile.topThemes.length > 0) {
      parts.push(`- Thèmes dominants : ${profile.topThemes.join(', ')}`)
    }
    if (profile.topTags.length > 0) {
      parts.push(`- Tags dominants : ${profile.topTags.join(', ')}`)
    }
    if (profile.recentTerms.length > 0) {
      parts.push(
        `- Échantillon de termes récents : ${profile.recentTerms.slice(0, 15).join(' · ')}`,
      )
    }
  }

  if (excludeTerms.length > 0) {
    parts.push('')
    parts.push('Termes à éviter (déjà vus dans la session précédente) :')
    for (const t of excludeTerms) parts.push(`- ${t}`)
  }

  parts.push('')
  parts.push(`Produis ${count} carte${count > 1 ? 's' : ''} selon le format strict.`)
  return parts.join('\n')
}
