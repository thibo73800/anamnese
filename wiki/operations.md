# Operations

## Setup initial

Voir [`SETUP.md`](../SETUP.md) à la racine pour le guide end-to-end (où cliquer pour chaque clé, quotas, déploiement Vercel).

Résumé :

```bash
git clone <repo>
cd anamnese
npm install
cp .env.local.example .env.local
# éditer .env.local avec les clés (SETUP.md détaille où les trouver)
npm run dev
```

## Migration DB

Migrations dans [`supabase/migrations/`](../supabase/migrations/), à appliquer dans l'ordre :
- `0001_init.sql` — schéma initial (cards + reviews + RLS + indexes + trigger updated_at)
- `0002_card_explanation.sql` — ajoute colonne `explanation text` nullable sur `cards` (2026-04-19). **À appliquer avant tout `createCard` post-2026-04-19** sinon INSERT échoue.

### Application

Option A (recommandée depuis un réseau IPv4-only — ie. free tier Supabase) : Dashboard SQL Editor.
- https://supabase.com/dashboard/project/<ref>/sql/new
- Coller le contenu du fichier, Run. Répéter pour chaque migration non encore appliquée.

Option B : Supabase CLI (nécessite un access token personnel).
```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push
```

### Pourquoi pas directement psql ou `pg` depuis la CLI

- Le direct `db.<ref>.supabase.co:5432` est **IPv6-only** sur le free tier → inaccessible depuis pas mal de réseaux
- Le pooler `aws-0-<region>.pooler.supabase.com:6543` demande de connaître la région du projet et le user au format `postgres.<ref>`
- Deux obstacles → on passe par le dashboard en pratique

Un script tenté ([`scripts/apply-migration.mjs`](../scripts/apply-migration.mjs)) reste dans le repo pour référence, mais n'est pas fiable sur free tier.

## Déploiement Vercel

Voir `SETUP.md` §5. Points clés :
- Framework détecté auto : Next.js
- Env vars à copier depuis `.env.local`, cocher Production + Preview
- `SUPABASE_SERVICE_ROLE_KEY` : ne pas cocher "Expose to browser"
- Après le premier deploy : ajouter l'URL Vercel aux Supabase Redirect URLs + Site URL (sinon l'email de confirm redirige vers localhost)

## Dépannage fréquent

| Symptôme | Cause | Fix |
|---|---|---|
| `email rate limit exceeded` au signup | Supabase free tier = 4 emails/h combinés | Utiliser `scripts/admin-create-user.mjs`, ou désactiver "Confirm email", ou configurer SMTP custom |
| Hydration warning avec `inmaintabuse="1"` sur body | Extension browser injecte l'attribut | On a déjà `suppressHydrationWarning` sur `<html>` et `<body>` — ignorer |
| `functions in index expression must be marked IMMUTABLE` | Cast `::timestamptz` non IMMUTABLE dans l'index | Indexer le `text` brut (cf. [data-model.md](./data-model.md)) |
| `credit balance too low` avec clé Anthropic fraîche | La clé appartient à une autre organisation Anthropic | Créer une clé dans l'org qui a les crédits ; les clés sont **scoped par org** |
| Signup réussi mais retour à /login sans session | Email confirmation active et `/auth/callback` pas implémentée ou pas whitelistée dans Supabase | Vérifier que `http://localhost:3000/auth/callback` est dans Redirect URLs |
| Dev server ne voit pas les changements d'`.env.local` | Next.js ne hot-reload pas les env | Redémarrer `npm run dev` |
| Build Vercel fail sur `export type` dans Server Action | `'use server'` files ne peuvent qu'exporter des fonctions async | Déplacer les types dans `lib/types.ts` |
| `GET /icon 404` en prod | `app/icon.tsx` génère un fichier avec hash, manifest pointe vers `/icon` sans hash | Vérifier `next-sitemap` ou laisser Next servir via la route — testé OK en build local |

## Scripts admin

```bash
set -a && source .env.local && set +a

# Créer user pré-confirmé (bypass rate limit et email)
node scripts/admin-create-user.mjs 'email@domain.com' 'motdepasse'

# Supprimer un user (cleanup ou avant re-signup)
node scripts/admin-reset-user.mjs 'email@domain.com'
```

Utilisent `SUPABASE_SERVICE_ROLE_KEY` → bypass RLS + accès API admin.

## Rotation de credentials

Si une clé a leaké (poste en chat, commit accidentel, etc.) :

| Clé | Où la révoquer |
|---|---|
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/settings/keys → More actions → Revoke |
| `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → Regenerate (⚠️ change les **deux** en même temps) |
| DB password Supabase | Supabase Dashboard → Settings → Database → Reset password |
| `UNSPLASH_ACCESS_KEY` / Secret | Unsplash Developers → ton app → Regenerate |
| `GOOGLE_CSE_KEY` | Google Cloud Console → APIs & Services → Credentials → supprime + recrée |

Après rotation : mettre à jour `.env.local` + les env Vercel, redémarrer le dev server.
