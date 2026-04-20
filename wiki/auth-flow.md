# Auth flow

## Composants

- [`lib/supabase/client.ts`](../lib/supabase/client.ts) — `createBrowserClient` pour Client Components
- [`lib/supabase/server.ts`](../lib/supabase/server.ts) — `createServerClient` + adaptateur cookies (`next/headers`)
- [`lib/supabase/proxy.ts`](../lib/supabase/proxy.ts) — `updateSession` appelée par `proxy.ts` à la racine
- [`proxy.ts`](../proxy.ts) (racine) — proxy Next.js 16 (ex-middleware), refresh cookie + redirect guards
- [`app/actions/auth.ts`](../app/actions/auth.ts) — Server Actions `signup`, `login`, `logout`
- [`app/auth/callback/route.ts`](../app/auth/callback/route.ts) — échange PKCE après email de confirmation

## Signup

```
user submit form
  ↓
signup Server Action
  ↓
supabase.auth.signUp({ email, password, options: { emailRedirectTo } })
  ↓
┌─── "Confirm email" OFF dans Supabase ? ───┐
│                                              │
│   data.session !== null                      │
│   → revalidatePath + redirect('/')           │
│   → proxy laisse passer                      │
│   → home app                                 │
│                                              │
└── "Confirm email" ON ? ───────────────────┘
        │
        data.session === null
        → retourne { error: "email envoyé, clique le lien" }
        → user voit le message
        → user clique le lien dans l'email
        → Supabase redirige vers /auth/callback?code=...
        → route handler: exchangeCodeForSession
        → cookie session posé
        → redirect /
```

## Login

```
login Server Action
  ↓
supabase.auth.signInWithPassword
  ↓
cookie session posé par l'adaptateur (Server Action peut écrire cookies)
  ↓
revalidatePath + redirect('/')
  ↓
proxy voit user → laisse passer → home
```

## Logout

Form dans le header app → POST vers Server Action `logout` → `signOut()` invalide le cookie → redirect `/login`.

## Proxy guards

```ts
// lib/supabase/proxy.ts
if (!user && !isAuthRoute && !isPublicAsset) redirect('/login')
if (user && isAuthRoute) redirect('/')
```

- **isAuthRoute** : `/login`, `/signup`, `/auth/*` (callback inclus — pas besoin d'être connecté pour le réclamer)
- **isPublicAsset** : `/_next/*`, `/api/auth/*`, `/favicon.ico`, `/manifest.webmanifest`
- Les icônes (`/icon`, `/apple-icon`) passent par le matcher de `proxy.ts` qui exclut déjà les extensions d'image

⚠️ **L'appel `getUser()` dans le proxy est obligatoire** : c'est ce qui refresh le token expiré et écrit le nouveau cookie. Si on l'enlève, les sessions longues cassent silencieusement.

## Server Client `setAll` — try/catch intentionnel

```ts
setAll(cookiesToSet) {
  try { cookiesToSet.forEach(({name, value, options}) => cookieStore.set(...)) }
  catch { /* swallowed */ }
}
```

Next.js interdit l'écriture de cookies depuis un **Server Component** (lecture seule). Si on laissait l'exception remonter, toute lecture Supabase depuis un RSC crasherait. Le refresh réel de session est fait par le proxy (qui a un `NextResponse` mutable), donc ce swallow ne casse rien.

## Scripts admin (bypass signup)

Utilité : rate limit email atteint, ou besoin de créer un compte test sans lire d'email.

```bash
set -a && source .env.local && set +a

# Créer un user pré-confirmé
node scripts/admin-create-user.mjs 'test@example.com' 'motDePasse'

# Supprimer un user (avant re-signup, debug, cleanup)
node scripts/admin-reset-user.mjs 'test@example.com'
```

Les deux utilisent `SUPABASE_SERVICE_ROLE_KEY` pour bypasser RLS et appellent l'API admin `auth.admin.*`.

## Configuration Supabase requise

Dans le dashboard → **Authentication → URL Configuration** :

- **Site URL** : `http://localhost:3000` en dev, URL Vercel en prod
- **Redirect URLs** (liste blanche) : doit contenir `http://localhost:3000/auth/callback` (et l'équivalent prod)

Sans cette autorisation, Supabase refuse de rediriger vers `/auth/callback` même si l'URL est passée en `emailRedirectTo`.

## Rate limit email Supabase

Free tier : **4 emails par heure** combinant signup + password reset + magic link. Se réinitialise 1h après le dernier envoi.

Workarounds :
1. Bypass via `scripts/admin-create-user.mjs` pour les tests
2. Configurer un SMTP custom (Resend, Mailgun, Brevo) dans Supabase → Auth → SMTP Settings — limites beaucoup plus hautes
3. Désactiver "Confirm email" pour le dev (Auth → Providers → Email → décocher Confirm email)
