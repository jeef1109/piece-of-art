# Piece of Art

A responsive Next.js recreation of the Piece of Art jigsaw experience. It includes 120 catalogued paintings across 12 themed gallery rooms (public-domain museum works plus explicitly tracked user-provided artwork), a persistent personal collection, a deterministic daily painting, generated interlocking cuts, 9/16/25/36/49/64-piece difficulty, temporary hints, pointer and touch dragging, correct-slot snapping, healing browser-generated music, interaction sounds, bilingual copy, and responsive game and completion screens.

## Run locally

Requires Node.js 24 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## GitHub Pages

The public site is published at [jeef1109.github.io/piece-of-art](https://jeef1109.github.io/piece-of-art/).
Push to `main` to run the tests, export the static website, and deploy through GitHub Actions.

```bash
npm ci
npm run build:pages
```

The exported website is in `out/`. The Pages build uses `/piece-of-art` as its base path;
override `NEXT_PUBLIC_BASE_PATH` when deploying under a different path. Normal local development
still runs at `/`. No backend or secret environment variables are required. Puzzle progress
is stored in the visitor's browser, so local and published URLs have separate collections.

Artwork provenance is recorded in `docs/research/piece-of-art/artwork-sources.json`.
The code license does not grant rights to third-party artwork, fonts, or user-provided assets.

## Checks

```bash
npm run lint
npm run typecheck
npm run build
```

Research notes and the source-to-local asset map live in `docs/research/piece-of-art/`.

The generated catalog lives at `src/components/sites/piece-of-art/paintingCatalog.generated.ts`. Rebuild it from The Metropolitan Museum of Art Open Access dataset with:

```bash
node scripts/build-painting-catalog.mjs
```
