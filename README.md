# toplist-maker

Build a **personal ranking** of anything through pairwise duels (A vs B) — not by dragging a tier list and not by copying someone else's scores.

Public portfolio project. Product notes: [`docs/product.md`](docs/product.md).

## Status

Private MVP works locally:

1. Load a sample list, import JSON, or reopen local history
2. Run a duel tournament **or** open an already finished ranking
3. Export list / ranking as portable JSON; history stays in IndexedDB (cloud later)
4. Fetch posters from **Shikimori** and/or **MAL (Jikan)** — Auto tries Shiki first, then MAL

## Stack

Vite+ · Vue 3 · TypeScript · Pinia · Vue Router · Dexie · Vitest

## Develop

Requires [Vite+](https://viteplus.dev/guide/) (`vp`) or use the project-local CLI via pnpm.

```bash
# Windows PowerShell (once): irm https://vite.plus/ps1 | iex
# Then in a new shell:
. "$env:APPDATA\vite-plus\env.ps1"

vp install
vp dev
```

Useful commands:

```bash
vp test
vp check
vp build
```

## Sample data

`public/samples/shiki-completed-seed.json` — 16 completed titles seeded from the old ToplistMaker Shiki export (for local MVP only).

## Posters

On setup, pick **Posters** provider and **Fetch posters**:

| Provider  | Behavior                                                                              |
| --------- | ------------------------------------------------------------------------------------- |
| Auto      | Shikimori (`shikimori.io`) CDN/GraphQL first; fill gaps via Jikan if `malId` is known |
| Shikimori | CDN preview/original + GraphQL/REST on `shikimori.io` (legacy `.one` URLs rewritten)  |
| MAL       | Jikan v4 images (`malId`, or discover via Shiki when only Shiki id is present)        |

Duel cards also try a static fallback chain (`imageUrl` → Shiki CDN) with `referrerpolicy="no-referrer"`.

If a poster is missing, hover the placeholder for a short tip: plain-language reason + a `code=…` debug line (`no_ids`, `provider_needs_mal_id`, `cdn_all_failed`, …).

## Live demo

GitHub Pages: https://dan-lore.github.io/toplist-maker/

Deploys automatically from `main` via `.github/workflows/deploy-pages.yml`.
