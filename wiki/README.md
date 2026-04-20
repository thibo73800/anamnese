# Wiki Anamnèse

Doc interne du projet. **Mise à jour à la fin de chaque session de travail** pour que la prochaine session démarre avec le contexte à jour.

## Index

- [Architecture](./architecture.md) — découpe Next.js, flux de données, responsabilités par couche
- [Data model](./data-model.md) — schéma Postgres, indexes, RLS, conventions
- [FSRS & modes](./fsrs.md) — initialisation, rating, seuil QCM → saisie, JSON round-trip
- [Auth flow](./auth-flow.md) — signup, login, callback PKCE, proxy guard, admin scripts
- [Images pipeline](./images-pipeline.md) — Wikimedia → Unsplash → Google CSE
- [LLM prompts](./llm-prompts.md) — prompt système theme-explain, schéma Zod, prompt caching
- [Operations](./operations.md) — setup env, migration SQL, déploiement Vercel, dépannage
- [Decisions log](./decisions.md) — journal chronologique des choix techniques

## Protocole de mise à jour

À la fin d'une session où quelque chose de structurant a bougé :

1. **Ajouter une entrée datée** dans [`decisions.md`](./decisions.md) — problème rencontré, solution, impact.
2. **Mettre à jour la page concernée** du wiki si la vérité d'architecture a changé (pas juste un bug fix).
3. **Synchroniser `CLAUDE.md`** (racine du repo) si un gotcha nouveau mérite d'être dans le contexte initial de chaque session.
4. **Mettre à jour la mémoire** (`~/.claude/projects/<projet>/memory/`) si on a appris quelque chose sur l'utilisateur ou ses préférences.

Ne pas dupliquer — chaque info a **une seule source de vérité**. CLAUDE.md = contexte court pour démarrer, wiki = doc détaillée, memory = préférences utilisateur transversales.
