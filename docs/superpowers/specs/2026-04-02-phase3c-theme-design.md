# Phase 3c: Theme Design — Design Spec

## Overview

Design and implement 5 visually distinct themes for public-facing portfolio and targeted sites. Each theme has its own typography, color palette, layout, hero treatment, and component styling. Themes are built on a shared primitives library that handles data loading, conditional rendering, and accessibility. The admin UI gets a redesigned theme picker with live preview using the user's real profile data.

## Scope

- **In scope:** 5 public-facing themes (Onyx, Coral, Serene, Jade, Quartz), primitives library, expanded data contract, photo support, live preview, theme picker redesign, new API endpoints
- **Out of scope:** Admin app theming (already has light/dark from Phase 3b), resume PDF generation (Phase 3d), theme customization options (color overrides, etc.)

## Architecture: Composition Model

Themes are full React component trees that compose from a shared primitives library. Primitives handle data, conditional rendering, and accessibility. Themes control layout, styling, and visual treatment.

```
Primitives Library (shared)
    ├── Structural: Section, SectionList, ConditionalRender
    ├── Content: HeroBanner, TimelineEntry, ProjectCard, SkillGroup,
    │            ContactBar, CertificationItem, PublicationItem,
    │            AwardItem, LanguageItem
    └── Utility: PhotoFrame, DateRange, ExternalLink

Theme (per-theme)
    ├── theme.config.ts     → metadata for admin UI
    ├── portfolio.tsx        → portfolio layout composition
    ├── targeted.tsx         → targeted layout composition
    ├── styles/theme.css     → theme-specific CSS
    ├── components/          → custom wrapper components
    └── fonts/               → bundled Google Fonts
```

Each primitive accepts a `className` prop for theme styling. Primitives render semantic HTML. A theme can skip any primitive and render raw data directly if it needs full custom control.

## Data Contract

The generator receives `PortfolioData` as input JSON. This expands the current contract to cover the full profile schema (aligned with JSON Resume).

```typescript
interface PortfolioData {
  profile: {
    fullName: string;           // required
    title: string;              // required
    summary?: string;
    photo?: string;             // NEW — URL to uploaded image
    location?: string;          // NEW
  };
  contact: {
    email?: string;
    phone?: string;
    website?: string;
    socialLinks?: SocialLink[]; // { platform, url }
  };
  workExperience: WorkExperience[];   // company, title, dates, highlights
  projects: Project[];                // name, description, role, technologies, outcomes
  education: Education[];             // institution, degree, field, dates
  skills: SkillCategory[];            // category + items[]
  certifications: Certification[];    // NEW — name, issuer, date, credential_id
  publications: Publication[];        // NEW — title, venue, date, url
  awards: Award[];                    // NEW — title, issuer, date, description
  volunteer: Volunteer[];             // NEW — organization, role, dates, description
  languages: LanguageSkill[];         // NEW — language, proficiency
  theme: {
    name: string;
    layoutOptions?: Record<string, unknown>;
  };
  siteType: "portfolio" | "targeted"; // NEW
  jobPosting?: {                      // NEW — for targeted sites
    company: string;
    title: string;
    description: string;
  };
}
```

All array sections are conditionally rendered — if empty or null, the section does not appear. The primitives library handles this check so themes don't reimplement it.

## Primitives Library

### Structural Primitives

- **`<Section>`** — Wrapper that auto-hides when its data is empty. Renders a heading with an anchor ID for in-page navigation. Accepts `className` for theme styling.
- **`<SectionList>`** — Renders a list of items with empty-state handling. Generic over item type.
- **`<ConditionalRender>`** — Renders children only if the provided data is non-null and non-empty.

### Content Primitives

- **`<HeroBanner>`** — Name, title, summary, optional photo. Theme controls layout (full-width, compact, split) via props and children. The primitive handles data and photo loading.
- **`<TimelineEntry>`** — A dated item: company/institution, role/degree, date range, description/highlights. Used for work experience, education, and volunteer sections.
- **`<ProjectCard>`** — Project name, description, technologies, outcomes. Theme decides rendering: card grid, list, or other.
- **`<SkillGroup>`** — Category label + skill items. Theme decides tags, bars, lists, or grids.
- **`<ContactBar>`** — Email, phone, website, social links with platform icons.
- **`<CertificationItem>`** — Name, issuer, date obtained, expiration, credential ID.
- **`<PublicationItem>`** — Title, venue, date, URL.
- **`<AwardItem>`** — Title, issuer, date, description.
- **`<LanguageItem>`** — Language name + proficiency level.

### Utility Primitives

- **`<PhotoFrame>`** — Handles image loading, fallback placeholder, aspect ratio. Theme controls shape (circle, square, rounded) via props.
- **`<DateRange>`** — Formats start/end dates consistently, renders "Present" for current roles.
- **`<ExternalLink>`** — Link with icon, opens in new tab, accessible attributes.

## Five Themes

### Onyx — Dark, Technical, Sharp

- **Audience:** Developers, engineers
- **Typography:** JetBrains Mono (headings), Inter (body)
- **Palette:** Dark surfaces (#0a0a0a), subtle blue-violet accents, high-contrast text
- **Hero (portfolio):** Full-width dark hero with terminal-inspired aesthetic, monospace name/title, optional photo in rounded square
- **Hero (targeted):** Compact header with role and target company prominently displayed
- **Layout personality:** Code-inspired UI elements, skills as syntax-highlighted tags, skill bars with gradient fills, sharp edges
- **Section order (portfolio):** Hero → Summary → Skills → Experience → Projects → Education → Certifications → Publications → Awards → Volunteer → Languages → Contact
- **Targeted variant:** More focused — leads with relevant skills and experience, role-match summary, streamlined sections

### Coral — Warm, Bold, Energetic

- **Audience:** Creative professionals, designers
- **Typography:** Poppins 700 (headings), DM Sans (body)
- **Palette:** Warm coral (#d4553a), amber accent (#f4a261), dark text on light warm backgrounds
- **Hero (portfolio):** Split hero — large photo on one side, name/title/summary on the other, bold color accent
- **Hero (targeted):** Color-blocked header with company/role emphasis and creative layout
- **Layout personality:** Visual cards for projects, energetic spacing, color accents on section transitions, rounded corners
- **Section order (portfolio):** Hero → Projects → Experience → Skills → Education → Awards → Publications → Certifications → Volunteer → Languages → Contact
- **Targeted variant:** Projects and relevant experience foregrounded, achievements highlighted with color callouts

### Serene — Clean, Minimal, Spacious

- **Audience:** Consultants, executives
- **Typography:** Source Serif 4 (headings), Source Sans 3 (body)
- **Palette:** Near-white backgrounds (#fafbfc), subtle gray borders, minimal accent color
- **Hero (portfolio):** No hero banner — compact header with name, title, and optional small photo. Content starts immediately.
- **Hero (targeted):** Same compact header, with subtle "Prepared for [Company]" line
- **Layout personality:** Maximum whitespace, content breathes, subtle dividers between sections, understated elegance. Every element earns its place.
- **Section order (portfolio):** Header → Summary → Experience → Education → Skills → Projects → Certifications → Publications → Awards → Volunteer → Languages → Contact
- **Targeted variant:** Even more distilled — focuses on the narrative, removes visual chrome

### Jade — Earthy, Balanced, Sophisticated

- **Audience:** Academics, researchers
- **Typography:** Libre Baskerville (headings), Nunito Sans (body)
- **Palette:** Earthy greens (#3d6b4f primary, #8fb380 secondary), warm off-white backgrounds (#f4f7f2)
- **Hero (portfolio):** Institutional-feel header with name, title, and affiliations. Optional photo with academic framing.
- **Hero (targeted):** Header with research focus area and target institution/company
- **Layout personality:** Structured, balanced two-column option, publications and education sections elevated, citation-style formatting for publications
- **Section order (portfolio):** Hero → Summary → Publications → Education → Experience → Projects → Skills → Awards → Certifications → Volunteer → Languages → Contact
- **Targeted variant:** Research-match summary, relevant publications foregrounded, teaching/mentoring experience highlighted

### Quartz — Light, Crisp, Corporate

- **Audience:** Business and finance professionals
- **Typography:** Clean sans-serif (Inter or similar for both headings and body), heavier weights for hierarchy
- **Palette:** White backgrounds, navy/blue accent (#3355cc), structured gray tones
- **Hero (portfolio):** Compact professional header with photo, name, title, and key metrics or achievement headline
- **Hero (targeted):** Professional header with company name and role, metrics-forward
- **Layout personality:** Structured grid, metrics and quantified results highlighted, achievement callouts, clean lines, corporate-friendly
- **Section order (portfolio):** Header → Summary → Experience → Skills → Projects → Education → Certifications → Awards → Publications → Volunteer → Languages → Contact
- **Targeted variant:** Leads with relevant experience and quantified achievements, role-alignment summary

## Layout Modes

Each theme ships with two layout compositions:

- **Portfolio mode** — comprehensive showcase of the full professional profile. Long-form, scrollable, all populated sections displayed.
- **Targeted mode** — focused for a specific job opportunity. Content is AI-tailored by the worker before reaching the generator. Layout is more directed: leads with role-relevant sections, includes job-match context, may reorder or condense sections.

Both modes receive the same `PortfolioData` contract. The `siteType` field tells the theme which layout to render. The `jobPosting` field provides context for targeted layouts.

## Live Preview System

### New Generator Mode

The generator gains a preview mode alongside the existing static build mode:

- **Static build** (existing): `node generate.js --input input.json` → runs `next build` + `next export` → writes static files to output directory
- **Preview mode** (new): Generator runs in SSR mode. The API calls into it to render a theme server-side and return HTML. Sub-second response time vs. 10-30s for a full build.

### New API Endpoints

**`GET /api/themes`** — List available themes with metadata.

Response:
```json
[
  {
    "slug": "onyx",
    "name": "Onyx",
    "description": "Dark, technical, sharp edges",
    "audience": "Developers, engineers",
    "fonts": { "heading": "JetBrains Mono", "body": "Inter" },
    "colors": { "primary": "#0a0a0a", "accent": "#7c8aff", "background": "#0a0a0a", "text": "#e0e0e0" }
  },
  ...
]
```

Source: reads `theme.config.ts` from each theme directory in the generator.

**`GET /api/themes/preview/{slug}?type=portfolio|targeted`** — Render a live preview with the user's profile data.

Flow:
1. Load user's profile data from DB
2. Write to temp directory
3. Call generator in preview (SSR) mode
4. Return rendered HTML
5. Cache for the session — re-render only if profile data changed

### Admin UI Integration

The theme picker in site generation dialogs is redesigned:

1. Dialog opens → theme card grid loads (metadata from `GET /api/themes`)
2. Each card shows: name, description, audience tag, color swatch strip
3. User clicks a card → card gets selected border, preview panel loads iframe from preview endpoint
4. For targeted sites: job posting selector appears above the theme grid
5. User can click between themes, preview updates each time
6. "Generate" button confirms selection and kicks off the existing generation pipeline

Preview panel: lower portion of dialog or side panel on wide screens, scaled-down but scrollable iframe, loading state during SSR render.

## Photo Support

### Upload Flow

1. User uploads photo on the admin profile page
2. Photo stored in the uploads volume (same as documents)
3. Photo URL saved in `profile.data.basics.photo`
4. Profile page shows photo preview with option to remove

### Generator Flow

1. Photo URL included in input JSON as `profile.photo`
2. At build time, generator copies the image into the static output directory
3. Themes reference the local copy — no external dependencies in the published site
4. `<PhotoFrame>` primitive handles loading, fallback, and aspect ratio

## Data Pipeline Changes

### Backend (`src-api`)

- **`site_generator.py`**: Expand the transform function to pass through all profile sections (certifications, publications, awards, volunteer, languages) instead of the current subset.
- **`schemas/profile.py`**: Add `photo` field to `Basics` schema.
- **New router**: `routers/themes.py` for `GET /api/themes` and `GET /api/themes/preview/{slug}`.
- **New service**: `services/theme_service.py` for reading theme configs and managing preview rendering.

### Generator (`src-generator`)

- **`types/portfolio.ts`**: Add TypeScript interfaces for Certification, Publication, Award, Volunteer, LanguageSkill. Add `siteType` and `jobPosting` fields.
- **`generate.js`**: Add `--preview` flag for SSR mode.
- **Primitives library**: New directory `app/primitives/` with all shared components.
- **Theme directories**: Each theme gets `portfolio.tsx`, `targeted.tsx`, `theme.config.ts`, `styles/`, `components/`, `fonts/`.

### Admin UI (`src-ui`)

- **Theme picker component**: Card grid replacing the dropdown, with preview iframe.
- **Sites page**: Redesigned generation dialogs using the new theme picker.
- **Profile page**: Photo upload component.
- **API client**: New functions for `GET /api/themes` and preview endpoint.
- **Types**: Update to match new theme metadata shape.

## Font Strategy

Each theme bundles its Google Fonts at build time:

1. Fonts downloaded during the generator's Docker image build (or during `npm install` via a postinstall script)
2. Stored in each theme's `fonts/` directory
3. Referenced via `@font-face` in the theme's CSS
4. Zero external requests at runtime — fully self-contained static output

## Theme Configuration Schema

Each theme exports a `theme.config.ts`:

```typescript
export interface ThemeConfig {
  slug: string;
  name: string;
  description: string;
  audience: string;
  fonts: {
    heading: string;
    body: string;
  };
  colors: {
    primary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
  };
  supports: {
    portfolio: boolean;  // always true for now
    targeted: boolean;   // always true for now
  };
}
```

This config is read by the API's `GET /api/themes` endpoint and surfaced in the admin UI theme picker.

## Conditional Section Rendering

Themes do not implement empty-state checks. The primitives library handles this:

- `<Section>` receives a `data` prop. If `data` is null, undefined, or an empty array, the section renders nothing.
- Themes compose sections without worrying about missing data.
- This means a user with no publications simply doesn't see a publications section — no "No publications yet" placeholder, no empty state. The section is absent.

## Targeted Site Content Tailoring

The content tailoring pipeline (AI rewriting the profile for a specific job) is an existing feature in the worker. Phase 3c does not change the tailoring logic — it only ensures the tailored output flows correctly through the expanded data contract and that targeted layout variants present it well.

The targeted layout variants in each theme:
- Lead with role-relevant sections
- Include a role-match or alignment summary
- May reorder sections to put the most relevant content first
- Present the job posting context (company, role) in the header area
