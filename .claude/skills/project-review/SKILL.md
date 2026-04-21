---
name: project-review
description: Pre-commit review of work-in-progress (default) or a specified scope (staged / commit / commits range / branch). Checks security, DRY/maintainability, and Anamnèse stack invariants. Reports findings only — never edits or commits.
---

# Project review — Anamnèse

Pre-commit review skill for the Anamnèse repo. Produces a severity-graded report on code changes covering three axes: **security**, **maintainability / DRY**, and **project-specific invariants** sourced from `wiki/conventions.md`.

This skill **never edits files, never stages, never commits**. It only reads and reports.

## When to use this skill

Activate when the user runs `/project-review` (with or without args), or asks for a "review avant commit", "check WIP", "relis ce que j'ai fait", or similar phrasing tied to *uncommitted* or *recently committed* work in this repo.

Do not activate for:
- Full PR reviews → use the built-in `/review` skill
- Generic security audits → use the built-in `/security-review` skill
- Spontaneous lint/typecheck → those are `npm run lint` / `npm run typecheck`

## Scope resolution (args parsing)

Parse the user's arguments to determine the diff scope. **Default = WIP**.

| Args | Scope | Git command |
|------|-------|-------------|
| *(none)* | WIP — all uncommitted changes (staged + unstaged) | `git diff HEAD` |
| `staged` | Index only | `git diff --cached` |
| `commit <sha>` | Single commit | `git show <sha>` |
| `commits <sha1>..<sha2>` | Range | `git diff <sha1>..<sha2>` |
| `branch` | Current branch vs `main` | `git diff main...HEAD` (triple-dot = merge-base) |

If args are ambiguous (e.g. just a SHA), assume `commit <sha>`. If contradictory, ask the user.

## Procedure

Execute these steps in order. Do not skip.

### Step 1 — Resolve scope and list files

```bash
# Resolve scope, get list of changed files
git diff --name-only <scope>
git diff --stat <scope>
```

If the file count is **0**, output a single line "Aucun changement à reviewer." and stop. Do not produce an empty report.

If the file count is **> 50**, ask the user for confirmation before proceeding (large reads are expensive).

### Step 2 — Load project invariants

Read these wiki pages every time — they are the canonical source of truth and may have been updated since the skill was written:

- `wiki/conventions.md` — cross-cutting invariants (highest priority)
- `wiki/auth-flow.md` — RLS / Bearer / service-role rules
- `wiki/data-model.md` — DB schema (only if `supabase/migrations/*.sql` is in the diff)

The grid below is the **starting point** — if `wiki/conventions.md` adds a rule, apply it. If a rule below contradicts the wiki, the wiki wins.

### Step 3 — Read the diff and changed files

For each changed file:
1. Read the full file (Read tool) — context matters, a violation may depend on imports or surrounding code
2. Read the diff for that file (`git diff <scope> -- <file>`) — focus checks on added/modified lines

### Step 4 — Apply the check grid

Walk through the three axes below. For each finding, capture: `file:line`, the rule violated, a one-line fix suggestion, and the severity.

### Step 5 — Output the report

Use the exact template under "Report format" below. End with a clear verdict.

## Check grid

### 🔴 Security (blockers)

Anything in this category blocks the commit.

- **Hardcoded secrets** in changed lines: regex `sk-ant-[A-Za-z0-9_-]+`, `eyJ[A-Za-z0-9_-]{20,}` (JWT), `sb_secret_`, `xoxb-` (Slack), `ghp_`, `AKIA[0-9A-Z]{16}` (AWS). Exempt: `.env.example`, doc strings explicitly labelled as fakes.
- **Sensitive files staged**: `.env`, `.env.local`, `.env.production`, `*.pem`, `*.key`, `credentials.json`, `service-account*.json`. Block hard.
- **Service-role queries without `.eq('user_id', userId)`**: any `.from('cards' | 'reviews' | 'api_keys' | ...)` in `app/api/v1/**` or files importing from `lib/supabase/admin.ts` must filter by `user_id`. Bypassing RLS without filter = inter-tenant leak.
- **Server Action without auth check**: any file with `'use server'` that performs a mutation (`.insert()`, `.update()`, `.delete()`) must call `getUser()` (or equivalent) first and short-circuit on null.
- **Logging tokens / cookies / Authorization headers**: `console.log` of `req.headers`, `cookies()`, `Authorization`, `accessToken`, `apiKey` in any form.
- **SQL injection surface**: template literals inside Supabase query builders or raw SQL — chercher `` .from(`${ `` or `` .rpc(`${ `` or backtick-interpolated SQL.
- **Disabled CSP / CORS** wildcards added (`Access-Control-Allow-Origin: *` on auth endpoints).
- **Validation removed / weakened**: a `zod` schema turned into `.passthrough()`, `.partial()`, or `z.any()` without a comment explaining why.

### 🟠 Maintainability / DRY (must fix)

- **Direct `from('cards')` outside the single source**: any `.from('cards')` outside `lib/cards/repository.ts` or the FSRS review path in `app/actions/cards.ts` violates the "single CRUD source" invariant (`wiki/conventions.md`).
- **Intra-diff duplication**: a function or 5+ line block appearing identically in two new files → suggest extracting to `lib/`.
- **Hardcoded constants** that already exist as named exports:
  - Anthropic model strings (`'claude-sonnet-4-6'`) outside `lib/anthropic/*` → should reuse a constant
  - FSRS thresholds (`2`, days, stability) outside `lib/fsrs/*`
  - API key format / regex outside `lib/api-keys/*`
- **Files > 400 lines** added or grown past 400 → suggest a split.
- **Dead code in the diff**: an exported symbol with zero importers, a function defined but never called.
- **Unused imports** in changed files (`import x from '...'` where `x` is never referenced).
- **Wildcard imports** (`import * as foo from`) — discouraged unless the namespace is actually used as a namespace.
- **`// TODO` / `// FIXME` / `// HACK`** added without a tracking reference.
- **`any` introduced** in TypeScript without an `// eslint-disable-next-line` + reason.
- **Test files removed** without a corresponding code removal.

### 🔴 Anamnèse invariants (blockers — from `wiki/conventions.md`)

These are project-specific. A violation typically means the build will fail or a user-visible bug ships.

- **`next/image` import or `<Image>` JSX**: must use plain `<img>` (Google CSE serves arbitrary domains incompatible with Next's `remotePatterns`).
- **`'use server'` file with non-async export or `export type`**: Turbopack rejects this — Server Actions can only export async functions.
- **`params.<x>` or `searchParams.<x>` accessed without `await`**: Next 16 made these Promises. Pattern: read each route handler / page signature, confirm await is present.
- **Client component reading or mutating Supabase directly**: a file with `'use client'` that calls `createBrowserClient().from(...).select|insert|update|delete()` — the client must go through Server Actions.
- **API key hashed with bcrypt / argon2 / scrypt** instead of SHA-256 — search for `bcrypt`, `argon2`, `scrypt` in `lib/api-keys/*` or files dealing with `api_keys`.
- **`qcm_choices.correct` written**: the field is ignored by design (correct = `card.term`); writing it suggests a misunderstanding.
- **FSRS re-insertion on rating ≠ 1**: in `components/review-session.tsx` or related, the queue should re-push only on `rating === 1` (Again).
- **`setAll` in `lib/supabase/server.ts` without try/catch**: removing the try/catch breaks Server Components (Next forbids cookie writes in RSC).
- **Cache / `addEventListener('fetch')` added in `public/sw.js`**: SW is intentionally passthrough-only (online-only PWA).
- **`asChild` prop on a shadcn `Button`**: this template uses `@base-ui/react`, no `asChild` — use `className={buttonVariants({...})}` on a `Link`.
- **Date stored without `.toISOString()`**: dates written to Supabase must be UTC ISO-8601 (the indexes compare as raw text, no cast). Suspicious patterns: `Date.now()` written into a column, `.toString()`, raw `new Date()`.
- **Migration out of sequence**: any new file in `supabase/migrations/` must follow `000N_<slug>.sql` numbering (no gaps, no duplicates).
- **Proxy exemption removed**: `lib/supabase/proxy.ts` must continue to bypass auth for `/api/v1/*`, `/sw.js`, `/icon*`, `/apple-icon*`. Removing any of these breaks Bearer auth or PWA install.
- **Missing `await` on `cookies()` / `headers()`** in route handlers (Next 16 made these async too).

### 🟡 Suggestions (optional)

- Naming inconsistencies (camelCase vs snake_case mixed in the same module)
- Comments that restate obvious code (per `CLAUDE.md` — comments only for non-obvious WHY)
- Opportunities to use existing utilities the user may not know about (after grepping `lib/`)
- Test coverage gaps for new branches in non-trivial logic

## Report format

Output exactly this template. Counts in parentheses. Use `(0)` and an empty list rather than omitting a section.

```markdown
# Project review — scope: <human-readable scope>

**Files changed:** N — **+X / −Y lines**

## 🔴 Bloquants (N)
- `path/to/file.ts:42` — <règle violée> — <fix suggéré court>

## 🟠 À corriger (N)
- `path/to/file.ts:88` — <règle> — <fix>

## 🟡 Suggestions (N)
- `path/to/file.ts:120` — <amélioration optionnelle>

## ✅ Vérifications passées
- Sécurité (secrets, RLS, service-role filtering)
- DRY (single source `lib/cards/repository.ts`, pas de duplication intra-diff)
- Invariants stack (Next 16, Supabase, FSRS, images, PWA)

## Verdict
**<PRÊT À COMMITTER | À CORRIGER AVANT COMMIT>**
```

Verdict logic:
- Any 🔴 finding → **À CORRIGER AVANT COMMIT**
- Only 🟠 / 🟡 → **PRÊT À COMMITTER** + mention "à traiter en suivi"
- Zero findings → **PRÊT À COMMITTER**

## Decision rules

1. **Read-only.** Never run `git add`, `git commit`, `git stash`, `git restore`, or any `Edit` / `Write` tool. If asked to also fix, refuse and point to `/project-review` reporting and a separate fix turn.
2. **Single pass.** Do not re-read files multiple times. Read once, then apply all checks.
3. **Wiki wins.** When the check grid above contradicts `wiki/conventions.md`, follow the wiki and flag the discrepancy in the report so the skill can be updated.
4. **No false positives from rename diffs.** A pure rename (file moved, identical content) → skip the file.
5. **Generated files.** Skip `.next/`, `node_modules/`, `*.lock`, `package-lock.json` — these should rarely appear in a diff anyway.
6. **Conversation language = French.** The user is French-speaking; the report sections / labels stay in French as in the template above. The skill instructions stay in English (project doc convention).
7. **Don't argue with the user about findings.** Report what you see, with `file:line`. The user decides what to fix.
