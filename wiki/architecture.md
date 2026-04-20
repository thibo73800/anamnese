# Architecture

## Découpe Next.js App Router

```
app/
├── (auth)/                    # routes publiques (login, signup)
│   ├── layout.tsx             # centre la card 390px
│   ├── login/page.tsx
│   └── signup/page.tsx
├── (app)/                     # routes protégées — layout vérifie la session
│   ├── layout.tsx             # header nav + guard getUser()
│   ├── page.tsx               # home + SearchBar
│   ├── search/page.tsx        # Server Component: appelle explainTheme + findImage
│   ├── create/page.tsx        # RSC minimal → <BatchCreator> (chat Claude + draft set)
│   ├── cards/page.tsx         # liste + filtre tags + badge "À réviser" + Modifier/Supprimer
│   ├── cards/[id]/edit/page.tsx  # édition d'une carte (term/def/tags/image/explanation)
│   └── review/page.tsx        # RSC: getDueCards(10) → <ReviewSession> (client-side queue)
├── auth/callback/route.ts     # Route handler PKCE: échange ?code= contre session
├── api/image-search/route.ts  # proxy serveur pour findImage (évite d'exposer les clés)
├── actions/                   # Server Actions (marqués 'use server')
│   ├── auth.ts                # signup, login, logout
│   ├── cards.ts               # createCard, updateCard, deleteCard, listCards, submitReview, getDueCards, getDueCardsExcluding, …
│   ├── theme.ts               # refineThemeExplanation (follow-up Q&A sur la recherche)
│   └── batch-create.ts        # sendBatchMessage, findImageForDraft, commitSet (chat batch /create)
├── layout.tsx                 # root layout, manifest, Toaster
├── manifest.ts                # PWA manifest dynamique
├── icon.tsx / apple-icon.tsx  # icônes générées via next/og
└── globals.css
```

## Composants clés

| Composant | Rôle |
|---|---|
| `search-result.tsx` (client) | Orchestre l'écran de recherche : `ThemeExplanation` (markdown) + input follow-up Q&A + `CardEditor`. Hoist le state `explanation`. |
| `theme-explanation.tsx` (server) | Rend l'explication via `<Markdown>`. |
| `markdown.tsx` (server) | Wrapper `react-markdown` + `remark-gfm` avec styling Tailwind utility. |
| `card-editor.tsx` (client) | Formulaire create/edit d'une carte : term, définition, tags, image (preview + URL custom + retirer), distracteurs (affichés en détails). `mode: create \| edit` → appelle `createCard` ou `updateCard`. |
| `image-preview.tsx` (client) | Image `object-contain` hauteur fixe + clic → Dialog plein écran avec attribution. Réutilisé dans CardEditor + review. |
| `delete-card-button.tsx` (client) | Icône poubelle → Dialog de confirmation → `deleteCard`. |
| `explanation-info.tsx` (client) | Bouton icône "i" après révélation en review → Dialog markdown avec l'explication complète. |
| `review-card-qcm.tsx` (client) | **Présentationnel**. QCM **inversé** : affiche définition + image, 4 termes au choix, validation contre `card.term`. Props `{ card, onRate }`. |
| `review-card-typing.tsx` (client) | **Présentationnel**. Saisie libre : affiche définition, user tape le terme, révèle terme + image. Props `{ card, onRate }`. |
| `review-session.tsx` (client) | File de cartes préfetchées + pop synchrone au rate + refetch en arrière-plan. Branche QCM/typing via `deriveMode`. `key={current.id}` sur l'enfant → remount entre cartes. Re-insertion en fin de file **uniquement** sur rating=1 (Encore). |
| `batch-creator.tsx` (client) | Layout 2 colonnes : conversation (chat Claude) + draft set éditable (tags partagés + `DraftCardItem[]` + bouton commit). Historique texte pur, tools éphémères côté serveur. |
| `draft-card-item.tsx` (client) | Item du set draft : term / définition / distracteurs / bouton "Chercher une image" (opt-in). Pas de persistance tant qu'on n'a pas commit le set. |

## Couches et responsabilités

| Couche | Responsabilité | Exemples |
|---|---|---|
| **Proxy** (`proxy.ts` + `lib/supabase/proxy.ts`) | Refresh session cookie, auth guard | Redirige `/` → `/login` si pas user |
| **Server Components** (pages) | Data fetching + RSC | `search/page.tsx` appelle `explainTheme()` |
| **Server Actions** (`app/actions/*`) | Mutations + auth-checked writes | `createCard`, `submitReview` |
| **Route Handlers** (`/api/*`, `/auth/callback`) | Endpoints HTTP classiques | PKCE callback, proxy image search |
| **Client Components** | Interactivité | `CardEditor`, `ReviewCardQcm`, `SearchBar` |
| **`lib/`** | Logique métier pure, pas de React | `fsrs/`, `anthropic/`, `images/`, `supabase/` |

Règle : les Client Components ne touchent jamais directement à Supabase côté DB — ils passent par des Server Actions (qui vérifient l'auth via `createClient()` server-side).

## Flux "créer une carte"

```
SearchBar (client) ──push──▶ /search?q=<theme>
                                    │
                             Server Component
                                    │
                       ┌────────────┴────────────┐
                       ▼                         ▼
              explainTheme(theme)         findImage(query)  [si needsImage]
              (lib/anthropic)              (lib/images)
                       │                         │
                       └───────────┬─────────────┘
                                   ▼
                       <SearchResult> (client)
                       ├── ThemeExplanation (markdown)
                       ├── FollowUp input ──▶ refineThemeExplanation
                       │     (user pose Q)     (LLM regénère explication enrichie)
                       │                             │
                       │                      replaces explanation state
                       │
                       └── CardEditor (pré-rempli + image preview + URL custom)
                                   │
                        user submit ↓
                                   ▼
                        createCard Server Action
                                   │   (payload inclut `explanation` courante)
                        ┌──────────┴──────────┐
                        ▼                     ▼
                   supabase INSERT        initCard() FSRS
                                   │
                        revalidatePath + toast
                                   ▼
                              redirect /cards
```

## Flux "réviser"

Depuis 2026-04-20 : la page de révision est client-side avec queue préfetchée.

```
/review (Server Component, minimal)
   │
   └─▶ getDueCards(10)  ─── order by fsrs_state->>'due' asc, limit 10
                              filtre user_id via RLS
         │
         ▼
    <ReviewSession initialCards={...}>  (client)
         │
         ├── queue: AnamneseCard[]   (initialisé à partir des initialCards)
         ├── seenRef: Set<id>        (empêche doublons au refetch)
         └── exhausted: boolean      (true si serveur renvoie < PREFETCH_BATCH)

  current = queue[0]
         │
         └─▶ deriveMode(current.fsrs_state)  (stability >= 7j → typing, sinon qcm)
              │
              ├─── mode=qcm → <ReviewCardQcm key={current.id} card={current} onRate={onRate}>
              └─── mode=typing → <ReviewCardTyping key={current.id} card={current} onRate={onRate}>

  onRate(rating, responseText?) :
         │
         ├── setQueue((q) => q.slice(1))          // pop synchrone → carte suivante instantanée
         ├── setReviewedCount++
         │
         ├── if queue.length - 1 <= 3 and !exhausted:
         │       void refetchMore()               // refetch 10 de plus en arrière-plan
         │                                         // via getDueCardsExcluding(seenIds, 10)
         │
         └── submitReview(...)  (fire-and-forget, .then/.catch, pas d'await)
                   │
                   ├── reviewCard(state, rating) via ts-fsrs
                   ├── UPDATE cards.fsrs_state
                   ├── INSERT INTO reviews (historique)
                   ├── revalidatePath('/cards')   (pas '/review' : éviterait re-render coûteux)
                   └── return { nextCard }
                         │
                         └── if rating === 1 (Encore):
                                setQueue((q) => [...q, nextCard])  // re-insertion en fin de file
                             else:
                                 la carte sort de la session, réapparaît quand due passe

après reveal : si card.explanation non-null,
  icône "i" → Dialog markdown avec l'explication complète
```

**Invariants** :
- DB = source de vérité. La queue locale est une commodité de pré-chargement : les cartes préfetchées mais non rated ne sont pas consommées (simple SELECT), elles réapparaîtront au prochain `/review`.
- Re-insertion **uniquement** si rating === 1 (Encore). Tout autre rating = sortie immédiate. Le compteur "N en file" reste fidèle à ce qui est dû côté DB.
- `key={current.id}` sur les composants cartes → remount complet → state local (`selected`, `answer`, `revealed`) repart à zéro à chaque carte.

## Flux "créer un set" (batch via chat)

Depuis 2026-04-20. Route [`/create`](../app/(app)/create/page.tsx).

```
<BatchCreator>  (client — useState pour tout)
   │
   ├── history: DisplayMessage[]    // {role, text} — pur texte, pas de tool_use ici
   ├── draftCards: DraftCard[]      // {localId, term, definition, distractors[3], image}
   ├── sharedTags: string[]
   └── userInput: string

  user tape + envoie
         │
         └─▶ sendBatchMessage({ history, userText, draftCards, sharedTags })  (Server Action)
                   │
                   └─▶ runBatchTurn(...)  (lib/anthropic/batch.ts)
                          │
                          ┌────────── boucle max 5 itérations ──────────┐
                          │                                              │
                          │   user message = [formatState(draft,tags),   │
                          │                   userText]                  │
                          │                                              │
                          │   client.messages.create({                   │
                          │     tools: BATCH_TOOLS,                      │
                          │     messages: apiMessages,                   │
                          │   })                                         │
                          │          │                                   │
                          │          ▼                                   │
                          │   response.content contient:                 │
                          │     - text blocks (message assistant)        │
                          │     - tool_use blocks                        │
                          │          │                                   │
                          │          ▼                                   │
                          │   applyTool(name, input, state) → nouveau    │
                          │     state + tool_result text                 │
                          │          │                                   │
                          │          ▼                                   │
                          │   si stop_reason === 'tool_use':             │
                          │     push tool_results au msg suivant → loop  │
                          │   sinon: break                               │
                          └──────────────────────────────────────────────┘
                   │
                   └─▶ { assistantText, draftCards, sharedTags }
         │
         ▼
   état client mis à jour : history += [user, assistant], draft + tags remplacés

  user peut aussi :
    - éditer term/définition/distracteurs directement dans DraftCardItem
    - supprimer une carte du draft
    - ajouter/retirer un tag manuellement
    - cliquer "Chercher une image" sur une carte (appelle findImageForDraft)
    - ajouter une carte vide ("+ Ajouter une carte manuellement")

  bouton final "Ajouter N cartes au deck"
         │
         └─▶ commitSet({ theme, sharedTags, cards })
                   │
                   ├── INSERT batch dans cards (N rows, 1 seul query)
                   │     chacun avec initCard() FSRS + qcm_choices.distractors
                   ├── revalidatePath('/cards'), revalidatePath('/review')
                   └── return { ids, firstTag }
         │
         └─▶ redirect /cards?tag=<firstTag>
```

**Outils Claude** (JSON Schema dans [`lib/anthropic/batch.ts`](../lib/anthropic/batch.ts)) :
- `create_cards({ cards: [{ term, definition, distractors[3] }] })` — ajoute N cartes, assigne des `localId` UUID
- `edit_card({ localId, patch: { term?, definition?, distractors? } })` — modifie une carte existante
- `delete_card({ localId })` — supprime une carte du set
- `propose_tags({ tags: string[] })` — remplace la liste des tags partagés

Le `localId` est un UUID client généré via `crypto.randomUUID()`. Le LLM le reçoit via `formatState` et l'utilise pour cibler `edit_card`/`delete_card`.

Voir aussi : [fsrs.md](./fsrs.md), [data-model.md](./data-model.md), [llm-prompts.md](./llm-prompts.md).
