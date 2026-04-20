# Anamnèse — Claude Code skill

This directory is a Claude Code skill that lets Claude push flashcards to your Anamnèse deck from any conversation.

## Install

1. Generate an API key: sign in to your Anamnèse deployment, go to `/settings/api-keys`, click **Créer une clé**, copy the raw key (shown once).
2. Export env vars in your shell (`~/.zshrc` or `~/.bashrc`):

   ```bash
   export ANAMNESE_API_KEY="ana_sk_..."
   export ANAMNESE_API_URL="https://anamnese.vercel.app"   # your deployment
   ```

3. Symlink this directory into Claude Code's user-level skills:

   ```bash
   ln -s "$(pwd)/skills/anamnese" ~/.claude/skills/anamnese
   ```

4. Start a new Claude Code session. Say something like *"retiens-moi ce concept …"* — the skill should activate automatically.

## Structure

- `SKILL.md` — the skill manifest Claude reads (activation rules, API reference, decision rules).

No wrapper script — the skill uses `curl` directly via the Bash tool.

## Update the key

Revoke an old key from `/settings/api-keys`, create a new one, update `ANAMNESE_API_KEY` in your shell, `source ~/.zshrc`.
