# Setup — Anamnèse

Guide pas-à-pas pour passer de zéro à "l'app tourne en local + déployée sur Vercel".

## 1. Prérequis

- **Node.js ≥ 20 LTS** (testé sur Node 24). Vérif : `node --version`.
- **npm** (fourni avec Node). `pnpm` optionnel.
- Un compte sur chacun de ces services (tous ont un tier gratuit suffisant pour démarrer) :
  - [GitHub](https://github.com)
  - [Vercel](https://vercel.com)
  - [Supabase](https://supabase.com)
  - [Anthropic Console](https://console.anthropic.com)
  - [Unsplash Developers](https://unsplash.com/developers)
  - [Google Cloud Console](https://console.cloud.google.com) (optionnel, pour Custom Search)

## 2. Cloner et installer

```bash
git clone <url-du-repo>
cd anamnese
npm install
cp .env.local.example .env.local
```

Ensuite, ouvre `.env.local` et remplis les valeurs en suivant la section 3.

## 3. Récupérer les variables d'environnement

Pour chaque variable : **à quoi ça sert**, **où la trouver**, **quel plan tarifaire / quotas**.

### 3.1 Supabase

Trois variables : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

1. Crée un projet sur https://supabase.com/dashboard → **New project**.
   - Nom : `anamnese`
   - Région : choisir proche de tes utilisateurs (ex : `eu-west-3` pour la France)
   - Mot de passe DB : stocke-le dans un gestionnaire de mots de passe
2. Une fois le projet provisionné (1-2 min), va dans **Project Settings → API** :
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Project API Keys → `anon public`** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Project API Keys → `service_role`** → `SUPABASE_SERVICE_ROLE_KEY`
     - ⚠️ Cette clé **bypasse la RLS**. Jamais dans le bundle client, jamais commitée.
3. **Authentication → Providers** :
   - Email : laissé activé par défaut
   - Google (optionnel) : suit la [doc Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google)
4. **Authentication → URL Configuration** :
   - **Site URL** : `http://localhost:3000` en dev, ton URL Vercel en prod
   - **Redirect URLs** : ajoute les deux
5. Applique les migrations SQL :
   ```bash
   npx supabase link --project-ref <ref-du-projet>   # le ref est dans l'URL du dashboard
   npx supabase db push
   ```
   Alternative sans CLI : copie-colle le contenu de `supabase/migrations/0001_init.sql` dans **SQL Editor** du dashboard.

**Plan** : tier gratuit (500 MB DB, 50k MAU, 5 GB bandwidth). Largement suffisant pour MVP.

### 3.2 Anthropic — `ANTHROPIC_API_KEY`

Sert à appeler Claude pour générer explications + flashcards + distracteurs QCM.

1. Crée un compte sur https://console.anthropic.com.
2. **Settings → API Keys → Create Key**. Donne-lui un nom parlant (ex : `anamnese-local-dev`).
3. Copie la valeur (affichée **une seule fois**, commence par `sk-ant-api...`).
4. **Settings → Billing** : ajoute un mode de paiement. Pas de free tier permanent mais des crédits offerts à l'inscription.

**Modèle utilisé par défaut** : `claude-sonnet-4-6` (bon équilibre qualité/coût). Configurable dans `lib/anthropic/client.ts`.

### 3.3 Unsplash — `UNSPLASH_ACCESS_KEY`

Sert au fallback images quand Wikimedia ne renvoie rien.

1. Inscris-toi sur https://unsplash.com/developers.
2. **Your apps → New Application**. Accepte les Terms.
3. Dans la page de l'app, copie **Access Key** → `UNSPLASH_ACCESS_KEY`.
   - Pas besoin de Secret Key (on ne fait que des GET publics côté serveur).
4. Demande l'upgrade "Production" via le bouton dédié (petit formulaire, validation automatique sous 24-48h).

**Quotas** : 50 req/h en démo, 5000 req/h en Production. Gratuit dans les deux cas. Règle UX : Unsplash impose de créditer le photographe quand l'image est affichée — ce crédit est stocké en `image_attribution`.

### 3.4 Google Custom Search (optionnel) — `GOOGLE_CSE_ID`, `GOOGLE_CSE_KEY`

Ultime fallback image si ni Wikimedia ni Unsplash ne renvoient rien de pertinent. **Peut rester vide pour le MVP** — le pipeline le détectera et ne tentera pas d'appel.

1. **GOOGLE_CSE_ID** :
   - Va sur https://programmablesearchengine.google.com/ → **Add**
   - Coche "Search the entire web" + active **Image search** dans les paramètres
   - Copie le **Search Engine ID** (format : `xxxxxxxxxxxxxxxxxxxx`)
2. **GOOGLE_CSE_KEY** :
   - https://console.cloud.google.com/apis/credentials → **Create credentials → API key**
   - Dans **APIs & Services → Library**, active **Custom Search API** pour le projet
   - Copie la clé API

**Quotas** : 100 requêtes gratuites/jour, puis $5/1000. Le code ne tombera sur Google que si Wikimedia ET Unsplash ont échoué, donc ça reste marginal.

## 4. Lancer en local

```bash
npm run dev
# ouvre http://localhost:3000
```

Première vérif : crée un compte, connecte-toi, recherche un thème comme "Renaissance italienne" → tu devrais voir l'explication + image + carte préremplie.

## 5. Déployer sur Vercel

1. Push ton code sur GitHub : `git push origin main`.
2. Va sur https://vercel.com/new → importe le repo.
   - Framework : Next.js détecté automatiquement, rien à configurer.
3. **Environment Variables** (dans l'écran d'import ou après, via **Settings → Environment Variables**) :
   - Ajoute **toutes** les variables de `.env.local`
   - Pour chacune, coche au minimum **Production** et **Preview**
   - `SUPABASE_SERVICE_ROLE_KEY` : coche aussi Development si tu veux `vercel env pull` en local
4. Clique **Deploy**. Premier déploiement ≈ 2-3 min.
5. Récupère l'URL de prod (`https://anamnese-xxx.vercel.app`) et **retourne sur Supabase → Auth → URL Configuration** pour l'ajouter aux Redirect URLs.

Tout push sur `main` redéploie automatiquement.

## 6. Dépannage rapide

| Symptôme | Cause probable | Solution |
|---|---|---|
| `Invalid JWT` côté Supabase | Cookie session pas rafraîchi | Vérifier que `proxy.ts` est bien au root et que le matcher inclut toutes les routes app |
| Anthropic `401 invalid x-api-key` | Clé invalide ou pas de crédit | Vérifier `ANTHROPIC_API_KEY`, et la page Billing |
| Cartes créées mais images absentes | Pipeline image échoue silencieusement | Regarder les logs serveur (`npm run dev`), tester `/api/image-search?q=test` |
| `RLS policy violation` | User pas identifié côté server action | L'action doit utiliser le client `createServerClient` de `lib/supabase/server.ts`, pas le client browser |
| Build Vercel échoue sur types | PageProps/LayoutProps pas encore générés | Exécuter `npx next typegen` localement pour vérifier, commit les types générés si nécessaire |

## 7. Architecture express

- `app/(auth)/{login,signup}` : pages publiques Supabase Auth.
- `app/(app)/*` : routes protégées (session requise, check dans le layout).
- `app/actions/` : Server Actions (theme, cards, review).
- `lib/supabase/` : clients browser + server + proxy.
- `lib/anthropic/` : client Claude + prompts (avec prompt caching).
- `lib/images/` : pipeline hybride Wikimedia → Unsplash → Google CSE.
- `lib/fsrs/` : wrapper `ts-fsrs` + `deriveMode` (QCM vs saisie selon stability).
- `supabase/migrations/` : SQL versionné.
- `proxy.ts` : rafraîchissement de session Supabase sur chaque requête (Next.js 16 appelle ça "Proxy", c'est l'ancien middleware).
