-- Anamnèse — clés API personnelles
-- Table api_keys : clés Bearer émises par l'utilisateur depuis les Paramètres.
-- La valeur brute de la clé n'est jamais stockée — seul son hash SHA-256
-- (encodé hex) est conservé. Rationale: la clé brute est 160 bits
-- d'entropie uniforme (Crockford base32, 32 chars), donc un KDF lent
-- (bcrypt/argon2) n'apporte rien; SHA-256 est l'équivalent de la pratique
-- Stripe / GitHub PATs.

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  key_hash text not null unique,
  prefix text not null,
  last4 text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index api_keys_user_idx on public.api_keys (user_id, created_at desc);

alter table public.api_keys enable row level security;

-- Lecture / mutation via session (UI): propriétaire uniquement.
-- Les routes API Bearer-auth'd utilisent le service-role client
-- (bypass RLS) avec filtrage applicatif obligatoire sur user_id.
create policy "api_keys: owner full access"
  on public.api_keys
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
