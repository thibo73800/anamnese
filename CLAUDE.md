@AGENTS.md

# Anamnèse — context for Claude

Memorization / general-knowledge / flashcard PWA. Flow: search a theme → LLM explanation (markdown, follow-up Q&A possible) + image → flashcard (term + definition + stored explanation) → FSRS review. **Card orientation**: we show the **definition** and the user guesses the **term** (4-choice MCQ while `stability < 2d` — short familiarization phase — free text input afterwards so FSRS calibrates `stability` on the real retrieval signal).

## Documentation language

**All project documentation is written in English, even when our conversations happen in French.** This covers `CLAUDE.md`, `AGENTS.md`, everything under `wiki/`, and any README added to the repo. Talk with the user in French; write files in English. Rationale: code identifiers are English, industry conventions are English, and mixing languages in the doc makes cross-references brittle.

## Locked stack

- **Next.js 16** (App Router, Server Actions, Turbopack) + TypeScript + Tailwind v4 + shadcn/ui
- **Supabase**: Auth (email/password) + Postgres + RLS
- **Anthropic Claude** via `@anthropic-ai/sdk`, default model `claude-sonnet-4-6`
- **`ts-fsrs`** (FSRS-4.5)
- **Images**: hybrid pipeline Wikimedia Commons → Unsplash → Google CSE
- Deployed on **Vercel** (online-only; minimal service worker registered solely to satisfy PWA installability on Chrome Android, no offline cache)

## Common gotchas

Before touching code, read **[`wiki/conventions.md`](./wiki/conventions.md)** — cross-cutting invariants (Next 16 `proxy`, `params`/`searchParams` as Promises, Server Actions without `export type`, SQL indexes without casts, Supabase cookies, email rate limit, IPv6-only free tier, shadcn without `asChild`, org-scoped Anthropic keys, stacked migrations, shape of `qcm_choices`, FSRS Again-only, images without `next/image`, API routes via service-role with mandatory `.eq('user_id', …)` filtering, API keys hashed SHA-256, `lib/cards/repository.ts` as single CRUD source, proxy exemption for `/api/v1/*`).

Symptom → cause → fix troubleshooting: [`wiki/operations.md`](./wiki/operations.md) section "Common troubleshooting".

## Useful commands

```bash
npm run dev         # dev server (Turbopack)
npm run build       # production build
npm run typecheck   # tsc --noEmit
npm run test        # vitest (FSRS)
npm run lint        # eslint

# Admin scripts (requires .env.local loaded)
set -a && source .env.local && set +a
node scripts/admin-create-user.mjs <email> <password>
node scripts/admin-reset-user.mjs <email>
```

## Wiki

Detailed documentation lives in [`wiki/`](./wiki/). It describes **the current state only** — no history, no decision dates, no changelog. Git handles archaeology.

**When to read the wiki**: before touching a subsystem, open the matching page to check the invariants you must respect.

- Architecture / flows: [`wiki/architecture.md`](./wiki/architecture.md)
- DB schema / RLS / indexes: [`wiki/data-model.md`](./wiki/data-model.md)
- Auth / proxy / admin scripts / Bearer auth: [`wiki/auth-flow.md`](./wiki/auth-flow.md)
- FSRS / review modes: [`wiki/fsrs.md`](./wiki/fsrs.md)
- Image pipeline: [`wiki/images-pipeline.md`](./wiki/images-pipeline.md)
- Claude prompts: [`wiki/llm-prompts.md`](./wiki/llm-prompts.md)
- Public REST API (Bearer-auth'd): [`wiki/api.md`](./wiki/api.md)
- Claude Code skills shipped with the repo (`.claude/skills/project-review/`, `skills/anamnese/`): [`wiki/skills.md`](./wiki/skills.md)
- Setup / migrations / deployment / troubleshooting: [`wiki/operations.md`](./wiki/operations.md)
- **Cross-cutting conventions and invariants**: [`wiki/conventions.md`](./wiki/conventions.md) ← scan at the start of every session

Intra-wiki links use the Obsidian `[[name]]` format (path-independent). Links pointing at source code keep normal relative paths.

### Update methodology

At the end of every session, one question: **"what do I change in the wiki so that the next Claude easily finds the current state?"**

1. Code changed → is the relevant topic page still true? If not, rewrite **in the present tense, in English** (never "previously we did X, now…"). Update file references (`lib/…`, `components/…`, `supabase/migrations/…`).
2. A cross-cutting rule changed or appeared → [`wiki/conventions.md`](./wiki/conventions.md).
3. A new troubleshooting symptom → `wiki/operations.md` "Common troubleshooting" section.
4. A referenced source file has been renamed or moved → grep the wiki for the old path, fix it.
5. **Never** add "on YYYY-MM-DD we decided…". If it's true, write it in the present tense; if it's dead, delete it; if it's an invariant, put it in `conventions.md` without a date.
6. **Language**: English-only applies everywhere — the wiki, this file, and every other doc in the repo.

**No duplication**: every fact has a single reference page; the others link to it.

**Restructuring**: the `wiki/` root tolerates **up to ~10 files**. Beyond that, group by domain in subfolders (`wiki/domain/`, `wiki/stack/`, etc.) and update the index in `wiki/README.md`. Wikilinks `[[name]]` survive moves as long as names stay unique.

## Persistent memory

The `~/.claude/projects/<project>/memory/` directory holds:
- user profile (francophone, prefers recommendations framed with trade-offs)
- locked stack + reasons
- collaboration preferences (grouped questions, Q&A before code)
