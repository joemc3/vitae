# Vitae — Site Generator

Next.js 14 static site generator for Vitae portfolio and targeted job-application sites. Invoked as a subprocess by the Python worker — not a long-running server.

See the root [`CLAUDE.md`](../CLAUDE.md) for project-wide architecture. This README is scoped to `src-generator/`.

## Role in the Stack

```
Admin UI  →  API / worker (Python)  →  node generate.js  →  Next.js static export  →  Nginx
```

The worker (`src-api/app/services/site_generator.py`) spawns this generator as:

```bash
node /app/generator/generate.js --input <input.json>
```

`input.json` contains `{ site_id, output_dir, portfolio_data }`. The generator writes `portfolio_data` to `.data/portfolio-data.json`, runs `next build` (which exports to `out/`), then copies `out/` into `output_dir` for Nginx to serve.

## Tech Stack

- **Next.js 14** with App Router, `output: 'export'`, `trailingSlash: true`
- **React 18**, **TypeScript**
- **Tailwind CSS** (per-theme configs)
- **Vitest** + **@testing-library/react** for unit tests

## Running

### As part of the stack

The Python worker invokes the generator directly — there is no dev workflow to "run the generator". Start the full stack from the repo root:

```bash
docker compose --profile dev up --build -d
```

Then generate a site through the admin UI (`/app/sites`) or the `POST /api/sites/portfolio` / `POST /api/sites/targeted` endpoints.

> **Note:** As of the Vitae rename, the worker container does not yet install Node or copy `src-generator/` into the image. Site generation currently requires running the worker on the host where this directory and Node are reachable. This is a known Phase 3e-B deployment task — see root `CLAUDE.md`.

### Standalone (theme development)

For iterating on a theme with live reload, run the Next.js dev server against sample data:

```bash
cd src-generator
npm install
npm run dev        # Next.js on :3000, reads sample-data/showcase.json
```

Use the sample data in `sample-data/showcase.json` as the fixture. The preview route (`app/preview/[id]/`) is what the admin UI's theme preview iframe hits in production.

### Direct CLI invocation

```bash
node generate.js --input /path/to/input.json
```

`input.json` shape:

```jsonc
{
  "site_id": "abc123",
  "output_dir": "/data/output/abc123",
  "portfolio_data": {
    "siteType": "portfolio" | "targeted",
    "theme": { "name": "onyx" },
    "profile": { ... },
    // ...rest of the profile schema
  }
}
```

### Scripts

```bash
npm run dev        # Next.js dev server
npm run build      # Static export → out/
npm run lint       # next lint
npm run format     # Prettier
npm test           # Vitest run
npm run test:watch # Vitest watch
```

## Themes

Five production themes ship today. Each theme must implement both a `portfolio.tsx` and a `targeted.tsx` entry so it can render either `siteType`, and declare its capabilities via `theme.config.ts`.

| Slug | Audience | Notes |
|---|---|---|
| `onyx` | Developers, engineers | Dark, technical, sharp edges |
| `jade` | — | See `app/themes/jade/theme.config.ts` |
| `coral` | — | See `app/themes/coral/theme.config.ts` |
| `quartz` | — | See `app/themes/quartz/theme.config.ts` |
| `serene` | — | See `app/themes/serene/theme.config.ts` |

### Theme structure

```
app/themes/<slug>/
├── theme.config.ts    # ThemeConfig export (slug, name, fonts, colors, supports)
├── fonts.ts           # next/font declarations
├── portfolio.tsx      # Portfolio site entry
├── targeted.tsx       # Targeted site entry
├── styles/            # Theme-specific CSS / Tailwind layers
└── components/        # Theme-specific components (nav, hero, footer, etc.)
```

`ThemeConfig` is defined in `app/types/theme-config.ts`:

```ts
interface ThemeConfig {
  slug: string;
  name: string;
  description: string;
  audience: string;
  fonts: { heading: string; body: string };
  colors: { primary: string; accent: string; background: string; surface: string; text: string };
  supports: { portfolio: boolean; targeted: boolean };
}
```

## Content Primitives

Themes compose shared primitives from `app/primitives/` rather than reimplementing common building blocks. This keeps theme code focused on layout and style, not data wrangling.

Current primitives (`app/primitives/index.ts`):

- **Structural**: `Section`, `SectionList`, `ConditionalRender`
- **Hero / header**: `HeroBanner`, `ContactBar`, `PhotoFrame`
- **Timeline / experience**: `TimelineEntry`, `DateRange`
- **Work artifacts**: `ProjectCard`, `PublicationItem`, `AwardItem`, `CertificationItem`, `LanguageItem`
- **Skills**: `SkillGroup`
- **Utility**: `ExternalLink`

Prefer adding to primitives over duplicating markup across themes. If a new theme needs a visual treatment no existing primitive supports, extend the primitive with options rather than forking it inside the theme directory.

## Directory Layout

```
src-generator/
├── app/
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Dispatches to the active theme
│   ├── globals.css          # Tailwind directives + shared resets
│   ├── types/
│   │   ├── portfolio.ts     # Profile/portfolio data shape
│   │   └── theme-config.ts  # ThemeConfig interface
│   ├── lib/                 # Data loading helpers
│   ├── primitives/          # Shared cross-theme building blocks
│   ├── themes/              # coral | jade | onyx | quartz | serene
│   └── preview/[id]/        # Preview route hit by admin UI iframe
├── sample-data/
│   └── showcase.json        # Fixture for local dev
├── __tests__/               # Vitest suites
├── public/                  # Static assets (theme thumbnails, etc.)
├── generate.js              # CLI entry: --input <path>
├── Dockerfile
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## Preview System

The admin UI's theme gallery renders live previews by POSTing to `/api/preview`, which writes rendered HTML that the generator's `app/preview/[id]/` route serves back via an unguessable ID. See `src-api/app/routers/preview.py` for the server side and `src-ui/src/components/PreviewModal.tsx` for the client.

## Adding a Theme

1. Create `app/themes/<slug>/` mirroring an existing theme's structure.
2. Implement `theme.config.ts` with `supports.portfolio` and/or `supports.targeted` set.
3. Implement `portfolio.tsx` and/or `targeted.tsx` composing primitives from `app/primitives/`.
4. Add theme-specific components under `components/` and styles under `styles/`.
5. Drop a thumbnail at `public/themes/<slug>/thumbnail.png` for the admin gallery.
6. Register the theme in the dispatcher so `app/page.tsx` can route to it.
7. Add a Vitest case under `__tests__/` that renders the theme against `sample-data/showcase.json`.

## Testing

```bash
npm test             # one-shot
npm run test:watch   # watch mode
```

Tests use Vitest with `jsdom` and `@testing-library/react`. Cover both `portfolio` and `targeted` renders per theme.
