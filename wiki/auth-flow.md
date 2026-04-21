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
if (!user && !isAuthRoute && !isPublicAsset && !isBearerApiRoute) redirect('/login')
if (user && isAuthRoute) redirect('/')
```

- **isAuthRoute**: `/login`, `/signup`, `/auth/*` (callback included — no need to be logged in to claim it)
- **isPublicAsset**: `/_next/*`, `/api/auth/*`, `/favicon.ico`, `/manifest.webmanifest`, `/sw.js`, and the PWA icon routes (`/icon`, `/apple-icon`, `/icon-192`, `/icon-maskable`) — logged-out visitors must be able to fetch them so Chrome can evaluate the manifest on `/login`
- **isBearerApiRoute**: `/api/v1/*` — the public API has its own auth (Bearer token, see [[api]]), so the proxy lets these through without a session cookie. The route handler returns 401 itself if the key is missing or invalid. See [[conventions#api-routes--service-role]].

The service worker (`/sw.js`) is an explicit exemption: the browser fetches it without session cookies during registration, so the proxy would otherwise redirect the request to `/login` and the SW would never install. See [[conventions#pwa--minimal-service-worker-no-offline-cache]].

⚠️ **The `getUser()` call inside the proxy is mandatory** — it's what refreshes the expired token and writes the new cookie. Without it, long sessions break silently.

## Server client `setAll` — intentional try/catch

```ts
setAll(cookiesToSet) {
  try { cookiesToSet.forEach(({name, value, options}) => cookieStore.set(...)) }
  catch { /* swallowed */ }
}
```

Next.js forbids writing cookies from a **Server Component** (read-only). If we let the exception propagate, any Supabase read from an RSC would crash. The actual session refresh happens in the proxy (which holds a mutable `NextResponse`), so swallowing here breaks nothing.

## Bearer auth for the public API

The session-cookie path above covers the PWA (login, proxy, RLS via `auth.uid()`). External clients (today: the Claude Code skill in `skills/anamnese/`) hit `/api/v1/*` instead, using a personal API key as a `Authorization: Bearer ana_sk_...` header.

Flow (details in [[api]]):

1. Raw key verified by `verifyApiKey()` ([`lib/api-auth/verify.ts`](../lib/api-auth/verify.ts)) — regex format check → SHA-256 → lookup in `api_keys` via the **service-role** client.
2. Resolved `user_id` is passed to `lib/cards/repository.ts`, which always filters `.eq('user_id', userId)` (mandatory, since RLS is bypassed — see [[conventions#api-routes--service-role]]).
3. Keys are issued / revoked from `/settings/api-keys` (UI) via `app/actions/api-keys.ts` (regular session auth).

Storage: `api_keys.key_hash` = SHA-256 hex of the raw key (never stored verbatim). The raw value is returned exactly once at creation. Rationale for SHA-256 over bcrypt: the raw key carries 160 bits of uniform entropy, so slow-KDFs are unnecessary — see [[conventions#api-keys--hashing--one-time-reveal]].

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
- [[conventions#api-routes--service-role]] — Bearer path's mandatory `.eq('user_id', …)` filtering
- [[api]] — public API surface + endpoint reference
- [[operations#admin-scripts]] — exact commands for the admin scripts
- [[data-model]] — RLS via `auth.uid()` (session path), `api_keys` table (Bearer path)
