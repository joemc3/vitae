# Phase 3d: Resume PDF Generation — Design Spec

## Overview

Generate professional resume PDFs from the synthesized profile. Two flavors: general resumes (from the full profile) and targeted resumes (LLM-tailored to a specific job posting). PDFs are rendered by WeasyPrint from Jinja2 HTML/CSS templates styled to match the site theme system, plus a plain black-on-white option for conservative contexts.

## Product Model

The document repository is the core asset. Resumes are another view into it — shaped by context (general vs. targeted to a specific role). The LLM does real content tailoring, not just reordering: rewriting summaries, rephrasing bullets, emphasizing relevant experience, and dropping irrelevant content.

### General Resume
- Generated from the full synthesized profile
- Available for download in the admin UI
- Optionally published as a static PDF on the public portfolio site (`resume.joe.com/resume.pdf`), served by Nginx
- Marked stale when the profile is updated — user decides when to regenerate

### Targeted Resume
- Generated for a specific job posting
- Full LLM tailoring: rewritten summary, reprioritized experience, matched skills, adjusted language
- Available for download in the admin UI
- Not publicly served (user downloads and attaches to applications)
- Marked stale when the profile is updated

## Architecture

### Pipeline

Single-service sequential pipeline in the Python worker:

```
LOAD → TAILOR → RENDER → MEASURE → [TRIM] → FINALIZE
```

1. **Load** — fetch profile, job posting (if targeted), resume record from DB
2. **Tailor** — LLM call produces resume-specific structured content (`ResumeContent` JSON)
3. **Render** — Jinja2 template + theme CSS → HTML → WeasyPrint → PDF
4. **Measure** — count pages in rendered PDF
5. **Trim** (conditional) — if pages exceed target, re-prompt LLM with "you produced N pages, target is M, condense." Max 2 trim attempts.
6. **Finalize** — save PDF to disk, update DB record, copy to public output dir if general resume

### LLM Tailoring

For general resumes, the LLM distills the full profile into resume format: concise bullets, strong action verbs, quantified achievements, prioritized by impact. Page target is included in the prompt so the LLM calibrates density.

For targeted resumes, the LLM also receives the job posting and is instructed to: rewrite the summary to address the role, reorder and rephrase experience bullets to emphasize relevant work, surface matching skills, and drop less relevant content.

The LLM outputs structured JSON matching a `ResumeContent` schema:
- `summary` — professional summary (tailored if targeted)
- `experience[]` — company, title, dates, bullets (prioritized/rephrased)
- `skills[]` — categorized, ordered by relevance
- `education[]` — degree, institution, dates, highlights
- `certifications[]` — name, issuer, date
- `projects[]` — name, description, tech, highlights (optional, included based on relevance)
- `publications[]` — title, venue, date (optional)
- `awards[]` — name, issuer, date (optional)
- `languages[]` — language, proficiency (optional)

This content is stored in the resume record's `tailored_content` JSONB column for re-rendering without another LLM call.

### Two-Pass Page Fitting

Users specify a page target (1–4 pages). The LLM aims for it on the first pass. After rendering, if the PDF exceeds the target, the system sends a follow-up prompt: "The rendered resume is N pages but the target is M. Here's what you produced: [content]. Condense to fit M pages — cut less important items, tighten bullets, reduce whitespace-heavy sections."

Max 2 trim attempts. If the PDF still overflows after 2 tries, accept the result — the user can regenerate with adjusted settings.

## Data Model

### `resumes` table

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK → users |
| job_posting_id | UUID (nullable) | FK → job_postings. Null = general resume |
| profile_id | UUID | FK → profiles. Which profile version was used |
| theme | VARCHAR | Theme slug: onyx, coral, serene, jade, quartz, plain |
| page_target | INTEGER | User-requested page count (1–4) |
| actual_pages | INTEGER (nullable) | Final rendered page count |
| status | VARCHAR | queued → generating → tailoring → rendering → ready / failed |
| file_path | VARCHAR (nullable) | Path to generated PDF on disk |
| tailored_content | JSONB (nullable) | LLM-generated content for re-rendering |
| error_message | TEXT (nullable) | Error details if failed |
| stale | BOOLEAN | Set true when profile changes after generation |
| created_at | TIMESTAMP | |
| generated_at | TIMESTAMP (nullable) | When PDF was successfully generated |

**Stale detection:** When a profile is updated (PUT, PATCH, or re-synthesize), all resumes for that user are marked `stale = true`. Same pattern as sites.

## API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST /api/resumes/general` | JWT | Generate general resume |
| `POST /api/resumes/targeted` | JWT | Generate targeted resume for a job posting |
| `GET /api/resumes` | JWT | List all resumes with stale indicators |
| `GET /api/resumes/:id` | JWT | Get resume details and status |
| `GET /api/resumes/:id/download` | JWT | Download PDF (admin) |
| `DELETE /api/resumes/:id` | JWT | Delete resume and PDF file |

### Request Bodies

`POST /api/resumes/general`:
```json
{
  "theme": "onyx",
  "page_target": 2
}
```

`POST /api/resumes/targeted`:
```json
{
  "job_posting_id": "uuid",
  "theme": "coral",
  "page_target": 1
}
```

Both return the resume record immediately with `status: "queued"`. Client polls `GET /api/resumes/:id` for status updates.

### Public Download

Not an API route. When a general resume is generated, the PDF is copied to the site output directory. Nginx serves it at the configured SITE_URL path (e.g. `resume.joe.com/resume.pdf`). The portfolio site template includes a download link.

## Resume Templates

### Template Architecture

Jinja2 HTML templates with companion CSS files, one per theme plus a base template and the plain option:

```
src-api/app/templates/resume/
├── base.html.j2              # Shared structure, @page rules, section ordering
├── plain.html.j2 + plain.css # Black on white, system fonts, no color
├── onyx.html.j2 + onyx.css   # Minimal, gradient dividers, light typography
├── coral.html.j2 + coral.css # Warm accent stripe, amber markers, skill pills
├── serene.html.j2 + serene.css
├── jade.html.j2 + jade.css
├── quartz.html.j2 + quartz.css
```

### Base Template Responsibilities

- `@page` CSS rules for margins and page size (US Letter)
- Conditional section rendering (skip sections with no content)
- Page break hints (`break-inside: avoid` on entries)
- Header: name, title, contact info
- Optional page numbers in footer

### Theme Template Responsibilities

Each theme extends the base and overrides:
- Font families (matching the site theme — embedded via WeasyPrint's font support)
- Accent colors for headings, dividers, section markers
- Layout personality (e.g. Coral uses a colored sidebar accent; Onyx uses subtle horizontal rules)

### Plain Template

- System fonts (no web fonts)
- Black text on white background, no color
- Clean horizontal rules between sections
- Maximum content density
- The "just give me a normal resume" option for conservative contexts

## Admin UI

### Resume Section (new sidebar item)

- List view: all generated resumes with type (general/targeted), theme, page count, date, stale badge
- "Generate General Resume" button — opens dialog to pick theme and page target
- Each row: download button, delete button
- Status polling for in-progress generations (same pattern as sites)

### Job Posting View (enhancement)

- "Generate Resume" button alongside existing "Generate Targeted Site"
- Opens dialog pre-filled with the job posting context, user picks theme and page target

### Portfolio Settings (enhancement)

- Toggle to include/exclude resume download link on public portfolio
- Shows current general resume status: ready, stale, or none

## File Layout

### New Files

```
src-api/
├── app/
│   ├── models/resume.py
│   ├── schemas/resume.py
│   ├── routers/resumes.py
│   ├── services/resume_generator.py
│   └── templates/resume/
│       ├── base.html.j2
│       ├── plain.html.j2 + plain.css
│       ├── onyx.html.j2 + onyx.css
│       ├── coral.html.j2 + coral.css
│       ├── serene.html.j2 + serene.css
│       ├── jade.html.j2 + jade.css
│       └── quartz.html.j2 + quartz.css
├── migrations/versions/010_create_resumes_table.py
└── tests/
    ├── unit/test_resumes_router.py
    └── unit/test_resume_generator.py

src-ui/src/
├── pages/resumes/
├── components/resume/
└── lib/api.ts  (resume API functions added)
```

### Modified Files

- `src-api/app/main.py` — register resumes router
- `src-api/app/worker.py` — add `generate_resume_job`
- `src-api/app/routers/profile.py` — mark resumes (and sites) stale on profile update
- `src-ui/src/components/layout/Sidebar.tsx` — add Resumes nav item
- `src-ui/src/pages/job-postings/[id].tsx` — add Generate Resume button
- `docker-compose.yml` / API `Dockerfile` — WeasyPrint system dependencies (libpango, libcairo, libgdk-pixbuf)
- `src-api/pyproject.toml` — add `weasyprint` dependency

## Dependencies

**WeasyPrint** requires system-level libraries: Cairo, Pango, GDK-Pixbuf. The API Dockerfile needs:
```dockerfile
RUN apt-get update && apt-get install -y \
    libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf2.0-0 \
    libcairo2 libffi-dev shared-mime-info
```

**Jinja2** is already a transitive dependency of FastAPI.

## Testing Strategy

- **Unit tests** for router endpoints (mock service layer)
- **Unit tests** for resume generator (mock LLM client, test template rendering, test page measurement)
- **Integration tests** for full pipeline: profile → tailor → render → PDF on disk
- Template rendering tests: verify each theme produces valid HTML, WeasyPrint renders without error
- Stale detection tests: verify resumes marked stale on profile update
