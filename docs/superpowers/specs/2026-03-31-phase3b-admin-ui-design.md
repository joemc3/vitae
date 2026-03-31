# Phase 3b: Admin UI — Design Spec

**Date:** 2026-03-31
**Status:** Approved
**Depends on:** Phase 3a (Sites & Generator Wiring) — complete

## Overview

Full rebuild of the React admin app against the current Python API. Guts existing Tauri-era page components, keeps the Vite/React/TypeScript/Tailwind skeleton. Delivers a coherent admin experience covering all features through Phase 3a: documents, profile, job postings, site generation, and settings.

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Component library | shadcn/ui (Radix + Tailwind) | Copied into repo, no UI dependency |
| Server state | TanStack Query (React Query) | Caching, refetching, loading/error states |
| Auth state | React Context | Existing pattern, refreshed |
| Routing | React Router v6 | Already in place |
| HTTP client | Axios | Existing setup in `services/api.ts` |
| Dark mode | System-preference + manual toggle | shadcn CSS variables + class toggle |

## Layout

Persistent left sidebar with five sections:

1. **Documents** — upload and manage professional documents
2. **Profile** — view, edit, and synthesize professional profile
3. **Job Postings** — add and manage job postings
4. **Sites** — generate and manage portfolio/targeted sites
5. **Settings** — API keys, models, username, preferences

Sidebar collapses to icon rail on narrow viewports. Top area of sidebar shows app branding; bottom shows current user and dark mode toggle.

## Pages

### Auth

**Login** — email + password form, link to register.

**Register** — email + password form, link to login.

Both redirect to Documents page on success.

### Documents

Single page. Drag-and-drop upload zone at top, document list below.

- Upload via `POST /api/documents` (multipart). New doc appears in list with processing status badge.
- Each row: filename, type, upload date, status badge.
- Click row to expand and view parsed text.
- Delete button with confirmation dialog.
- Empty state prompts first document upload.

### Profile

Single page displaying synthesized profile data (name, summary, skills, experience, education).

- **Synthesize button** triggers `POST /api/profile/synthesize`. SSE stream shows real-time progress inline.
- **Inline editing** — click any section to edit, save via `PATCH /api/profile`.
- If no profile exists, shows empty state prompting document upload + synthesis.

### Job Postings

**List page:**
- Table with title, company, date, action buttons.
- "Add Job Posting" navigates to create page.
- Click any row to view/edit. Delete with confirmation.
- Empty state explains job postings and prompts to add one.

**Create page:**
- Three tabs at top: **Paste URL**, **Paste Text**, **Manual Entry**.
- URL tab: URL input + "Extract" button → calls `POST /api/job-postings/from-url` → populates form below for review/edit → "Save" calls `POST /api/job-postings`.
- Text tab: textarea + "Extract" button → calls `POST /api/job-postings/from-text` → same review/save flow.
- Manual tab: full form (title, company, description, requirements) → "Save" calls `POST /api/job-postings`.
- LLM extraction returns a draft (not persisted). User reviews, edits, then explicitly saves.

**Edit page:**
- Same form as create, pre-populated. Save via `PUT /api/job-postings/:id`.

### Sites

Single list page showing all generated sites.

Each row shows:
- Type badge (Portfolio / Targeted)
- Theme name
- Status badge (queued → generating → ready / failed)
- Generated date
- Public URL (clickable link, visible when ready)

**Portfolio site behavior:**
- One portfolio site at a time. "Generate Portfolio" button picks a theme and triggers `POST /api/sites/portfolio`.
- Stale badge shown when `stale: true` (profile updated since last generation), with "Regenerate" action.
- No delete — portfolio is overwritten on regeneration.

**Targeted site behavior:**
- "Generate Targeted" button picks a job posting + theme, triggers `POST /api/sites/targeted`.
- Each targeted site gets a unique slug URL.
- Delete button with confirmation (removes site and output files).

**Status polling:**
- React Query `refetchInterval` on the sites list while any site has status `queued` or `generating`.
- Stops polling when all sites are `ready` or `failed`.

**Failed sites:**
- Show error badge + `error_message` from API.
- Retry action triggers a new generation request.

**Empty state:** explains portfolio vs targeted sites, prompts to generate portfolio first.

### Settings

Single page with sections:

**Username** (prominent if unset):
- Input with validation: 3-50 chars, lowercase alphanumeric + hyphens, starts with letter, no reserved words, globally unique.
- Save via `PUT /api/auth/username`.

**API Keys:**
- Per-provider: add/remove encrypted API key.
- Test connection button per provider.
- `POST /api/settings/api-keys`, `DELETE /api/settings/api-keys/:provider`, `POST /api/settings/test-connection`.

**Model Selection:**
- Dropdown per provider showing available models from `GET /api/settings/models/:provider`.
- Save via `PUT /api/settings/api-keys/:provider/model`.

## Username Gate

Site generation requires a username. If unset:
- "Generate Portfolio" and "Generate Targeted" buttons are disabled.
- Tooltip/message links to Settings page to set username.
- Settings page shows username section prominently with a callout.

## Error Handling

**API errors:** React Query error states — inline error banner with retry button per query/page.

**Mutation errors:** Inline error message near the triggering action (save, delete, generate buttons).

**401 responses:** Axios interceptor redirects to login and clears auth context.

## Loading States

- Skeleton loaders for lists and content areas (shadcn Skeleton component).
- Disabled buttons with spinner during mutations.
- SSE progress display during profile synthesis.

## Empty States

Each section has a purposeful empty state:
- **Documents:** prompt to upload first document
- **Profile:** prompt to upload documents then synthesize
- **Job Postings:** explain what they are, prompt to add one
- **Sites:** explain portfolio vs targeted, prompt to generate portfolio first

## Dark Mode

- Default follows system preference (`prefers-color-scheme`).
- Manual toggle in sidebar (persisted to localStorage).
- Implemented via shadcn's `dark` class on root element + CSS variables.

## Navigation

Sidebar is always visible on desktop. On mobile/narrow viewports, collapses to icon rail with expand-on-tap.

Active section is highlighted. Sections:
- Documents (`/app/documents`)
- Profile (`/app/profile`)
- Job Postings (`/app/job-postings`, `/app/job-postings/new`, `/app/job-postings/:id`)
- Sites (`/app/sites`)
- Settings (`/app/settings`)

Auth pages (`/login`, `/register`) have no sidebar.

## Out of Scope

- Theme design/previews (Phase 3c)
- Resume PDF generation (Phase 3d)
- Toast/notification system
- Optimistic updates
- Real-time collaboration
- Mobile-first responsive design (functional on mobile, optimized for desktop)
