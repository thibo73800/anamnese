# LLM prompts

## Client

[`lib/anthropic/client.ts`](../lib/anthropic/client.ts) — init lazy + export `ANAMNESE_MODEL = 'claude-sonnet-4-6'`.

Pourquoi Sonnet 4.6 plutôt qu'Opus 4.7 :
- La tâche est structurée + relativement simple (résumé + extraction de termes + distracteurs)
- Sonnet 4.6 coûte 5× moins que Opus 4.7 ($3/$15 vs $5/$25 par M tokens)
- Qualité observée sur les tests : largement suffisante, français impeccable

Si on veut upgrade sur des thèmes pointus ou obscurs : changer la constante. Aucune autre modif.

## Prompt theme-explain

[`lib/anthropic/prompts/theme-explain.ts`](../lib/anthropic/prompts/theme-explain.ts)

### System prompt

Cadre strict :
- Français obligatoire
- 5 sorties structurées : explication (150-300 mots, **markdown simple** — gras/italique), carte (terme ≤40 car + définition 20-50 mots), 3 distracteurs, 1-4 tags, flag `needsImage` + `imageQuery`
- Distracteurs : **3 termes** sémantiquement proches du terme correct (synonymes partiels, concepts adjacents, faux-amis, disciplines voisines), ≤ 40 car. **Pas des définitions** (depuis 2026-04-19, inversion du sens QCM). Cf. [decisions.md](./decisions.md).
- Contraintes dures : pas d'émoji, définition autosuffisante, si thème vague → angle emblématique

**Prompt cache** activé via `cache_control: { type: 'ephemeral' }` sur le system block → le prompt stable est cached par Anthropic, baisse la latence et le coût des appels suivants (~90% sur la portion cached).

### User prompt

Juste `Thème: <trim(theme)>` — tout le reste est dans le system. Cette séparation est ce qui permet au cache de fonctionner (le user message varie, le system ne varie pas).

## Structured output

[`lib/anthropic/theme.ts`](../lib/anthropic/theme.ts) utilise `client.messages.parse()` + `zodOutputFormat(ThemeExplanationSchema)` — pattern recommandé du SDK TS. Le schéma Zod est auto-converti en JSON Schema et la réponse est validée côté SDK.

Schéma :

```ts
{
  explanation: string,
  needsImage: boolean,
  imageQuery: string | nullable,
  card: {
    term: string.max(80),
    definition: string,
    suggestedTags: string[].min(1).max(4),
    distractors: string[].length(3),
  }
}
```

Si `response.parsed_output === null` → on throw. Jamais vu en pratique sur ce prompt mais c'est le signe d'une réponse mal formée (Claude ne peut plus donner d'output qui violerait le schéma avec structured outputs, mais `refusal` reste possible).

## Prompt theme-refine (follow-up Q&A)

[`lib/anthropic/prompts/theme-refine.ts`](../lib/anthropic/prompts/theme-refine.ts)

Appelé depuis `SearchResult` quand l'utilisateur pose une question de clarification sous l'explication initiale.

### Contrat

Input :
- `theme` (le thème d'origine)
- `currentExplanation` (version courante, potentiellement déjà enrichie par un tour précédent)
- `question` (ce que l'utilisateur demande)

Output structuré :
```ts
{ explanation: string }  // version enrichie, 150-400 mots, markdown simple
```

### Comportement attendu

Le LLM doit **enrichir** l'explication existante, pas la remplacer par une FAQ séparée :
- Intégrer la clarification au bon endroit du texte.
- Conserver l'essentiel de l'explication d'origine.
- Pas de "Q:… R:…", pas de section annexe.
- Si la question est hors-sujet, répondre dans la mesure du lien au thème, sinon reformuler légèrement.

### Persistance

La version finale (après 0, 1, N tours de raffinement) est sauvegardée dans `cards.explanation` au moment de `createCard`. Accessible ensuite depuis la révision via le bouton "i" (`ExplanationInfo`). Les tours intermédiaires sont **éphémères** — pas d'historique Q&A.

## Coût observé

- Input cached (prompt system stable) : ~0.3-0.5k tokens
- Input non-cached (user message court) : ~30 tokens
- Output (explication + JSON) : ~800-1200 tokens
- **Coût par thème ≈ $0.004-$0.008** sur Sonnet 4.6

Un appel `refineExplanation` a un coût comparable (max_tokens 2000, input = explication courante + question). Pas de prompt cache TTL partagé avec `explainTheme` — system prompts distincts.

Donc $5 de crédit ≈ 600-1200 flashcards générables. Large pour du dev.

## Batch chat (création de sets) — depuis 2026-04-20

[`lib/anthropic/batch.ts`](../lib/anthropic/batch.ts) + [`lib/anthropic/prompts/batch.ts`](../lib/anthropic/prompts/batch.ts). Alimente la route `/create`.

### Différences avec `theme-explain`

- **Pas de `client.messages.parse`** — on utilise `client.messages.create` pour récupérer les `tool_use` bruts.
- **4 outils** custom au lieu d'un schéma de sortie unique :
  - `create_cards({ cards: [{ term, definition, distractors[3] }] })`
  - `edit_card({ localId, patch })`
  - `delete_card({ localId })`
  - `propose_tags({ tags: string[] })`
- **Boucle agentique** côté serveur (`runBatchTurn`, max 5 itérations). Chaque itération :
  1. Appel Claude avec `messages` + `tools`
  2. Si `stop_reason === 'tool_use'` : chaque tool est validé (Zod), appliqué au state local (`draftCards`, `sharedTags`), un `tool_result` est composé avec un résumé textuel
  3. On injecte les `tool_result` dans un message `user` et on reloop
  4. Sinon on sort et on renvoie le texte libre final
- **État courant injecté à chaque tour** via `formatState(draft, tags)` en tête du message utilisateur. Le modèle voit toujours la vérité courante, y compris après édition manuelle du user dans l'UI entre deux tours.
- **LocalId** = UUID client. Le prompt système précise que `edit_card`/`delete_card` doivent cibler par `localId` fourni dans l'état courant. Plus robuste qu'un index numérique qui bouge quand on supprime.
- **Historique client** : le composant stocke uniquement `DisplayMessage[]` (role + texte). Les `tool_use` / `tool_result` vivent seulement le temps d'un tour dans `runBatchTurn` — ils ne s'accumulent pas côté client et n'alourdissent pas la requête.

### System prompt

Définit 2 phases :
1. **Premier tour** (set vide) : 6-10 cartes initiales via `create_cards` + tags via `propose_tags` + message texte court récapitulant.
2. **Tours suivants** : éditer/supprimer/ajouter plutôt que reconstruire. Peut appeler plusieurs outils dans un même tour.

Règles qualité identiques à `theme-explain` pour la forme des cartes (français, termes courts, définition 20-60 mots, distracteurs = termes proches et pas phrases).

`cache_control: ephemeral` sur le system prompt (cache 5 min par défaut).

### Contrat server action

```ts
sendBatchMessage({ history, userText, draftCards, sharedTags })
  → { history, draftCards, sharedTags }       // état mis à jour

findImageForDraft({ query })
  → ImageHit | null                            // trigger opt-in du pipeline image

commitSet({ theme, sharedTags, cards })
  → { ids, firstTag }                          // INSERT batch + revalidate
```

### Coût observé

Plus élevé que `theme-explain` : le prompt système est plus long (description des 4 tools) et on fait **plusieurs tours par message utilisateur** (chaque tool_use déclenche une relance). En pratique : 1-3 itérations par message, ~2-5k tokens input cumulés, ~1-2k tokens output. **Coût par message ≈ $0.02-$0.05** sur Sonnet 4.6. Un set entier (2-4 messages user) → $0.05-$0.20.

## Évolutions possibles

- **Prompt caching avec TTL 1h** (`cache_control: { type: 'ephemeral', ttl: '1h' }`) si le système devient plus gros et qu'on a beaucoup de trafic par jour. Actuellement TTL 5min par défaut = OK.
- **Adaptive thinking** (`thinking: { type: 'adaptive' }`) non activé : la tâche ne le justifie pas (extraction structurée simple). À activer si on veut des explications plus profondes/nuancées.
- **Retry sur `refusal`** : pas de gestion actuellement. Si ça arrive sur un thème sensible, l'UI affiche juste l'erreur Anthropic. À surveiller.
