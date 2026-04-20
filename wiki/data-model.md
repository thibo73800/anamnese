# Data model

Migrations :
- [`0001_init.sql`](../supabase/migrations/0001_init.sql) — schéma initial
- [`0002_card_explanation.sql`](../supabase/migrations/0002_card_explanation.sql) — ajout colonne `explanation` (2026-04-19)

## Tables

### `public.cards`

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK default `gen_random_uuid()` | |
| `user_id` | uuid FK `auth.users(id)` on delete cascade | |
| `term` | text not null | ≤ 120 car. (validé Zod côté action) |
| `definition` | text not null | ≤ 600 car. |
| `image_url` | text nullable | URL de l'image attachée |
| `image_source` | text check in (`wikimedia`,`unsplash`,`google`), nullable | `null` quand l'utilisateur a collé une URL custom |
| `image_attribution` | text nullable | Crédit à afficher (Unsplash l'exige). `null` si URL custom ou Wikimedia sans extmetadata |
| `tags` | text[] not null default `'{}'` | Suggérés par le LLM, éditables |
| `theme` | text nullable | Thème original saisi |
| `explanation` | text nullable | Version markdown détaillée (150-400 mots), potentiellement enrichie par des Q&A de clarification au moment de la création. Affichée à la demande pendant la révision via bouton "i". |
| `qcm_choices` | jsonb not null | `{distractors: string[3]}` — 3 **termes** sémantiquement proches du `term` correct. La bonne réponse = `card.term` (pas stockée séparément). |
| `fsrs_state` | jsonb not null | `Card` sérialisé de `ts-fsrs` |
| `created_at`, `updated_at` | timestamptz | trigger `set_updated_at` sur UPDATE |

**Anciennes cartes** (pré-2026-04-19) : peuvent avoir `qcm_choices.correct` (= définition) + `distractors` avec des définitions longues. Ignorés côté code. Bouton "Supprimer" sur `/cards` pour les retirer à la main.

### `public.reviews`

Historique des révisions (audit, analytics futur, undo potentiel).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `card_id`, `user_id` | uuid FK on delete cascade | |
| `rating` | smallint 1..4 | 1=Again, 2=Hard, 3=Good, 4=Easy |
| `mode_used` | text `qcm`\|`typing` | Mode utilisé **pour cette révision** (calculé via `deriveMode` au moment du submit) |
| `response_text` | text nullable | Saisie de l'utilisateur en mode typing |
| `reviewed_at` | timestamptz default now() | |
| `previous_state`, `new_state` | jsonb | Snapshots FSRS avant/après |

## Indexes

```sql
-- Requête due cards: order by fsrs_state->>'due' asc, filtre user_id
create index cards_user_due_idx on cards (user_id, (fsrs_state->>'due'));

-- Filtre par tag
create index cards_user_tags_idx on cards using gin (tags);

-- Listing chronologique
create index cards_user_created_idx on cards (user_id, created_at desc);

-- Historique par carte (triggers reviews panel futur)
create index reviews_card_idx on reviews (card_id, reviewed_at desc);
create index reviews_user_idx on reviews (user_id, reviewed_at desc);
```

### Pourquoi pas `::timestamptz` dans l'index

Postgres exige que les expressions indexées soient `IMMUTABLE`. Le cast `text::timestamptz` ne l'est pas (dépend potentiellement de `timezone`). On indexe donc le `text` brut.

**Invariant à préserver** : `fsrs_state->>'due'` est toujours une string ISO 8601 en UTC (suffixe `Z`), produite par `Date.prototype.toISOString()`. Les comparaisons lexicographiques `<=` / `>=` sur ces strings correspondent à des comparaisons chronologiques. Si jamais on commence à écrire des dates en format non-UTC, cet index devient faux.

## RLS (Row Level Security)

```sql
alter table cards enable row level security;
alter table reviews enable row level security;

create policy "cards: owner full access"
  on cards for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "reviews: owner full access"
  on reviews for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Toutes les lectures/écritures depuis le code app passent par le client **anon** (cookies de session → `auth.uid()` résolu). Le `service_role` bypasse RLS — utilisé uniquement côté scripts admin (`scripts/admin-*.mjs`).

## Trigger `updated_at`

Standard :

```sql
create or replace function public.set_updated_at() returns trigger ...
  new.updated_at := now();
  return new;

create trigger cards_set_updated_at before update on cards
  for each row execute function public.set_updated_at();
```

Pas nécessaire sur `reviews` (historique immuable).
