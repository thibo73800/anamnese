# Auth flow

## Components

- [`lib/supabase/client.ts`](../lib/supabase/client.ts) — `createBrowserClient` for Client Components
- [`lib/supabase/server.ts`](../lib/supabase/server.ts) — `createServerClient` + cookie adapter (`next/headers`)
- [`lib/supabase/proxy.ts`](../lib/supabase/proxy.ts) — `updateSession` called by root-level `proxy.ts`
- [`proxy.ts`](../proxy.ts) (root) — Next.js 16 proxy (formerly middleware): cookie refresh + redirect guards
- [`app/actions/auth.ts`](../app/actions/auth.ts) — Server Actions `signup`, `login`, `logout`
- [`app/auth/callback/route.ts`](../app/auth/callback/route.ts) — PKCE exchange after the confirmation email

## Signup

```
user submits form
  ↓
signup Server Action
  ↓
supabase.auth.signUp({ email, password, options: { emailRedirectTo } })
  ↓
┌─── "Confirm email" OFF in Supabase? ───┐
│                                         │
│   data.session !== null                 │
│   → revalidatePath + redirect('/')      │
│   → proxy lets through                  │
│   → app home                            │
│                                         │
└── "Confirm email" ON? ────────────────┘
        │
        data.session === null
        → returns { error: "email sent, click the link" }
        → user sees the message
        → user clicks the link in the email
        → Supabase redirects to /auth/callback?code=...
        → route handler: exchangeCodeForSession
        → session cookie set
        → redirect /
```

## Login

```
login Server Action
  ↓
supabase.auth.signInWithPassword
  ↓
session cookie set by the adapter (Server Actions may write cookies)
  ↓
revalidatePath + redirect('/')
  ↓
proxy sees user → lets through → home
```

## Logout

Form in the app header → POST to the `logout` Server Action → `signOut()` invalidates the cookie → redirect `/login`.

## Proxy guards

```ts
// lib/supabase/proxy.ts
if (!user && !isAuthRoute && !isPublicAsset) redirect('/login')
if (user && isAuthRoute) redirect('/')
```

- **isAuthRoute**: `/login`, `/signup`, `/auth/*` (callback included — no need to be logged in to claim it)
- **isPublicAsset**: `/_next/*`, `/api/auth/*`, `/favicon.ico`, `/manifest.webmanifest`
- Icons (`/icon`, `/apple-icon`) go through the `proxy.ts` matcher which already excludes image extensions

⚠️ **The `getUser()` call inside the proxy is mandatory** — it's what refreshes the expired token and writes the new cookie. Without it, long sessions break silently.

## Server client `setAll` — intentional try/catch

```ts
setAll(cookiesToSet) {
  try { cookiesToSet.forEach(({name, value, options}) => cookieStore.set(...)) }
  catch { /* swallowed */ }
}
```

Next.js forbids writing cookies from a **Server Component** (read-only). If we let the exception propagate, any Supabase read from an RSC would crash. The actual session refresh happens in the proxy (which holds a mutable `NextResponse`), so swallowing here breaks nothing.

## Admin scripts (signup bypass)

Use cases: email rate limit hit, or need a test account without reading an email.

```bash
set -a && source .env.local && set +a

# Create a pre-confirmed user
node scripts/admin-create-user.mjs 'test@example.com' 'password'

# Delete a user (before re-signup, debug, cleanup)
node scripts/admin-reset-user.mjs 'test@example.com'
```

Both use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS and call the admin API `auth.admin.*`.

## Required Supabase configuration

In the dashboard → **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` in dev, the Vercel URL in prod
- **Redirect URLs** (allowlist): must include `http://localhost:3000/auth/callback` (and the prod equivalent)

Without this whitelist, Supabase refuses to redirect to `/auth/callback` even when the URL is passed as `emailRedirectTo`.

## Supabase email rate limit

Free tier: **4 emails per hour** combined across signup + password reset + magic link. Resets 1h after the last send.

Workarounds:
1. Bypass via `scripts/admin-create-user.mjs` for testing
2. Configure a custom SMTP (Resend, Mailgun, Brevo) in Supabase → Auth → SMTP Settings — much higher limits
3. Disable "Confirm email" for dev (Auth → Providers → Email → uncheck Confirm email)

## See also

- [[conventions#supabase-cookies-server-client]] — why the `setAll` swallow is intentional
- [[conventions#supabase-email-rate-limit-free-tier]] — the three workarounds in detail
- [[operations#admin-scripts]] — exact commands for the admin scripts
- [[data-model]] — RLS via `auth.uid()`
