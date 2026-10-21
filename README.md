# toplist-maker

Build a **personal ranking** of anything through pairwise duels (A vs B) — not by dragging a tier list and not by copying someone else's scores.

Public portfolio project. Product notes: [`docs/product.md`](docs/product.md).

## Status

Private MVP works locally:

1. Load sample list (Shikimori-style JSON seed)
2. Run duel tournament
3. See ranking (saved in IndexedDB via Dexie)

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

## Live demo

GitHub Pages: https://dan-lore.github.io/toplist-maker/

Deploys automatically from `main` via `.github/workflows/deploy-pages.yml`.
