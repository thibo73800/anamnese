# Operations

## Initial setup

See [`SETUP.md`](../SETUP.md) at the repo root for the end-to-end guide (where to click for each key, quotas, Vercel deployment).

Summary:

```bash
git clone <repo>
cd anamnese
npm install
cp .env.local.example .env.local
# edit .env.local with the keys (SETUP.md details where to find them)
npm run dev
```

## DB migration

Migrations in [`supabase/migrations/`](../supabase/migrations/), to apply in order:
- `0001_init.sql` — initial schema (cards + reviews + RLS + indexes + `updated_at` trigger)
- `0002_card_explanation.sql` — adds a nullable `explanation text` column on `cards`. **Must be applied before any `createCard`** or the INSERT fails (missing column).

### Application

Option A (recommended from an IPv4-only network — i.e. Supabase free tier): Dashboard SQL Editor.
- https://supabase.com/dashboard/project/<ref>/sql/new
- Paste the file contents, Run. Repeat for each unapplied migration.

Option B: Supabase CLI (requires a personal access token).
```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push
```

### Why not `psql` or `pg` directly from the CLI

- The direct `db.<ref>.supabase.co:5432` endpoint is **IPv6-only** on free tier → unreachable from many networks
- The pooler `aws-0-<region>.pooler.supabase.com:6543` requires knowing the project region and a user in `postgres.<ref>` format
- Two obstacles → in practice we go through the dashboard

An attempted script ([`scripts/apply-migration.mjs`](../scripts/apply-migration.mjs)) stays in the repo for reference, but is not reliable on free tier.

## Vercel deployment

See `SETUP.md` §5. Key points:
- Framework auto-detected: Next.js
- Env vars to copy from `.env.local`, tick Production + Preview
- `SUPABASE_SERVICE_ROLE_KEY`: do NOT tick "Expose to browser"
- After the first deploy: add the Vercel URL to Supabase Redirect URLs + Site URL (otherwise the confirm email redirects to localhost)

## Common troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `email rate limit exceeded` on signup | Supabase free tier = 4 emails/hr combined | Use `scripts/admin-create-user.mjs`, or disable "Confirm email", or configure a custom SMTP |
| Hydration warning with `inmaintabuse="1"` on body | Browser extension injecting the attribute | We already set `suppressHydrationWarning` on `<html>` and `<body>` — ignore |
| `functions in index expression must be marked IMMUTABLE` | Non-IMMUTABLE `::timestamptz` cast in the index | Index the raw `text` (see [[data-model#why-no-timestamptz-cast-in-the-index]] and [[conventions#dates--serialization]]) |
| `credit balance too low` with a fresh Anthropic key | The key belongs to a different Anthropic org | Create a key inside the org that has credit; keys are **org-scoped** |
| Signup succeeds but returns to /login without a session | Email confirmation is on and `/auth/callback` is missing or not whitelisted in Supabase | Verify `http://localhost:3000/auth/callback` is in the Redirect URLs |
| Dev server doesn't pick up `.env.local` changes | Next.js doesn't hot-reload env vars | Restart `npm run dev` |
| Vercel build fails on `export type` in a Server Action | `'use server'` files can only export async functions | Move the types to `lib/types.ts` |
| `GET /icon 404` in prod | `app/icon.tsx` generates a hashed file, the manifest points at `/icon` without hash | Check `next-sitemap` or let Next serve via the route — tested OK in local build |

## Admin scripts

```bash
set -a && source .env.local && set +a

# Create a pre-confirmed user (bypasses rate limit and email)
node scripts/admin-create-user.mjs 'email@domain.com' 'password'

# Delete a user (cleanup or before re-signup)
node scripts/admin-reset-user.mjs 'email@domain.com'
```

They use `SUPABASE_SERVICE_ROLE_KEY` → bypass RLS + access to the admin API.

## Credential rotation

If a key leaked (pasted in chat, accidental commit, etc.):

| Key | Where to revoke |
|---|---|
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/settings/keys → More actions → Revoke |
| `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → Regenerate (⚠️ rotates **both** at once) |
| Supabase DB password | Supabase Dashboard → Settings → Database → Reset password |
| `UNSPLASH_ACCESS_KEY` / Secret | Unsplash Developers → your app → Regenerate |
| `GOOGLE_CSE_KEY` | Google Cloud Console → APIs & Services → Credentials → delete + recreate |

After rotation: update `.env.local` + Vercel env, restart the dev server.

## See also

- [[conventions]] — transverse invariants (Next 16, Server Actions, Supabase cookies, etc.)
- [[auth-flow#admin-scripts-signup-bypass]] — details of the `admin-create-user` / `admin-reset-user` scripts
- [[data-model]] — migration order and what each one contains
