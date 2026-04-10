# Vitae — Admin UI

React SPA for managing documents, editing the synthesized profile, and generating portfolio/targeted sites and resume PDFs. This is the **admin surface** of Vitae, served on its own subdomain (`app.*`) and separate from the public sites.

See the root [`CLAUDE.md`](../CLAUDE.md) for project-wide architecture. This README is scoped to `src-ui/`.

## Tech Stack

- **React 18** + **TypeScript** + **Vite 5**
- **Tailwind CSS** with **shadcn/ui** components on **Radix UI** primitives
- **TanStack Query** for server state (cache, invalidation, mutation)
- **React Router 6** for routing
- **Axios** for HTTP with JWT interceptor
- **lucide-react** for icons
- `class-variance-authority` + `clsx` + `tailwind-merge` for component variants

## Running

The supported dev workflow is Docker Compose from the repo root:

```bash
docker compose --profile dev up --build -d
```

The admin app is then available on `http://localhost:5173` and the API on `http://localhost:8000`. See the root README / CLAUDE.md for the full stack.

For a local-only frontend loop (API still required — run it separately), from `src-ui/`:

```bash
npm install
npm run dev        # Vite dev server on :5173, proxies /api → :8000
npm run build      # tsc + vite build → dist/
npm run lint       # ESLint strict (0 warnings)
npm run format     # Prettier
```

The Vite dev server proxies `/api/*` to `http://localhost:8000` (see `vite.config.ts`). Override the API base URL at build time with `VITE_API_URL` if you need to hit a non-proxied backend.

## Routing

All authenticated routes are nested under `/app` behind a `ProtectedRoute` guard that reads the JWT from the `AuthContext`.

| Route | Page |
|---|---|
| `/login` | `pages/login.tsx` |
| `/register` | `pages/register.tsx` |
| `/app` | redirects → `/app/documents` |
| `/app/documents` | Upload, list, delete documents |
| `/app/profile` | Synthesized profile editor + photo upload |
| `/app/job-postings` | List saved job postings |
| `/app/job-postings/new` | Create via URL scrape, paste, or manual entry |
| `/app/job-postings/:id` | Edit saved posting |
| `/app/sites` | Portfolio + targeted site generation, previews, list |
| `/app/resumes` | Generate and download general + targeted resume PDFs |
| `/app/settings` | LLM provider keys, model selection, test connection |

Unmatched routes redirect to `/app`.

## Directory Layout

```
src-ui/
├── src/
│   ├── App.tsx                # Routes + ProtectedRoute
│   ├── main.tsx               # Entry, providers, router
│   ├── layouts/
│   │   └── app-layout.tsx     # Shell for /app/* (sidebar, topbar, outlet)
│   ├── pages/                 # One file per route above
│   ├── components/
│   │   ├── PhotoUpload.tsx    # Drag-and-drop profile photo
│   │   ├── PreviewModal.tsx   # Theme preview iframe
│   │   ├── ThemeGallery.tsx   # Theme picker with screenshots
│   │   └── ui/                # shadcn/ui primitives
│   ├── hooks/                 # One TanStack Query hook per API resource:
│   │                          # use-documents, use-profile, use-job-postings,
│   │                          # use-sites, use-resumes, use-settings,
│   │                          # use-preview, use-theme
│   ├── contexts/
│   │   └── auth-context.tsx   # JWT state, login/logout/register
│   ├── providers/
│   │   └── theme-provider.tsx # Dark/light mode
│   ├── services/
│   │   └── api.ts             # Axios client + typed endpoint wrappers
│   ├── types/                 # Shared API/domain types
│   └── lib/                   # cn(), small utilities
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

## Data Layer

All server state lives in TanStack Query. Each API resource has one hook file in `src/hooks/` that exposes query + mutation hooks (e.g. `useDocuments`, `useUploadDocument`, `useDeleteDocument`). Pages consume hooks — never call `api.ts` directly.

`services/api.ts` is the single source of typed endpoint wrappers. It:

1. Creates a shared `axios` instance at `VITE_API_URL || ''` (empty falls back to Vite's `/api` proxy).
2. Attaches `Authorization: Bearer <token>` from `localStorage.authToken` on every request.
3. On `401`, clears the token and redirects to `/login`.

## Authentication

JWT-based. `AuthContext` (`contexts/auth-context.tsx`) holds the token + user and persists to `localStorage`. `ProtectedRoute` in `App.tsx` gates `/app/*`. Login and register pages call the auth endpoints through `api.ts`; everything else flows through TanStack Query hooks.

## Styling

- Tailwind with shadcn/ui conventions (CSS variables for theme tokens, `cn()` helper in `lib/utils.ts`).
- `components/ui/` contains the generated shadcn primitives. Treat them as owned code — edit in place rather than re-running a generator.
- Dark/light mode is driven by `theme-provider.tsx` using a `class` strategy on `<html>`.

## Linting

`npm run lint` runs ESLint with `--max-warnings 0`. CI and local dev both fail on any warning — fix or explicitly disable with a justified inline comment.
