# Anamnèse

App de mémorisation / culture générale / flashcards, propulsée par Claude pour la génération de contenu et FSRS pour la répétition espacée.

**Flow** : recherche d'un thème → explication + image → création d'une flashcard (terme + définition courte) → révision en QCM puis saisie libre.

## Stack

- **Next.js 16** (App Router, Server Actions) + TypeScript + Tailwind v4
- **Supabase** (Auth + Postgres + RLS)
- **Anthropic Claude** (génération explications + cartes + distracteurs QCM)
- **`ts-fsrs`** (Free Spaced Repetition Scheduler)
- **Images** : pipeline hybride Wikimedia Commons → Unsplash → Google Custom Search
- **Déploiement** : Vercel

## Démarrage rapide

```bash
npm install
cp .env.local.example .env.local   # puis remplis les valeurs
npm run dev
```

Le détail pour récupérer chaque clé d'API, configurer Supabase et déployer sur Vercel est dans **[SETUP.md](./SETUP.md)**.

## Scripts

- `npm run dev` — serveur de dev sur http://localhost:3000
- `npm run build` — build production
- `npm run start` — démarre le build
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint
- `npm run test` — vitest (tests unitaires FSRS)
