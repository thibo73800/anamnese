# Images pipeline

## Orchestrateur

[`lib/images/index.ts`](../lib/images/index.ts) — `findImage(query)` :

```
Wikimedia Commons  →  Unsplash  →  Google CSE  →  null
   (gratuit, pas         (clé         (clés +
    de clé requise)      Access)      quota 100/j)
```

Chaque source est tentée séquentiellement ; la première qui retourne un `ImageHit` non-null gagne. Erreurs loggées en `console.warn`, jamais remontées à l'UI (tomber silencieusement sur la suivante est le comportement voulu).

## Quand est-ce appelé

Exclusivement depuis `search/page.tsx` (Server Component) **et** uniquement si `explainTheme` a répondu `needsImage: true`. Le LLM décide si une image aide ou non — pas besoin d'en forcer une pour chaque carte (ex: concept abstrait genre "empathie", l'image rarement pertinente).

Fallback UI : si `findImage` renvoie `null`, la section image n'est juste pas rendue, pas de broken image icon.

## Sources

### Wikimedia Commons ([`lib/images/wikimedia.ts`](../lib/images/wikimedia.ts))

- API MediaWiki publique `commons.wikimedia.org/w/api.php`
- Query : `action=query&generator=search&gsrsearch=<query> filetype:bitmap|drawing&gsrnamespace=6`
- Récupère 3 résultats + `imageinfo` (url, dimensions, extmetadata)
- Filtre : `width >= 320` (ignore les trop petits → souvent des logos/icônes)
- Attribution : `Artist · License` extraits de `extmetadata`
- Revalidate 24h

### Unsplash ([`lib/images/unsplash.ts`](../lib/images/unsplash.ts))

- Endpoint `api.unsplash.com/search/photos`
- Header `Authorization: Client-ID <UNSPLASH_ACCESS_KEY>`
- `per_page=1, content_filter=high, orientation=landscape`
- Attribution obligatoire (Terms Unsplash) : `<name> / Unsplash`
- Skip silencieusement si pas de clé

### Google Custom Search ([`lib/images/google.ts`](../lib/images/google.ts))

- Endpoint `www.googleapis.com/customsearch/v1`
- Paramètres `searchType=image&safe=active&imgSize=medium`
- Requiert `GOOGLE_CSE_ID` + `GOOGLE_CSE_KEY`
- **Quota gratuit 100 req/j**, puis $5/1000 → fallback de dernier recours
- Skip silencieusement si une des deux clés manque

## Route API interne

[`app/api/image-search/route.ts`](../app/api/image-search/route.ts) — `GET /api/image-search?q=<query>`, protégé par auth. Utile pour une future UX "Changer d'image" depuis le CardEditor ou une page de détail — à ce jour pas encore branché côté UI.

## Stockage

Une fois choisie, on stocke dans `cards` :
- `image_url` (chaîne)
- `image_source` (`wikimedia` | `unsplash` | `google`) — **nullable**, `null` quand l'utilisateur a collé une URL personnalisée depuis le CardEditor
- `image_attribution` (crédit à afficher sous l'image) — `null` pour URL custom

L'image est servie en `<img src>` direct (pas via `next/image`) pour éviter le casse-tête des remote patterns quand la source est Google CSE (domaines arbitraires). Tradeoff : pas d'optimisation auto de Vercel, mais les images Wikimedia et Unsplash sont déjà servies depuis des CDN optimisés.

## URL personnalisée

Dans le `CardEditor` (création + édition) l'utilisateur peut :
- Retirer l'image auto (bouton "Retirer l'image") → `image_url` / `image_source` / `image_attribution` repassent à `null`.
- Coller une URL (champ input) → remplace l'image auto. `image_source` + `image_attribution` passent à `null` (pas de source canonique pour une URL arbitraire).
- Restaurer l'image auto (bouton "Restaurer l'image auto") → remet les valeurs initiales.

Validation légère : `z.string().url()` côté server action. Pas de check MIME (l'user assume le rendu).

## Affichage : composant `ImagePreview`

[`components/image-preview.tsx`](../components/image-preview.tsx) — utilisé partout (CardEditor, ReviewCardQcm, ReviewCardTyping) depuis 2026-04-19 :

- Hauteur fixe configurable (`heightClass`, défaut `h-56`) — layout stable.
- `object-contain` **pas** `object-cover` → plus de crop, les proportions originales sont respectées.
- Clic sur l'image → Dialog plein écran (max 95vw × 85vh), image en grand + attribution dessous.
- Légère animation `hover:scale-[1.02]` pour signaler que c'est cliquable.

`ThemeExplanation` n'affiche plus l'image depuis 2026-04-19 — elle a été déplacée dans le `CardEditor` pour éviter le doublon visuel sur la page de recherche.

## Légende

Affichée par `ImagePreview` sous l'image quand `attribution` est fourni :

```tsx
<figcaption className="bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
  {attribution}
</figcaption>
```

Rendre ce crédit visible est requis par les CGU d'Unsplash et une bonne pratique pour Wikimedia. Pour les URL custom, pas d'attribution affichée.
