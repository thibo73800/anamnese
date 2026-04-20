-- Anamnèse — schéma initial
-- cards: flashcards créées par l'utilisateur, avec état FSRS intégré.
-- reviews: historique des révisions (analytics futures + undo).

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  term text not null,
  definition text not null,
  image_url text,
  image_source text check (image_source in ('wikimedia','unsplash','google')),
  image_attribution text,
  tags text[] not null default '{}',
  theme text,
  qcm_choices jsonb not null,
  fsrs_state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- fsrs_state->>'due' est une string ISO 8601 (UTC, suffixe Z) produite par Date.toISOString().
-- Lexicographique == chronologique → pas besoin de cast timestamptz (qui n'est pas IMMUTABLE).
create index cards_user_due_idx
  on public.cards (user_id, (fsrs_state->>'due'));
create index cards_user_tags_idx
  on public.cards using gin (tags);
create index cards_user_created_idx
  on public.cards (user_id, created_at desc);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 4),
  mode_used text not null check (mode_used in ('qcm','typing')),
  response_text text,
  reviewed_at timestamptz not null default now(),
  previous_state jsonb not null,
  new_state jsonb not null
);

create index reviews_card_idx on public.reviews (card_id, reviewed_at desc);
create index reviews_user_idx on public.reviews (user_id, reviewed_at desc);

alter table public.cards enable row level security;
alter table public.reviews enable row level security;

create policy "cards: owner full access"
  on public.cards
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "reviews: owner full access"
  on public.reviews
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Trigger: updated_at auto sur public.cards
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger cards_set_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();
