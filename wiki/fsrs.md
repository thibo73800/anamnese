# FSRS & modes de révision

## Lib

[`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs) (FSRS-4.5), wrapper minimal dans [`lib/fsrs/engine.ts`](../lib/fsrs/engine.ts).

## API interne

```ts
initCard(now?: Date): Card                    // nouvelle carte, state = New
reviewCard(state, rating, now?)               // applique le rating → { card, previous }
  // rating ∈ {1,2,3,4} = Again | Hard | Good | Easy
normalizeCard(raw): Card                      // remet les Date en Date après round-trip JSONB
```

Paramètres FSRS :
- `enable_fuzz: true` — ajoute un peu de bruit aléatoire aux intervalles pour éviter que plein de cartes tombent le même jour
- Tout le reste = defaults (`request_retention: 0.9`, `maximum_interval: 36500`, decay FSRS-5)

## JSON round-trip

`Card` a des `Date`, `ts-fsrs` les sérialise en string ISO dans `JSON.stringify`. Au `SELECT` Supabase on récupère des strings. `normalizeCard` convertit `due` / `last_review` en `Date` et `state` text → enum int avant de rappeler `scheduler.next()`.

Si tu édites manuellement `fsrs_state` (debug), garde ce format — toute string non ISO-8601 fera planter `new Date(…)`.

## Seuil QCM → saisie

[`lib/fsrs/mode.ts`](../lib/fsrs/mode.ts)

```ts
export const TYPING_MODE_STABILITY_THRESHOLD_DAYS = 7

deriveMode(state) → 'typing' si stability >= 7, sinon 'qcm'
```

**Pourquoi `stability`** et pas `reps` :
- `reps` ignore la qualité des réponses (3 Good d'affilée ≠ 3 Again)
- `stability` prédit combien de jours la carte restera retenue → mesure directe de "à quel point c'est appris"
- Si on met que des "Again", la stability reste < 7 et la carte reste en QCM → comportement désiré

Ajuster le seuil : changer la constante, pas d'autre modif nécessaire. Les cartes existantes basculeront automatiquement la prochaine fois que `deriveMode` est appelé.

## Rating UI

4 boutons FSRS ([`components/rating-buttons.tsx`](../components/rating-buttons.tsx)) :

| Bouton | Rating | Sémantique | Effet sur la session courante |
|---|---|---|---|
| Encore | 1 (Again) | J'ai pas retrouvé, à remontrer vite | **Re-poussée en fin de file** (la seule à l'être) |
| Difficile | 2 (Hard) | J'ai retrouvé mais à la limite | Sort de la session, réapparaîtra quand `due` sera passé |
| Bien | 3 (Good) | OK, rythme normal | Sort de la session |
| Facile | 4 (Easy) | Trop évident, espace plus | Sort de la session |

En mode QCM, le reveal se fait par **clic sur une option** — pas besoin d'un bouton "Montrer la réponse" séparé.
En mode saisie, clic sur "Révéler la réponse" après avoir tapé, puis rating.

## Session de révision (depuis 2026-04-20)

La page `/review` est client-side avec queue préfetchée de 10 cartes, gérée par [`components/review-session.tsx`](../components/review-session.tsx).

- **Préchargement** : RSC fait `getDueCards(10)`, passe la liste à `<ReviewSession>`. Refetch en arrière-plan via `getDueCardsExcluding(seenIds, 10)` dès que la queue descend à ≤ 3.
- **Pop synchrone** au rate : la carte suivante s'affiche au prochain paint (pas de round-trip serveur attendu).
- **Persistance** : chaque rate est une écriture atomique `update cards.fsrs_state + insert reviews`. Les cartes préfetchées non rated ne sont pas consommées côté DB.
- **Re-insertion Encore-only** : seul rating 1 re-pousse la carte en fin de file. Tout autre rating = sortie immédiate, réapparition naturelle au prochain `getDueCards`. Ce choix évite le mismatch UI/DB qu'avait l'ancienne règle "fenêtre de 15 min sur nextDue" (cartes visibles localement alors que non-dues en DB).
- **Fire-and-forget** sur `submitReview` : `.then/.catch`, pas d'`await`. Permet à l'UI de ne pas attendre le commit DB pour passer à la carte suivante. Erreurs via toast.
- `key={current.id}` sur `<ReviewCardQcm>` / `<ReviewCardTyping>` → remount complet entre cartes, state local reset.

Voir le flux détaillé dans [architecture.md](./architecture.md#flux-réviser).

## Sens de la carte : définition → terme

Depuis 2026-04-19 (cf. [decisions.md](./decisions.md)) :
- **QCM** : affiche la **définition** + image, 4 **termes** au choix, valide contre `card.term`.
- **Typing** : affiche la **définition**, user tape le **terme**, révèle terme + image.

On teste donc le rappel du vocabulaire à partir du concept, pas l'inverse. Les distracteurs QCM sont des termes proches, pas des définitions alternatives. Le champ `qcm_choices.correct` a été supprimé du type (la bonne réponse = `card.term`).

Après révélation, si `card.explanation` est non-null, un bouton icône "i" ouvre un Dialog markdown avec l'explication détaillée (contexte approfondi du concept).

## Tests

[`lib/fsrs/engine.test.ts`](../lib/fsrs/engine.test.ts) — 7 tests Vitest :
- Init (état New, reps=0)
- Chaque rating 1..4 applicable sans crash, `due` dans le futur
- Again après 2 Good → incrémente `lapses`
- Easy > Good sur `stability`
- Round-trip JSON préserve le comportement
- `deriveMode` retourne `qcm` sur carte neuve
- `deriveMode` bascule à exactement `stability >= 7`

`npm test` pour les relancer.
