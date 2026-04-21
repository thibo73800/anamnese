-- Anamnèse — snapshot quotidien des thèmes suggérés en page d'accueil
-- Table daily_suggestions : stocke les 6 thèmes du jour par utilisateur.
-- Rationale: éviter de régénérer 6 thèmes via Claude à chaque visite de la
-- page d'accueil. Une génération par jour, et quand l'utilisateur "consomme"
-- un thème (lance une session volatile dessus), on régénère uniquement
-- ce slot pour proposer un remplaçant.
--
-- Clé primaire = user_id seul : on garde uniquement le snapshot du jour
-- en cours (upsert écrase sur nouveau jour). Pas d'historique, pas de
-- purge nécessaire.

create table public.daily_suggestions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  date date not null,
  -- themes: JSON array of { label, kind: 'deepen'|'related', rationale, consumed_at: string|null }
  themes jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.daily_suggestions enable row level security;

create policy "daily_suggestions: owner full access"
  on public.daily_suggestions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Trigger: updated_at auto
create trigger daily_suggestions_set_updated_at
  before update on public.daily_suggestions
  for each row execute function public.set_updated_at();
