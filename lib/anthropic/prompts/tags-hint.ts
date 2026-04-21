export function formatExistingTagsHint(existingTags: string[]): string {
  if (existingTags.length === 0) {
    return "L'utilisateur n'a encore aucun tag dans sa collection."
  }
  return [
    "Tags déjà présents dans la collection de l'utilisateur (à réutiliser en priorité) :",
    existingTags.join(', '),
    '',
    'Règle de réutilisation :',
    "- Si un tag existant correspond raisonnablement au thème de la carte, **réutilise-le tel quel** (même orthographe exacte).",
    "- Ne propose un nouveau tag **que si** la carte s'écarte nettement des thèmes couverts par les tags existants.",
    "- N'introduis pas de variante orthographique d'un tag existant (pas `renaissance-italienne` si `renaissance` existe déjà).",
  ].join('\n')
}
