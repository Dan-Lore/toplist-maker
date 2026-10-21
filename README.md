# toplist-maker

Build a **personal ranking** of anything through pairwise duels (A vs B) — not by dragging a tier list and not by copying someone else's scores.

Public portfolio project. Product notes: [`docs/product.md`](docs/product.md).

## Status

Private MVP works locally:

1. Load a sample list, import JSON, or reopen local history
2. Run a duel tournament **or** open an already finished ranking
3. Export list / ranking as portable JSON; history stays in IndexedDB (cloud later)

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
