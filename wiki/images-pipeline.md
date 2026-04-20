# Images pipeline

## Orchestrator

[`lib/images/index.ts`](../lib/images/index.ts) — `findImage(query)`:

```
Wikimedia Commons  →  Unsplash  →  Google CSE  →  null
   (free, no key       (Access        (keys +
    required)           Key)           quota 100/day)
```

Each source is tried sequentially; the first one returning a non-null `ImageHit` wins. Errors are logged as `console.warn`, never surfaced to the UI (silent fall-through to the next source is the intended behavior).

## When is it called

Exclusively from `search/page.tsx` (Server Component) **and** only when `explainTheme` returned `needsImage: true`. The LLM decides whether an image helps — no need to force one for every card (e.g. an abstract concept like "empathy" rarely benefits from an image).

UI fallback: if `findImage` returns `null`, the image section simply isn't rendered, no broken image icon.

## Sources

### Wikimedia Commons ([`lib/images/wikimedia.ts`](../lib/images/wikimedia.ts))

- Public MediaWiki API `commons.wikimedia.org/w/api.php`
- Query: `action=query&generator=search&gsrsearch=<query> filetype:bitmap|drawing&gsrnamespace=6`
- Pulls 3 results + `imageinfo` (url, dimensions, extmetadata)
- Filter: `width >= 320` (skip too-small hits — often logos/icons)
- Attribution: `Artist · License` extracted from `extmetadata`
- Revalidate 24h

### Unsplash ([`lib/images/unsplash.ts`](../lib/images/unsplash.ts))

- Endpoint `api.unsplash.com/search/photos`
- Header `Authorization: Client-ID <UNSPLASH_ACCESS_KEY>`
- `per_page=1, content_filter=high, orientation=landscape`
- Attribution required (Unsplash ToS): `<name> / Unsplash`
- Silently skipped if no key

### Google Custom Search ([`lib/images/google.ts`](../lib/images/google.ts))

- Endpoint `www.googleapis.com/customsearch/v1`
- Params `searchType=image&safe=active&imgSize=medium`
- Requires `GOOGLE_CSE_ID` + `GOOGLE_CSE_KEY`
- **Free quota 100 req/day**, then $5/1000 → last-resort fallback
- Silently skipped if either key is missing

## Internal API route

[`app/api/image-search/route.ts`](../app/api/image-search/route.ts) — `GET /api/image-search?q=<query>`, auth-protected. Useful for a future "Change image" UX from the CardEditor or a detail page — not yet wired into the UI.

## Storage

Once picked, we store into `cards`:
- `image_url` (string)
- `image_source` (`wikimedia` | `unsplash` | `google`) — **nullable**, `null` when the user pasted a custom URL in the CardEditor
- `image_attribution` (credit to show below the image) — `null` for custom URLs

Images render via `<img src>` directly (not `next/image`) to avoid the `remotePatterns` headache when the source is Google CSE (arbitrary domains). Trade-off: no automatic Vercel optimization, but Wikimedia and Unsplash images are already served from optimized CDNs.

## Custom URL

In the `CardEditor` (create + edit) the user can:
- Remove the auto image ("Remove image" button) → `image_url` / `image_source` / `image_attribution` reset to `null`.
- Paste a URL (input field) → replaces the auto image. `image_source` + `image_attribution` become `null` (no canonical source for an arbitrary URL).
- Restore the auto image ("Restore auto image" button) → resets to the initial values.

Light validation: `z.string().url()` on the server action side. No MIME check (user takes the rendering risk).

## Display: the `ImagePreview` component

[`components/image-preview.tsx`](../components/image-preview.tsx) — used throughout (CardEditor, ReviewCardQcm, ReviewCardTyping):

- Configurable fixed height (`heightClass`, default `h-56`) — stable layout.
- `object-contain` **not** `object-cover` → no crop, original proportions respected.
- Click the image → full-screen Dialog (max 95vw × 85vh), large image + attribution below.
- Subtle `hover:scale-[1.02]` animation to signal it's clickable.

`ThemeExplanation` no longer renders the image — it lives in the `CardEditor` instead, to avoid visual duplication on the search page.

## Caption

Rendered by `ImagePreview` below the image whenever `attribution` is provided:

```tsx
<figcaption className="bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
  {attribution}
</figcaption>
```

Showing this credit is required by Unsplash's ToS and good practice for Wikimedia. For custom URLs, no attribution is shown.

## See also

- [[conventions#images--plain-img-tag]] — why not `next/image`, `object-contain`
- [[data-model]] — `image_url` / `image_source` / `image_attribution` columns
- [[architecture#create-a-card-flow]] — where `findImage` is called
