# Anamnèse wiki

Internal project docs. Describes **current state only** — no history, no decision dates, no changelog. Git handles archaeology.

Primary consumer: Claude in a future session. Navigation optimized for "quickly find what is true right now".

**All wiki pages are written in English.** Conversations with the user may be in French, but the wiki stays in English to align with code identifiers and industry standards.

## Index

| Page | Content | Keywords |
|---|---|---|
| [[conventions]] | Transverse invariants to scan at the start of a session | Next 16 proxy, Server Actions, UTC dates, shadcn, cookies, FSRS Again-only, qcm_choices, rate limit, Anthropic keys, PWA no-cache SW, mobile nav |
| [[architecture]] | Next.js App Router breakdown, key components, create / review / batch flows | App Router, RSC, Server Actions, BatchCreator, ReviewSession |
| [[data-model]] | Postgres schema, indexes, RLS, `updated_at` trigger, migrations | cards, reviews, fsrs_state, qcm_choices, RLS, GIN, ISO-8601 |
| [[auth-flow]] | Signup/login/logout, PKCE callback, proxy guards, admin scripts, Supabase config | Supabase Auth, PKCE, emailRedirectTo, Redirect URLs, service_role |
| [[fsrs]] | `ts-fsrs` wrapper, rating, QCM→typing threshold, client-side queue, tests | FSRS-4.5, stability, deriveMode, ReviewSession, Again |
| [[images-pipeline]] | Orchestrator Wikimedia → Unsplash → Google CSE, storage, ImagePreview | findImage, ImageHit, object-contain, attribution, custom URL |
| [[llm-prompts]] | Sonnet 4.6 client, `theme-explain`, `theme-refine`, batch tool use, costs | Anthropic SDK, Zod structured output, prompt cache, tool use |
| [[operations]] | Setup, migrations, Vercel deployment, troubleshooting, credential rotation | .env.local, Dashboard SQL Editor, Vercel, email rate limit |
| [[api]] | Public REST surface — Bearer auth, endpoints, Zod schemas, error codes | `/api/v1/*`, api_keys, SHA-256, Claude Code skill |

## If you're looking for…

- **Create a user without the email flow** → [[auth-flow#admin-scripts-signup-bypass]]
- **Add cards from outside the PWA (Claude Code, curl, …)** → [[api]] + `skills/anamnese/SKILL.md`
- **Generate or revoke an API key** → `/settings/api-keys` in the app; schema in [[data-model#publicapi_keys]]
- **Apply a SQL migration** → [[operations#db-migration]]
- **Why the SQL index refuses the `::timestamptz` cast** → [[conventions#dates--serialization]] + [[data-model#why-no-timestamptz-cast-in-the-index]]
- **Tune the QCM / typing threshold** → [[fsrs#qcm--typing-threshold]]
- **Understand why the next card appears instantly** → [[architecture#review-flow]]
- **Why the correct answer isn't stored in `qcm_choices`** → [[conventions#qcm_choices--shape]] + [[fsrs#card-orientation-definition--term]]
- **Add an image source** → [[images-pipeline#sources]]
- **Enable a longer cache on a prompt** → [[llm-prompts#possible-evolutions]]
- **Understand what `proxy.ts` does** → [[auth-flow#proxy-guards]] + [[conventions#nextjs-16]]
- **Fix an Anthropic `credit balance too low`** → [[conventions#anthropic-keys--org-scoped]] + [[operations#common-troubleshooting]]
- **Install the app on a phone / understand the PWA setup** → [[conventions#pwa--minimal-service-worker-no-offline-cache]] + [[conventions#mobile-navigation--hamburger--sheet]]

## Update methodology

At the end of every session, a single question: **"what do I change in the wiki so the next Claude quickly finds the current state?"**

1. Code has changed → is the relevant topic page still accurate? If not, **rewrite in the present tense** (never "previously we did X, now…"). Update file references.
2. A transverse rule changed or appeared → [[conventions]].
3. A new troubleshooting symptom → [[operations#common-troubleshooting]].
4. A cited code file was renamed/moved → grep the wiki for the old path, fix.
5. **Never** add "on YYYY-MM-DD we decided…". If it's true, it's in the present; if it's dead, it disappears; if it's an invariant, it goes to `conventions.md` without a date.

### Structural rules

- **Language**: the wiki is **always in English**. Even when conversations with the user happen in French. This matches the code's identifiers and common industry conventions.
- **No duplication**: each fact has a single reference page. Other pages link to it.
- **Intra-wiki links = Obsidian wikilinks** `[[name]]` or `[[name#anchor]]`, no `./`, no `.md`. Robust to file moves.
- **Code links** = classic relative paths from the repo root: `lib/fsrs/engine.ts`, `app/actions/cards.ts`.
- **`## See also`** at the bottom of every topic page (2-4 wikilinks) — this is our backlink system.
- **Restructuring**: the `wiki/` root tolerates up to ~10 files. Beyond that, group by domain into subfolders (`wiki/domain/`, `wiki/stack/`, etc.) and update the index above. Wikilinks `[[name]]` survive the move as long as names stay unique.

## Scope

- **In the wiki**: current state of the system (architecture, schema, flows, invariants, recurring troubleshooting).
- **Not in the wiki**: changelog (`git log`), archived decisions (`~/.claude/plans/`), user preferences (`~/.claude/projects/<project>/memory/`).
- **`CLAUDE.md` at the repo root** = short onboarding + pointers to this wiki. See its "Wiki" section.
