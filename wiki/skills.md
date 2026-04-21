# Claude Code skills

The repo ships two Claude Code skills with different installation models:

- **`.claude/skills/project-review/`** — project-level, auto-loaded by Claude Code when working in this repo. Available to anyone who clones it; no install step.
- **`skills/anamnese/`** — packaged for user-level install, because it operates from *any* Claude Code conversation (not just this repo) using personal API credentials.

## `.claude/skills/project-review/` (project-level)

Pre-commit code review specific to this repo. Produces a severity-graded report (🔴 Bloquants / 🟠 À corriger / 🟡 Suggestions) on a diff scope. Read-only — never edits, stages, or commits.

- **Manifest**: `.claude/skills/project-review/SKILL.md` — scope resolution, check grid, report format.
- **Install**: none. Auto-loaded when Claude Code opens this repo.
- **Invocation**: `/project-review` with optional scope arg.

| Arg | Scope | Underlying git command |
|---|---|---|
| *(none)* | WIP — staged + unstaged | `git diff HEAD` |
| `staged` | Index only | `git diff --cached` |
| `commit <sha>` | Single commit | `git show <sha>` |
| `commits <sha1>..<sha2>` | Range | `git diff <sha1>..<sha2>` |
| `branch` | Branch vs `main` | `git diff main...HEAD` |

The skill loads [[conventions]], [[auth-flow]], and [[data-model]] at every run, so any new invariant added to the wiki is automatically picked up — there is no second checklist to maintain. The check grid in `SKILL.md` is the starting point for the three axes (security, DRY/maintainability, Anamnèse-specific invariants); when the grid contradicts the wiki, the wiki wins.

## `skills/anamnese/` (user-level)

Push, edit, list, or query flashcards in the user's Anamnèse deck from any Claude Code conversation. Calls the public REST API documented in [[api]].

- **Manifest**: `skills/anamnese/SKILL.md` — activation triggers (FR/EN), card shape, decision rules, full API reference with curl examples.
- **Install**: `ln -s "$(pwd)/skills/anamnese" ~/.claude/skills/anamnese` (lives outside `.claude/skills/` so it's a deliberate per-user opt-in, not auto-loaded just by working in this repo).
- **Requires**: env vars `ANAMNESE_API_KEY` (raw key from `/settings/api-keys`) and `ANAMNESE_API_URL`.
- **Activates on**: phrases like "retiens ça", "mémorise", "ajoute une carte", "save to Anamnèse". Never unprompted.

## Adding a new skill

Pick the location based on scope:

- **Project-only behavior** (review tooling, repo-specific helpers, docs assistants): `.claude/skills/<name>/SKILL.md`. Auto-loaded, committed, shared with anyone who clones the repo.
- **Personal / cross-project tooling** (calls a personal API, requires user credentials): `skills/<name>/SKILL.md` + a README documenting the symlink install.

Then:

1. Frontmatter `name` + `description`. Follow the format used by the two skills above (markdown sections: *When to use*, *Procedure*, *Decision rules*).
2. Document the skill here under a new `##` section.
3. If the skill consumes the public API, also link to it from [[api#claude-code-skills]].

## See also

- [[api]] — REST surface used by `skills/anamnese/`
- [[conventions]] — invariants enforced by `.claude/skills/project-review/`
- [[operations]] — credential rotation and setup
