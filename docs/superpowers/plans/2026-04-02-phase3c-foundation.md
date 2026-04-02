# Phase 3c Foundation: Data Contract, Primitives, and Onyx Theme

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the generator data contract to cover the full profile schema, build a shared primitives library, and rebuild the Onyx theme on the new architecture — proving the composition model end-to-end.

**Architecture:** Composition model — shared primitives handle data loading, conditional rendering, and accessibility. The Onyx theme composes primitives with its own layout, fonts (JetBrains Mono + Inter), and dark styling. A Python transform function maps the DB profile schema to the generator's PortfolioData contract.

**Tech Stack:** Next.js 14 (static export), React 18, TypeScript, Tailwind CSS, `next/font/google`, Python/FastAPI, pytest, vitest

**Spec:** `docs/superpowers/specs/2026-04-02-phase3c-theme-design.md`

---

## File Map

### New files

```
src-generator/
├── vitest.config.ts                          # Vitest configuration
├── app/
│   ├── primitives/                           # Shared component library
│   │   ├── index.ts                          # Barrel export
│   │   ├── Section.tsx                       # Auto-hiding section wrapper
│   │   ├── SectionList.tsx                   # List with empty-state handling
│   │   ├── ConditionalRender.tsx             # Render-if-data wrapper
│   │   ├── HeroBanner.tsx                    # Name/title/summary/photo
│   │   ├── TimelineEntry.tsx                 # Dated item (work, education, volunteer)
│   │   ├── ProjectCard.tsx                   # Project display
│   │   ├── SkillGroup.tsx                    # Category + items
│   │   ├── ContactBar.tsx                    # Contact info with icons
│   │   ├── CertificationItem.tsx             # Certification display
│   │   ├── PublicationItem.tsx               # Publication display
│   │   ├── AwardItem.tsx                     # Award display
│   │   ├── LanguageItem.tsx                  # Language + proficiency
│   │   ├── PhotoFrame.tsx                    # Image with fallback
│   │   ├── DateRange.tsx                     # Date formatting
│   │   └── ExternalLink.tsx                  # Accessible external link
│   └── themes/onyx/
│       ├── theme.config.ts                   # Theme metadata
│       ├── fonts.ts                          # next/font declarations
│       ├── portfolio.tsx                     # Portfolio layout
│       ├── targeted.tsx                      # Targeted layout
│       ├── styles/theme.css                  # Onyx-specific styles
│       └── components/                       # Onyx-specific wrappers
│           ├── OnyxHero.tsx
│           ├── OnyxNav.tsx
│           ├── OnyxSkillGrid.tsx
│           └── OnyxFooter.tsx

src-generator/__tests__/
├── primitives/
│   ├── Section.test.tsx
│   ├── DateRange.test.tsx
│   └── ConditionalRender.test.tsx

src-api/
├── app/services/profile_transform.py         # DB profile → PortfolioData transform
└── tests/unit/test_profile_transform.py       # Transform unit tests
```

### Modified files

```
src-generator/
├── package.json                              # Add vitest + @testing-library deps
├── app/types/portfolio.ts                    # Expand types
├── app/page.tsx                              # Route by theme + siteType
├── app/lib/loadPortfolioData.ts              # Read new data format
├── app/globals.css                           # Remove Onyx-specific styles
├── generate.js                               # Write full PortfolioData
├── tailwind.config.js                        # Add font families
├── tsconfig.json                             # Add vitest paths if needed

src-api/
├── app/schemas/profile.py                    # Add photo field to Basics
├── app/services/site_generator.py            # Use transform, new input shape
└── tests/unit/test_site_generator.py         # Update tests for new shape
```

### Deleted files (old Onyx theme — replaced by new architecture)

```
src-generator/app/themes/onyx/page.tsx
src-generator/app/themes/onyx/theme.config.json
src-generator/app/themes/onyx/components/Header.tsx
src-generator/app/themes/onyx/components/Profile.tsx
src-generator/app/themes/onyx/components/WorkExperience.tsx
src-generator/app/themes/onyx/components/Projects.tsx
src-generator/app/themes/onyx/components/Education.tsx
src-generator/app/themes/onyx/components/Skills.tsx
src-generator/app/themes/onyx/components/Contact.tsx
```

---

## Task 1: Expand TypeScript Types

**Files:**
- Modify: `src-generator/app/types/portfolio.ts`

- [ ] **Step 1: Add new interfaces and expand PortfolioData**

Replace the contents of `src-generator/app/types/portfolio.ts`:

```typescript
/**
 * TypeScript types for portfolio data.
 * Aligned with JSON Resume schema. This is the contract between
 * the Python backend and the Next.js generator.
 */

export interface Profile {
  fullName: string;
  title: string;
  summary?: string;
  photo?: string;
  location?: string;
}

export interface SocialLink {
  platform: string;
  url: string;
}

export interface Contact {
  email?: string;
  phone?: string;
  website?: string;
  socialLinks?: SocialLink[];
}

export interface WorkExperience {
  company: string;
  location?: string;
  title: string;
  startDate: string;
  endDate: string;
  responsibilities?: string[];
}

export interface Project {
  name: string;
  description: string;
  role?: string;
  technologies?: string[];
  outcomes?: string[];
  url?: string;
}

export interface Education {
  institution: string;
  degree: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate: string;
  notes?: string;
}

export interface SkillCategory {
  category: string;
  items: string[];
}

export interface Certification {
  name: string;
  issuer?: string;
  dateObtained?: string;
  expiration?: string;
  credentialId?: string;
}

export interface Publication {
  title: string;
  venue?: string;
  date?: string;
  url?: string;
}

export interface Award {
  title: string;
  issuer?: string;
  date?: string;
  description?: string;
}

export interface Volunteer {
  organization: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface LanguageSkill {
  language: string;
  proficiency?: string;
}

export interface Theme {
  name: string;
  layoutOptions?: Record<string, unknown>;
}

export interface JobPosting {
  company: string;
  title: string;
  description: string;
}

export interface PortfolioData {
  profile: Profile;
  contact: Contact;
  workExperience: WorkExperience[];
  projects: Project[];
  education: Education[];
  skills: SkillCategory[];
  certifications: Certification[];
  publications: Publication[];
  awards: Award[];
  volunteer: Volunteer[];
  languages: LanguageSkill[];
  theme: Theme;
  siteType: 'portfolio' | 'targeted';
  jobPosting?: JobPosting;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd src-generator && npx tsc --noEmit`
Expected: No errors (existing code may need minor fixes if it references removed fields — fix any that arise).

- [ ] **Step 3: Commit**

```bash
git add src-generator/app/types/portfolio.ts
git commit -m "feat(generator): expand PortfolioData types for full JSON Resume coverage"
```

---

## Task 2: Add Testing Infrastructure to Generator

**Files:**
- Modify: `src-generator/package.json`
- Create: `src-generator/vitest.config.ts`

- [ ] **Step 1: Install vitest and testing libraries**

```bash
cd src-generator
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 2: Create vitest config**

Create `src-generator/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: [],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './app'),
    },
  },
});
```

- [ ] **Step 3: Add test script to package.json**

Add to the `"scripts"` section of `src-generator/package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Run vitest to verify setup**

Run: `cd src-generator && npx vitest run`
Expected: "No test files found" (no tests yet — confirms setup works)

- [ ] **Step 5: Commit**

```bash
git add src-generator/vitest.config.ts src-generator/package.json src-generator/package-lock.json
git commit -m "chore(generator): add vitest testing infrastructure"
```

---

## Task 3: Python Profile Transform Function

**Files:**
- Create: `src-api/app/services/profile_transform.py`
- Create: `src-api/tests/unit/test_profile_transform.py`

This function converts the DB profile schema (snake_case, `basics.*` flat structure) to the generator's PortfolioData shape (camelCase, separate `profile`/`contact` objects). This fixes the existing gap where raw DB data was passed to the generator without transformation.

- [ ] **Step 1: Write failing tests**

Create `src-api/tests/unit/test_profile_transform.py`:

```python
import pytest

from app.services.profile_transform import transform_profile_for_generator


FULL_PROFILE_DATA = {
    "basics": {
        "name": "Jane Doe",
        "title": "Senior Engineer",
        "email": "jane@example.com",
        "phone": "555-1234",
        "location": "San Francisco, CA",
        "linkedin": "https://linkedin.com/in/janedoe",
        "website": "https://jane.dev",
        "summary": "Experienced engineer.",
        "photo": "/uploads/photo.jpg",
    },
    "skills": [{"category": "Languages", "items": ["Python", "TypeScript"]}],
    "experience": [
        {
            "company": "Acme Corp",
            "title": "Senior Engineer",
            "start_date": "2020-01",
            "end_date": "2024-06",
            "current": False,
            "description": "Built stuff.",
            "highlights": ["Led migration to microservices", "Reduced latency 40%"],
        },
        {
            "company": "StartupCo",
            "title": "Engineer",
            "start_date": "2018-03",
            "end_date": None,
            "current": True,
            "highlights": ["Full-stack development"],
        },
    ],
    "education": [
        {
            "institution": "MIT",
            "degree": "B.S.",
            "field": "Computer Science",
            "start_date": "2014-09",
            "end_date": "2018-05",
            "notes": "Magna cum laude",
        }
    ],
    "certifications": [
        {
            "name": "AWS Solutions Architect",
            "issuer": "Amazon",
            "date_obtained": "2023-01",
            "expiration": "2026-01",
            "credential_id": "ABC123",
        }
    ],
    "projects": [
        {
            "name": "OpenWidget",
            "description": "Open-source widget library",
            "role": "Creator",
            "technologies": ["React", "TypeScript"],
            "outcomes": ["500+ GitHub stars"],
        }
    ],
    "publications": [
        {"title": "Scaling Microservices", "venue": "InfoQ", "date": "2023-06", "url": "https://infoq.com/article"}
    ],
    "awards": [{"title": "Engineer of the Year", "issuer": "Acme Corp", "date": "2023", "description": "Top performer"}],
    "volunteer": [
        {
            "organization": "Code.org",
            "role": "Mentor",
            "start_date": "2022-01",
            "end_date": "2023-12",
            "description": "Mentored students",
        }
    ],
    "languages": [{"language": "English", "proficiency": "Native"}, {"language": "Spanish", "proficiency": "B2"}],
}


class TestTransformProfile:
    def test_profile_section(self):
        result = transform_profile_for_generator(
            profile_data=FULL_PROFILE_DATA, theme="onyx", site_type="portfolio",
        )
        assert result["profile"]["fullName"] == "Jane Doe"
        assert result["profile"]["title"] == "Senior Engineer"
        assert result["profile"]["summary"] == "Experienced engineer."
        assert result["profile"]["photo"] == "/uploads/photo.jpg"
        assert result["profile"]["location"] == "San Francisco, CA"

    def test_contact_section(self):
        result = transform_profile_for_generator(
            profile_data=FULL_PROFILE_DATA, theme="onyx", site_type="portfolio",
        )
        assert result["contact"]["email"] == "jane@example.com"
        assert result["contact"]["phone"] == "555-1234"
        assert result["contact"]["website"] == "https://jane.dev"
        assert result["contact"]["socialLinks"] == [
            {"platform": "LinkedIn", "url": "https://linkedin.com/in/janedoe"}
        ]

    def test_work_experience_transforms(self):
        result = transform_profile_for_generator(
            profile_data=FULL_PROFILE_DATA, theme="onyx", site_type="portfolio",
        )
        exp = result["workExperience"]
        assert len(exp) == 2
        assert exp[0]["company"] == "Acme Corp"
        assert exp[0]["startDate"] == "2020-01"
        assert exp[0]["endDate"] == "2024-06"
        assert exp[0]["responsibilities"] == ["Led migration to microservices", "Reduced latency 40%"]
        # current=True with no end_date → "Present"
        assert exp[1]["endDate"] == "Present"

    def test_education_transforms(self):
        result = transform_profile_for_generator(
            profile_data=FULL_PROFILE_DATA, theme="onyx", site_type="portfolio",
        )
        edu = result["education"]
        assert len(edu) == 1
        assert edu[0]["fieldOfStudy"] == "Computer Science"
        assert edu[0]["startDate"] == "2014-09"
        assert edu[0]["endDate"] == "2018-05"
        assert edu[0]["notes"] == "Magna cum laude"

    def test_certification_transforms(self):
        result = transform_profile_for_generator(
            profile_data=FULL_PROFILE_DATA, theme="onyx", site_type="portfolio",
        )
        cert = result["certifications"][0]
        assert cert["dateObtained"] == "2023-01"
        assert cert["credentialId"] == "ABC123"

    def test_volunteer_transforms(self):
        result = transform_profile_for_generator(
            profile_data=FULL_PROFILE_DATA, theme="onyx", site_type="portfolio",
        )
        vol = result["volunteer"][0]
        assert vol["startDate"] == "2022-01"
        assert vol["endDate"] == "2023-12"

    def test_passthrough_sections(self):
        """Skills, publications, awards, languages pass through with minimal transform."""
        result = transform_profile_for_generator(
            profile_data=FULL_PROFILE_DATA, theme="onyx", site_type="portfolio",
        )
        assert result["skills"] == FULL_PROFILE_DATA["skills"]
        assert result["publications"][0]["title"] == "Scaling Microservices"
        assert result["awards"][0]["title"] == "Engineer of the Year"
        assert result["languages"][0]["language"] == "English"

    def test_theme_and_site_type(self):
        result = transform_profile_for_generator(
            profile_data=FULL_PROFILE_DATA, theme="onyx", site_type="portfolio",
        )
        assert result["theme"] == {"name": "onyx"}
        assert result["siteType"] == "portfolio"
        assert result["jobPosting"] is None

    def test_targeted_with_job_posting(self):
        jp = {"title": "Staff Engineer", "company": "BigCo", "description": "Lead platform team"}
        result = transform_profile_for_generator(
            profile_data=FULL_PROFILE_DATA, theme="coral", site_type="targeted", job_posting=jp,
        )
        assert result["siteType"] == "targeted"
        assert result["jobPosting"]["company"] == "BigCo"
        assert result["jobPosting"]["title"] == "Staff Engineer"

    def test_empty_profile(self):
        result = transform_profile_for_generator(
            profile_data={}, theme="onyx", site_type="portfolio",
        )
        assert result["profile"]["fullName"] == ""
        assert result["profile"]["title"] == ""
        assert result["contact"]["socialLinks"] == []
        assert result["workExperience"] == []
        assert result["certifications"] == []

    def test_missing_sections_default_to_empty_lists(self):
        result = transform_profile_for_generator(
            profile_data={"basics": {"name": "Joe"}}, theme="onyx", site_type="portfolio",
        )
        assert result["workExperience"] == []
        assert result["projects"] == []
        assert result["education"] == []
        assert result["skills"] == []
        assert result["certifications"] == []
        assert result["publications"] == []
        assert result["awards"] == []
        assert result["volunteer"] == []
        assert result["languages"] == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd src-api && uv run pytest tests/unit/test_profile_transform.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.profile_transform'`

- [ ] **Step 3: Implement the transform function**

Create `src-api/app/services/profile_transform.py`:

```python
"""Transform DB profile data to the generator's PortfolioData contract."""


def transform_profile_for_generator(
    profile_data: dict,
    theme: str,
    site_type: str,
    job_posting: dict | None = None,
) -> dict:
    """Convert the DB profile schema to the generator's PortfolioData shape.

    DB schema uses snake_case with a flat `basics` object.
    Generator expects camelCase with separate `profile`/`contact` objects.
    """
    basics = profile_data.get("basics") or {}

    return {
        "profile": {
            "fullName": basics.get("name") or "",
            "title": basics.get("title") or "",
            "summary": basics.get("summary"),
            "photo": basics.get("photo"),
            "location": basics.get("location"),
        },
        "contact": {
            "email": basics.get("email"),
            "phone": basics.get("phone"),
            "website": basics.get("website"),
            "socialLinks": _build_social_links(basics),
        },
        "workExperience": [
            _transform_experience(e) for e in (profile_data.get("experience") or [])
        ],
        "projects": [
            _transform_project(p) for p in (profile_data.get("projects") or [])
        ],
        "education": [
            _transform_education(e) for e in (profile_data.get("education") or [])
        ],
        "skills": profile_data.get("skills") or [],
        "certifications": [
            _transform_certification(c)
            for c in (profile_data.get("certifications") or [])
        ],
        "publications": profile_data.get("publications") or [],
        "awards": profile_data.get("awards") or [],
        "volunteer": [
            _transform_volunteer(v) for v in (profile_data.get("volunteer") or [])
        ],
        "languages": profile_data.get("languages") or [],
        "theme": {"name": theme},
        "siteType": site_type,
        "jobPosting": job_posting,
    }


def _build_social_links(basics: dict) -> list[dict]:
    links = []
    if basics.get("linkedin"):
        links.append({"platform": "LinkedIn", "url": basics["linkedin"]})
    return links


def _transform_experience(exp: dict) -> dict:
    end_date = exp.get("end_date") or ("Present" if exp.get("current") else "")
    return {
        "company": exp.get("company") or "",
        "location": exp.get("location"),
        "title": exp.get("title") or "",
        "startDate": exp.get("start_date") or "",
        "endDate": end_date,
        "responsibilities": exp.get("highlights") or [],
    }


def _transform_project(proj: dict) -> dict:
    return {
        "name": proj.get("name") or "",
        "description": proj.get("description") or "",
        "role": proj.get("role"),
        "technologies": proj.get("technologies") or [],
        "outcomes": proj.get("outcomes") or [],
        "url": proj.get("url"),
    }


def _transform_education(edu: dict) -> dict:
    return {
        "institution": edu.get("institution") or "",
        "degree": edu.get("degree") or "",
        "fieldOfStudy": edu.get("field"),
        "startDate": edu.get("start_date"),
        "endDate": edu.get("end_date") or "",
        "notes": edu.get("notes"),
    }


def _transform_certification(cert: dict) -> dict:
    return {
        "name": cert.get("name") or "",
        "issuer": cert.get("issuer"),
        "dateObtained": cert.get("date_obtained"),
        "expiration": cert.get("expiration"),
        "credentialId": cert.get("credential_id"),
    }


def _transform_volunteer(vol: dict) -> dict:
    return {
        "organization": vol.get("organization") or "",
        "role": vol.get("role"),
        "startDate": vol.get("start_date"),
        "endDate": vol.get("end_date"),
        "description": vol.get("description"),
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd src-api && uv run pytest tests/unit/test_profile_transform.py -v`
Expected: All 11 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src-api/app/services/profile_transform.py src-api/tests/unit/test_profile_transform.py
git commit -m "feat(api): add profile transform for generator PortfolioData contract"
```

---

## Task 4: Update Generator Data Pipeline

**Files:**
- Modify: `src-api/app/services/site_generator.py`
- Modify: `src-api/tests/unit/test_site_generator.py`
- Modify: `src-generator/generate.js`
- Modify: `src-generator/app/lib/loadPortfolioData.ts`
- Modify: `src-api/app/schemas/profile.py`

This task wires the transform into the build pipeline, updates generate.js to write the full PortfolioData, and adds the `photo` field to the backend schema.

- [ ] **Step 1: Add photo field to Basics schema**

In `src-api/app/schemas/profile.py`, add to the `Basics` class:

```python
class Basics(BaseModel):
    name: str | None = None
    title: str | None = None
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    linkedin: str | None = None
    website: str | None = None
    summary: str | None = None
    photo: str | None = None  # NEW — URL to uploaded photo
```

- [ ] **Step 2: Update test for build_input_json**

Replace the contents of `src-api/tests/unit/test_site_generator.py`:

```python
import json
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.site_generator import build_input_json, run_generator, cleanup_generation_dir


SAMPLE_PROFILE = {
    "basics": {"name": "Jane Doe", "title": "Engineer", "email": "jane@test.com"},
    "skills": [{"category": "Languages", "items": ["Python"]}],
    "experience": [],
}
SAMPLE_JOB_POSTING = {"title": "Engineer", "company": "Acme", "description": "Build things"}


class TestBuildInputJson:
    def test_portfolio_input_uses_transform(self):
        site_id = uuid.uuid4()
        result = build_input_json(
            site_id=site_id,
            site_type="portfolio",
            theme="onyx",
            profile_data=SAMPLE_PROFILE,
            output_dir="/data/output/joe",
            job_posting=None,
        )
        assert result["site_id"] == str(site_id)
        assert result["output_dir"] == "/data/output/joe"
        # portfolio_data should be the transformed shape
        pd = result["portfolio_data"]
        assert pd["profile"]["fullName"] == "Jane Doe"
        assert pd["contact"]["email"] == "jane@test.com"
        assert pd["theme"] == {"name": "onyx"}
        assert pd["siteType"] == "portfolio"
        assert pd["jobPosting"] is None

    def test_targeted_input_includes_job_posting(self):
        result = build_input_json(
            site_id=uuid.uuid4(),
            site_type="targeted",
            theme="coral",
            profile_data=SAMPLE_PROFILE,
            output_dir="/data/output/joe/abc123",
            job_posting=SAMPLE_JOB_POSTING,
        )
        pd = result["portfolio_data"]
        assert pd["siteType"] == "targeted"
        assert pd["jobPosting"]["company"] == "Acme"


class TestRunGenerator:
    @pytest.mark.asyncio
    async def test_success(self):
        with patch("app.services.site_generator.asyncio") as mock_asyncio:
            mock_process = MagicMock()
            mock_process.returncode = 0
            mock_asyncio.create_subprocess_exec = AsyncMock(return_value=mock_process)
            mock_process.communicate = AsyncMock(return_value=(b"Build complete", b""))

            await run_generator("/path/to/input.json")
            mock_asyncio.create_subprocess_exec.assert_called_once()

    @pytest.mark.asyncio
    async def test_failure_raises(self):
        with patch("app.services.site_generator.asyncio") as mock_asyncio:
            mock_process = MagicMock()
            mock_process.returncode = 1
            mock_asyncio.create_subprocess_exec = AsyncMock(return_value=mock_process)
            mock_process.communicate = AsyncMock(return_value=(b"", b"Error: theme not found"))

            with pytest.raises(RuntimeError, match="Generator failed.*theme not found"):
                await run_generator("/path/to/input.json")
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd src-api && uv run pytest tests/unit/test_site_generator.py -v`
Expected: FAIL — `build_input_json` returns old shape without `portfolio_data`

- [ ] **Step 4: Update build_input_json to use transform**

Replace the contents of `src-api/app/services/site_generator.py`:

```python
import asyncio
import json
import shutil
import uuid
from pathlib import Path

from app.config import settings
from app.services.profile_transform import transform_profile_for_generator


def build_input_json(
    site_id: uuid.UUID,
    site_type: str,
    theme: str,
    profile_data: dict,
    output_dir: str,
    job_posting: dict | None = None,
) -> dict:
    """Build the input JSON for the Next.js generator.

    Transforms the DB profile data into the generator's PortfolioData
    contract and wraps it with build metadata.
    """
    portfolio_data = transform_profile_for_generator(
        profile_data=profile_data,
        theme=theme,
        site_type=site_type,
        job_posting=job_posting,
    )
    return {
        "site_id": str(site_id),
        "output_dir": output_dir,
        "portfolio_data": portfolio_data,
    }


async def run_generator(input_path: str) -> None:
    """Invoke the Next.js generator as a subprocess."""
    process = await asyncio.create_subprocess_exec(
        "node", settings.generator_script, "--input", input_path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await process.communicate()

    if process.returncode != 0:
        error_msg = stderr.decode().strip() or "Unknown error"
        raise RuntimeError(f"Generator failed (exit {process.returncode}): {error_msg}")


def write_input_file(site_id: uuid.UUID, input_data: dict) -> str:
    """Write input JSON to the generation directory. Returns the file path."""
    gen_dir = Path(settings.generation_dir) / str(site_id)
    gen_dir.mkdir(parents=True, exist_ok=True)
    input_path = gen_dir / "input.json"
    input_path.write_text(json.dumps(input_data, indent=2))
    return str(input_path)


def cleanup_generation_dir(site_id: uuid.UUID) -> None:
    """Remove the generation directory for a site."""
    gen_dir = Path(settings.generation_dir) / str(site_id)
    if gen_dir.exists():
        shutil.rmtree(gen_dir)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd src-api && uv run pytest tests/unit/test_site_generator.py -v`
Expected: All tests PASS

- [ ] **Step 6: Update generate.js**

Replace the contents of `src-generator/generate.js`:

```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse --input argument
const args = process.argv.slice(2);
const inputIndex = args.indexOf('--input');
if (inputIndex === -1 || !args[inputIndex + 1]) {
  console.error('Usage: node generate.js --input <path-to-input.json>');
  process.exit(1);
}

const inputPath = args[inputIndex + 1];

// Read input
let input;
try {
  input = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
} catch (e) {
  console.error(`Failed to read input: ${e.message}`);
  process.exit(1);
}

const { site_id, output_dir, portfolio_data } = input;

console.log(`Generating ${portfolio_data.siteType} site with theme "${portfolio_data.theme.name}" for site ${site_id}`);
console.log(`Output: ${output_dir}`);

// Write portfolio data for Next.js to consume
const dataDir = path.join(__dirname, '.data');
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(
  path.join(dataDir, 'portfolio-data.json'),
  JSON.stringify(portfolio_data, null, 2)
);

// Run Next.js static export
try {
  execSync('npx next build', {
    cwd: __dirname,
    stdio: 'inherit',
  });

  // Copy the static output to the target directory
  const nextOutputDir = path.join(__dirname, 'out');
  if (!fs.existsSync(nextOutputDir)) {
    console.error('Next.js build did not produce output directory');
    process.exit(1);
  }

  // Ensure output directory exists
  fs.mkdirSync(output_dir, { recursive: true });

  // Copy files recursively
  copyRecursive(nextOutputDir, output_dir);

  console.log(`Site generated successfully at ${output_dir}`);
} catch (e) {
  console.error(`Build failed: ${e.message}`);
  process.exit(1);
} finally {
  // Clean up .data directory
  fs.rmSync(dataDir, { recursive: true, force: true });
}

function copyRecursive(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  fs.mkdirSync(dest, { recursive: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
```

- [ ] **Step 7: Update loadPortfolioData**

Replace the contents of `src-generator/app/lib/loadPortfolioData.ts`:

```typescript
import { PortfolioData } from '../types/portfolio';
import fs from 'fs';
import path from 'path';

/**
 * Load portfolio data written by generate.js.
 * Reads from .data/portfolio-data.json (written before next build).
 */
export function loadPortfolioData(): PortfolioData {
  const dataPath = path.join(process.cwd(), '.data', 'portfolio-data.json');

  try {
    const fileContents = fs.readFileSync(dataPath, 'utf-8');
    return JSON.parse(fileContents) as PortfolioData;
  } catch (error) {
    console.error('Error loading portfolio data:', error);
    return getDefaultPortfolioData();
  }
}

/**
 * Returns default/sample portfolio data for development and testing.
 */
export function getDefaultPortfolioData(): PortfolioData {
  return {
    profile: {
      fullName: 'Sample Portfolio',
      title: 'Professional Developer',
      summary: 'This is a sample portfolio. Please generate your own portfolio data.',
    },
    contact: {
      email: 'contact@example.com',
      socialLinks: [],
    },
    workExperience: [],
    projects: [],
    education: [],
    skills: [],
    certifications: [],
    publications: [],
    awards: [],
    volunteer: [],
    languages: [],
    theme: {
      name: 'onyx',
    },
    siteType: 'portfolio',
  };
}
```

- [ ] **Step 8: Commit**

```bash
git add src-api/app/schemas/profile.py src-api/app/services/site_generator.py src-api/tests/unit/test_site_generator.py src-generator/generate.js src-generator/app/lib/loadPortfolioData.ts
git commit -m "feat: wire profile transform through generator data pipeline"
```

---

## Task 5: Structural and Utility Primitives

**Files:**
- Create: `src-generator/app/primitives/Section.tsx`
- Create: `src-generator/app/primitives/SectionList.tsx`
- Create: `src-generator/app/primitives/ConditionalRender.tsx`
- Create: `src-generator/app/primitives/DateRange.tsx`
- Create: `src-generator/app/primitives/ExternalLink.tsx`
- Create: `src-generator/app/primitives/PhotoFrame.tsx`
- Create: `src-generator/app/primitives/index.ts`
- Create: `src-generator/__tests__/primitives/Section.test.tsx`
- Create: `src-generator/__tests__/primitives/ConditionalRender.test.tsx`
- Create: `src-generator/__tests__/primitives/DateRange.test.tsx`

- [ ] **Step 1: Write failing tests for structural primitives**

Create `src-generator/__tests__/primitives/Section.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Section } from '@/primitives';

describe('Section', () => {
  it('renders children when data is non-empty array', () => {
    render(
      <Section id="skills" title="Skills" data={['Python', 'TypeScript']}>
        <p>Content here</p>
      </Section>
    );
    expect(screen.getByText('Skills')).toBeDefined();
    expect(screen.getByText('Content here')).toBeDefined();
  });

  it('renders nothing when data is empty array', () => {
    const { container } = render(
      <Section id="skills" title="Skills" data={[]}>
        <p>Content here</p>
      </Section>
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when data is null', () => {
    const { container } = render(
      <Section id="skills" title="Skills" data={null}>
        <p>Content here</p>
      </Section>
    );
    expect(container.innerHTML).toBe('');
  });

  it('applies className to section element', () => {
    const { container } = render(
      <Section id="skills" title="Skills" data={['item']} className="bg-black" containerClassName="max-w-6xl">
        <p>Content</p>
      </Section>
    );
    const section = container.querySelector('section');
    expect(section?.className).toContain('bg-black');
    const div = section?.querySelector('div');
    expect(div?.className).toContain('max-w-6xl');
  });

  it('sets anchor id for navigation', () => {
    const { container } = render(
      <Section id="experience" title="Experience" data={['item']}>
        <p>Content</p>
      </Section>
    );
    const section = container.querySelector('section');
    expect(section?.id).toBe('experience');
  });
});
```

Create `src-generator/__tests__/primitives/ConditionalRender.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ConditionalRender } from '@/primitives';

describe('ConditionalRender', () => {
  it('renders children when data is truthy', () => {
    const { container } = render(
      <ConditionalRender data="hello">
        <p>visible</p>
      </ConditionalRender>
    );
    expect(container.textContent).toBe('visible');
  });

  it('renders nothing when data is null', () => {
    const { container } = render(
      <ConditionalRender data={null}>
        <p>hidden</p>
      </ConditionalRender>
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when data is undefined', () => {
    const { container } = render(
      <ConditionalRender data={undefined}>
        <p>hidden</p>
      </ConditionalRender>
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when data is empty string', () => {
    const { container } = render(
      <ConditionalRender data="">
        <p>hidden</p>
      </ConditionalRender>
    );
    expect(container.innerHTML).toBe('');
  });
});
```

Create `src-generator/__tests__/primitives/DateRange.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DateRange } from '@/primitives';

describe('DateRange', () => {
  it('formats a full date range', () => {
    const { container } = render(<DateRange startDate="2020-01" endDate="2024-06" />);
    expect(container.textContent).toBe('Jan 2020 – Jun 2024');
  });

  it('shows Present for current roles', () => {
    const { container } = render(<DateRange startDate="2020-01" endDate="Present" />);
    expect(container.textContent).toBe('Jan 2020 – Present');
  });

  it('shows only end date when start is missing', () => {
    const { container } = render(<DateRange endDate="2018-05" />);
    expect(container.textContent).toBe('2018');
  });

  it('shows year-only for year-only input', () => {
    const { container } = render(<DateRange startDate="2020" endDate="2024" />);
    expect(container.textContent).toBe('2020 – 2024');
  });

  it('renders nothing when both dates are missing', () => {
    const { container } = render(<DateRange />);
    expect(container.innerHTML).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd src-generator && npx vitest run`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement structural primitives**

Create `src-generator/app/primitives/Section.tsx`:

```tsx
import React from 'react';

interface SectionProps {
  id: string;
  title: string;
  data: unknown[] | unknown | null | undefined;
  className?: string;
  containerClassName?: string;
  titleClassName?: string;
  children: React.ReactNode;
}

function isEmpty(data: unknown): boolean {
  if (data === null || data === undefined) return true;
  if (Array.isArray(data)) return data.length === 0;
  return false;
}

export function Section({ id, title, data, className, containerClassName, titleClassName, children }: SectionProps) {
  if (isEmpty(data)) return null;

  return (
    <section id={id} className={className}>
      <div className={containerClassName}>
        <h2 className={titleClassName}>{title}</h2>
        {children}
      </div>
    </section>
  );
}
```

Create `src-generator/app/primitives/SectionList.tsx`:

```tsx
import React from 'react';

interface SectionListProps<T> {
  items: T[] | null | undefined;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
}

export function SectionList<T>({ items, renderItem, className }: SectionListProps<T>) {
  if (!items || items.length === 0) return null;

  return (
    <div className={className}>
      {items.map((item, index) => renderItem(item, index))}
    </div>
  );
}
```

Create `src-generator/app/primitives/ConditionalRender.tsx`:

```tsx
import React from 'react';

interface ConditionalRenderProps {
  data: unknown;
  children: React.ReactNode;
}

export function ConditionalRender({ data, children }: ConditionalRenderProps) {
  if (data === null || data === undefined || data === '') return null;
  if (Array.isArray(data) && data.length === 0) return null;
  return <>{children}</>;
}
```

- [ ] **Step 4: Implement utility primitives**

Create `src-generator/app/primitives/DateRange.tsx`:

```tsx
import React from 'react';

interface DateRangeProps {
  startDate?: string;
  endDate?: string;
  className?: string;
}

function formatDate(date: string): string {
  if (date.toLowerCase() === 'present') return 'Present';

  const parts = date.split('-');
  if (parts.length === 1) return parts[0]; // Year only

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [year, month] = parts;
  const monthIndex = parseInt(month, 10) - 1;
  if (monthIndex >= 0 && monthIndex < 12) {
    return `${monthNames[monthIndex]} ${year}`;
  }
  return year;
}

export function DateRange({ startDate, endDate, className }: DateRangeProps) {
  if (!startDate && !endDate) return null;

  if (!startDate && endDate) {
    // Education with only graduation year
    const parts = endDate.split('-');
    return <span className={className}>{parts[0]}</span>;
  }

  const start = startDate ? formatDate(startDate) : '';
  const end = endDate ? formatDate(endDate) : '';

  return (
    <span className={className}>
      {start}{start && end ? ' – ' : ''}{end}
    </span>
  );
}
```

Create `src-generator/app/primitives/ExternalLink.tsx`:

```tsx
import React from 'react';

interface ExternalLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export function ExternalLink({ href, children, className }: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}
```

Create `src-generator/app/primitives/PhotoFrame.tsx`:

```tsx
import React from 'react';

interface PhotoFrameProps {
  src?: string;
  alt: string;
  shape?: 'circle' | 'square' | 'rounded';
  size?: string;
  className?: string;
}

const shapeClasses: Record<string, string> = {
  circle: 'rounded-full',
  square: '',
  rounded: 'rounded-lg',
};

export function PhotoFrame({ src, alt, shape = 'rounded', size = 'w-32 h-32', className }: PhotoFrameProps) {
  if (!src) return null;

  return (
    <div className={`${size} overflow-hidden ${shapeClasses[shape]} ${className || ''}`}>
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </div>
  );
}
```

- [ ] **Step 5: Create barrel export**

Create `src-generator/app/primitives/index.ts`:

```typescript
export { Section } from './Section';
export { SectionList } from './SectionList';
export { ConditionalRender } from './ConditionalRender';
export { DateRange } from './DateRange';
export { ExternalLink } from './ExternalLink';
export { PhotoFrame } from './PhotoFrame';
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd src-generator && npx vitest run`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src-generator/app/primitives/ src-generator/__tests__/
git commit -m "feat(generator): add structural and utility primitives library"
```

---

## Task 6: Content Primitives

**Files:**
- Create: `src-generator/app/primitives/HeroBanner.tsx`
- Create: `src-generator/app/primitives/TimelineEntry.tsx`
- Create: `src-generator/app/primitives/ContactBar.tsx`
- Create: `src-generator/app/primitives/ProjectCard.tsx`
- Create: `src-generator/app/primitives/SkillGroup.tsx`
- Create: `src-generator/app/primitives/CertificationItem.tsx`
- Create: `src-generator/app/primitives/PublicationItem.tsx`
- Create: `src-generator/app/primitives/AwardItem.tsx`
- Create: `src-generator/app/primitives/LanguageItem.tsx`
- Modify: `src-generator/app/primitives/index.ts`

- [ ] **Step 1: Implement HeroBanner**

Create `src-generator/app/primitives/HeroBanner.tsx`:

```tsx
import React from 'react';
import { Profile, Contact } from '../types/portfolio';
import { PhotoFrame } from './PhotoFrame';

interface HeroBannerProps {
  profile: Profile;
  contact?: Contact;
  photoShape?: 'circle' | 'square' | 'rounded';
  photoSize?: string;
  className?: string;
  nameClassName?: string;
  titleClassName?: string;
  summaryClassName?: string;
  children?: React.ReactNode;
}

export function HeroBanner({
  profile,
  contact,
  photoShape = 'rounded',
  photoSize = 'w-32 h-32',
  className,
  nameClassName,
  titleClassName,
  summaryClassName,
  children,
}: HeroBannerProps) {
  return (
    <div className={className}>
      <PhotoFrame
        src={profile.photo}
        alt={profile.fullName}
        shape={photoShape}
        size={photoSize}
      />
      <h1 className={nameClassName}>{profile.fullName}</h1>
      <p className={titleClassName}>{profile.title}</p>
      {profile.summary && (
        <p className={summaryClassName}>{profile.summary}</p>
      )}
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Implement TimelineEntry**

Create `src-generator/app/primitives/TimelineEntry.tsx`:

```tsx
import React from 'react';
import { DateRange } from './DateRange';

interface TimelineEntryProps {
  title: string;
  subtitle: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  description?: string;
  highlights?: string[];
  notes?: string;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  dateClassName?: string;
  highlightClassName?: string;
  highlightBullet?: React.ReactNode;
}

export function TimelineEntry({
  title,
  subtitle,
  startDate,
  endDate,
  location,
  description,
  highlights,
  notes,
  className,
  titleClassName,
  subtitleClassName,
  dateClassName,
  highlightClassName,
  highlightBullet = '▹',
}: TimelineEntryProps) {
  return (
    <div className={className}>
      <div>
        <h3 className={titleClassName}>{title}</h3>
        <p className={subtitleClassName}>{subtitle}</p>
      </div>
      <div>
        <DateRange startDate={startDate} endDate={endDate} className={dateClassName} />
        {location && <p className={dateClassName}>{location}</p>}
      </div>
      {description && <p>{description}</p>}
      {highlights && highlights.length > 0 && (
        <ul>
          {highlights.map((item, idx) => (
            <li key={idx} className={highlightClassName}>
              {highlightBullet && <span>{highlightBullet}</span>}
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
      {notes && <p>{notes}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Implement ContactBar**

Create `src-generator/app/primitives/ContactBar.tsx`:

```tsx
import React from 'react';
import { Contact } from '../types/portfolio';
import { ExternalLink } from './ExternalLink';

interface ContactBarProps {
  contact: Contact;
  className?: string;
  linkClassName?: string;
}

export function ContactBar({ contact, className, linkClassName }: ContactBarProps) {
  const hasContent = contact.email || contact.phone || contact.website ||
    (contact.socialLinks && contact.socialLinks.length > 0);

  if (!hasContent) return null;

  return (
    <div className={className}>
      {contact.email && (
        <a href={`mailto:${contact.email}`} className={linkClassName}>
          {contact.email}
        </a>
      )}
      {contact.phone && (
        <a href={`tel:${contact.phone}`} className={linkClassName}>
          {contact.phone}
        </a>
      )}
      {contact.website && (
        <ExternalLink href={contact.website} className={linkClassName}>
          {contact.website}
        </ExternalLink>
      )}
      {contact.socialLinks?.map((link, idx) => (
        <ExternalLink key={idx} href={link.url} className={linkClassName}>
          {link.platform}
        </ExternalLink>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Implement ProjectCard, SkillGroup**

Create `src-generator/app/primitives/ProjectCard.tsx`:

```tsx
import React from 'react';
import { Project } from '../types/portfolio';
import { ExternalLink } from './ExternalLink';

interface ProjectCardProps {
  project: Project;
  className?: string;
  nameClassName?: string;
  techClassName?: string;
  linkClassName?: string;
}

export function ProjectCard({ project, className, nameClassName, techClassName, linkClassName }: ProjectCardProps) {
  return (
    <div className={className}>
      <h3 className={nameClassName}>{project.name}</h3>
      {project.role && <p>{project.role}</p>}
      <p>{project.description}</p>
      {project.technologies && project.technologies.length > 0 && (
        <div>
          {project.technologies.map((tech, idx) => (
            <span key={idx} className={techClassName}>{tech}</span>
          ))}
        </div>
      )}
      {project.outcomes && project.outcomes.length > 0 && (
        <ul>
          {project.outcomes.map((outcome, idx) => (
            <li key={idx}>{outcome}</li>
          ))}
        </ul>
      )}
      {project.url && (
        <ExternalLink href={project.url} className={linkClassName}>
          View Project
        </ExternalLink>
      )}
    </div>
  );
}
```

Create `src-generator/app/primitives/SkillGroup.tsx`:

```tsx
import React from 'react';
import { SkillCategory } from '../types/portfolio';

interface SkillGroupProps {
  skill: SkillCategory;
  className?: string;
  categoryClassName?: string;
  itemClassName?: string;
}

export function SkillGroup({ skill, className, categoryClassName, itemClassName }: SkillGroupProps) {
  return (
    <div className={className}>
      <h3 className={categoryClassName}>{skill.category}</h3>
      <div>
        {skill.items.map((item, idx) => (
          <span key={idx} className={itemClassName}>{item}</span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Implement remaining content primitives**

Create `src-generator/app/primitives/CertificationItem.tsx`:

```tsx
import React from 'react';
import { Certification } from '../types/portfolio';
import { DateRange } from './DateRange';

interface CertificationItemProps {
  cert: Certification;
  className?: string;
  nameClassName?: string;
  detailClassName?: string;
}

export function CertificationItem({ cert, className, nameClassName, detailClassName }: CertificationItemProps) {
  return (
    <div className={className}>
      <h3 className={nameClassName}>{cert.name}</h3>
      {cert.issuer && <p className={detailClassName}>{cert.issuer}</p>}
      {cert.dateObtained && <p className={detailClassName}>Obtained: {cert.dateObtained}</p>}
      {cert.expiration && <p className={detailClassName}>Expires: {cert.expiration}</p>}
      {cert.credentialId && <p className={detailClassName}>ID: {cert.credentialId}</p>}
    </div>
  );
}
```

Create `src-generator/app/primitives/PublicationItem.tsx`:

```tsx
import React from 'react';
import { Publication } from '../types/portfolio';
import { ExternalLink } from './ExternalLink';

interface PublicationItemProps {
  pub: Publication;
  className?: string;
  titleClassName?: string;
  detailClassName?: string;
  linkClassName?: string;
}

export function PublicationItem({ pub, className, titleClassName, detailClassName, linkClassName }: PublicationItemProps) {
  const title = pub.url ? (
    <ExternalLink href={pub.url} className={linkClassName}>{pub.title}</ExternalLink>
  ) : (
    <span className={titleClassName}>{pub.title}</span>
  );

  return (
    <div className={className}>
      {title}
      {pub.venue && <span className={detailClassName}>{pub.venue}</span>}
      {pub.date && <span className={detailClassName}>{pub.date}</span>}
    </div>
  );
}
```

Create `src-generator/app/primitives/AwardItem.tsx`:

```tsx
import React from 'react';
import { Award } from '../types/portfolio';

interface AwardItemProps {
  award: Award;
  className?: string;
  titleClassName?: string;
  detailClassName?: string;
}

export function AwardItem({ award, className, titleClassName, detailClassName }: AwardItemProps) {
  return (
    <div className={className}>
      <h3 className={titleClassName}>{award.title}</h3>
      {award.issuer && <span className={detailClassName}>{award.issuer}</span>}
      {award.date && <span className={detailClassName}>{award.date}</span>}
      {award.description && <p>{award.description}</p>}
    </div>
  );
}
```

Create `src-generator/app/primitives/LanguageItem.tsx`:

```tsx
import React from 'react';
import { LanguageSkill } from '../types/portfolio';

interface LanguageItemProps {
  lang: LanguageSkill;
  className?: string;
  nameClassName?: string;
  proficiencyClassName?: string;
}

export function LanguageItem({ lang, className, nameClassName, proficiencyClassName }: LanguageItemProps) {
  return (
    <span className={className}>
      <span className={nameClassName}>{lang.language}</span>
      {lang.proficiency && <span className={proficiencyClassName}>{lang.proficiency}</span>}
    </span>
  );
}
```

- [ ] **Step 6: Update barrel export**

Replace `src-generator/app/primitives/index.ts`:

```typescript
export { Section } from './Section';
export { SectionList } from './SectionList';
export { ConditionalRender } from './ConditionalRender';
export { DateRange } from './DateRange';
export { ExternalLink } from './ExternalLink';
export { PhotoFrame } from './PhotoFrame';
export { HeroBanner } from './HeroBanner';
export { TimelineEntry } from './TimelineEntry';
export { ContactBar } from './ContactBar';
export { ProjectCard } from './ProjectCard';
export { SkillGroup } from './SkillGroup';
export { CertificationItem } from './CertificationItem';
export { PublicationItem } from './PublicationItem';
export { AwardItem } from './AwardItem';
export { LanguageItem } from './LanguageItem';
```

- [ ] **Step 7: Run tests**

Run: `cd src-generator && npx vitest run`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add src-generator/app/primitives/
git commit -m "feat(generator): add content primitives — hero, timeline, contact, project, skill, cert, pub, award, language"
```

---

## Task 7: Onyx Theme Setup

**Files:**
- Create: `src-generator/app/themes/onyx/theme.config.ts`
- Create: `src-generator/app/themes/onyx/fonts.ts`
- Create: `src-generator/app/themes/onyx/styles/theme.css`
- Modify: `src-generator/tailwind.config.js`
- Modify: `src-generator/app/globals.css`

- [ ] **Step 1: Create theme.config.ts**

Create `src-generator/app/themes/onyx/theme.config.ts`:

```typescript
import type { ThemeConfig } from '../../types/theme-config';

const config: ThemeConfig = {
  slug: 'onyx',
  name: 'Onyx',
  description: 'Dark, technical, sharp edges',
  audience: 'Developers, engineers',
  fonts: {
    heading: 'JetBrains Mono',
    body: 'Inter',
  },
  colors: {
    primary: '#0a0a0a',
    accent: '#7c8aff',
    background: '#0a0a0a',
    surface: '#1a1a1a',
    text: '#e0e0e0',
  },
  supports: {
    portfolio: true,
    targeted: true,
  },
};

export default config;
```

- [ ] **Step 2: Create ThemeConfig type**

Create `src-generator/app/types/theme-config.ts`:

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
    portfolio: boolean;
    targeted: boolean;
  };
}
```

- [ ] **Step 3: Create font declarations**

Create `src-generator/app/themes/onyx/fonts.ts`:

```typescript
import { JetBrains_Mono, Inter } from 'next/font/google';

export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
});

export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});
```

- [ ] **Step 4: Create Onyx theme CSS**

Create `src-generator/app/themes/onyx/styles/theme.css`:

```css
.onyx-theme {
  --onyx-950: #0a0a0a;
  --onyx-900: #121212;
  --onyx-800: #1a1a1a;
  --onyx-700: #2a2a2a;
  --onyx-600: #3a3a3a;
  --accent-blue: #7c8aff;
  --accent-teal: #5eead4;
}

.onyx-theme .section-container {
  @apply max-w-6xl mx-auto px-6 py-16 md:py-24;
}

.onyx-theme .section-title {
  @apply text-3xl md:text-4xl font-heading font-bold mb-8 text-white;
}

.onyx-theme .card {
  @apply bg-[var(--onyx-800)] rounded-lg p-6 border border-[var(--onyx-700)] hover:border-[var(--accent-blue)] transition-colors;
}

.onyx-theme .gradient-text {
  @apply bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-teal)] bg-clip-text text-transparent;
}

.onyx-theme .tech-tag {
  @apply text-xs bg-[var(--onyx-700)] text-[var(--accent-teal)] px-3 py-1 rounded-full;
}
```

- [ ] **Step 5: Update tailwind.config.js**

Replace `src-generator/tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['var(--font-heading)', 'monospace'],
        body: ['var(--font-body)', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 6: Make globals.css theme-neutral**

Replace `src-generator/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    scroll-behavior: smooth;
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add src-generator/app/themes/onyx/theme.config.ts src-generator/app/themes/onyx/fonts.ts src-generator/app/themes/onyx/styles/ src-generator/app/types/theme-config.ts src-generator/tailwind.config.js src-generator/app/globals.css
git commit -m "feat(generator): onyx theme config, fonts, CSS, and neutral globals"
```

---

## Task 8: Onyx Portfolio Layout

**Files:**
- Create: `src-generator/app/themes/onyx/portfolio.tsx`
- Create: `src-generator/app/themes/onyx/components/OnyxHero.tsx`
- Create: `src-generator/app/themes/onyx/components/OnyxNav.tsx`
- Create: `src-generator/app/themes/onyx/components/OnyxSkillGrid.tsx`
- Create: `src-generator/app/themes/onyx/components/OnyxFooter.tsx`

- [ ] **Step 1: Create OnyxNav component**

Create `src-generator/app/themes/onyx/components/OnyxNav.tsx`:

```tsx
import React from 'react';
import { PortfolioData } from '@/types/portfolio';

interface OnyxNavProps {
  data: PortfolioData;
}

export function OnyxNav({ data }: OnyxNavProps) {
  // Build nav links from populated sections
  const links: { id: string; label: string }[] = [
    { id: 'about', label: 'About' },
  ];
  if (data.skills.length > 0) links.push({ id: 'skills', label: 'Skills' });
  if (data.workExperience.length > 0) links.push({ id: 'experience', label: 'Experience' });
  if (data.projects.length > 0) links.push({ id: 'projects', label: 'Projects' });
  if (data.education.length > 0) links.push({ id: 'education', label: 'Education' });
  links.push({ id: 'contact', label: 'Contact' });

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[var(--onyx-900)]/80 backdrop-blur-md border-b border-[var(--onyx-700)]">
      <nav className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="text-xl font-heading font-bold gradient-text">
            {data.profile.fullName}
          </div>
          <ul className="hidden md:flex space-x-8">
            {links.map((link) => (
              <li key={link.id}>
                <a
                  href={`#${link.id}`}
                  className="text-gray-300 hover:text-[var(--accent-blue)] transition-colors"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </header>
  );
}
```

- [ ] **Step 2: Create OnyxHero component**

Create `src-generator/app/themes/onyx/components/OnyxHero.tsx`:

```tsx
import React from 'react';
import { Profile } from '@/types/portfolio';
import { PhotoFrame } from '@/primitives';

interface OnyxHeroProps {
  profile: Profile;
}

export function OnyxHero({ profile }: OnyxHeroProps) {
  return (
    <section id="about" className="min-h-screen flex items-center justify-center pt-20">
      <div className="section-container text-center">
        <PhotoFrame
          src={profile.photo}
          alt={profile.fullName}
          shape="rounded"
          size="w-36 h-36"
          className="mx-auto mb-8"
        />
        <h1 className="text-5xl md:text-7xl font-heading font-bold mb-4 text-white">
          {profile.fullName}
        </h1>
        <h2 className="text-2xl md:text-3xl mb-8 gradient-text">
          {profile.title}
        </h2>
        {profile.summary && (
          <p className="text-lg md:text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
            {profile.summary}
          </p>
        )}
        <div className="mt-12">
          <a
            href="#contact"
            className="inline-block bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-teal)] text-white font-semibold px-8 py-3 rounded-lg hover:shadow-lg hover:shadow-[var(--accent-blue)]/50 transition-all"
          >
            Get In Touch
          </a>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Create OnyxSkillGrid component**

Create `src-generator/app/themes/onyx/components/OnyxSkillGrid.tsx`:

```tsx
import React from 'react';
import { SkillCategory } from '@/types/portfolio';

interface OnyxSkillGridProps {
  skills: SkillCategory[];
}

export function OnyxSkillGrid({ skills }: OnyxSkillGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {skills.map((category, index) => (
        <div key={index} className="card">
          <h3 className="text-xl font-heading font-bold text-[var(--accent-blue)] mb-4">
            {category.category}
          </h3>
          <div className="flex flex-wrap gap-2">
            {category.items.map((skill, idx) => (
              <span key={idx} className="tech-tag">{skill}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create OnyxFooter component**

Create `src-generator/app/themes/onyx/components/OnyxFooter.tsx`:

```tsx
import React from 'react';

interface OnyxFooterProps {
  fullName: string;
}

export function OnyxFooter({ fullName }: OnyxFooterProps) {
  return (
    <footer className="bg-[var(--onyx-900)] border-t border-[var(--onyx-700)] py-8">
      <div className="max-w-6xl mx-auto px-6 text-center text-gray-400">
        <p>© {new Date().getFullYear()} {fullName}. All rights reserved.</p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 5: Create Onyx portfolio layout**

Create `src-generator/app/themes/onyx/portfolio.tsx`:

```tsx
import React from 'react';
import { PortfolioData } from '@/types/portfolio';
import { Section, SectionList, ContactBar, TimelineEntry, ProjectCard, CertificationItem, PublicationItem, AwardItem, LanguageItem } from '@/primitives';
import { OnyxNav } from './components/OnyxNav';
import { OnyxHero } from './components/OnyxHero';
import { OnyxSkillGrid } from './components/OnyxSkillGrid';
import { OnyxFooter } from './components/OnyxFooter';
import './styles/theme.css';

interface OnyxPortfolioProps {
  data: PortfolioData;
}

export default function OnyxPortfolio({ data }: OnyxPortfolioProps) {
  return (
    <div className="onyx-theme min-h-screen bg-[var(--onyx-950)] text-gray-100 font-body">
      <OnyxNav data={data} />

      <main>
        <OnyxHero profile={data.profile} />

        <Section id="skills" title="Skills" data={data.skills} className="bg-[var(--onyx-900)]" containerClassName="section-container" titleClassName="section-title">
            <OnyxSkillGrid skills={data.skills} />
        </Section>

        <Section id="experience" title="Work Experience" data={data.workExperience} className="bg-[var(--onyx-950)]" containerClassName="section-container" titleClassName="section-title">
            <SectionList
              items={data.workExperience}
              className="space-y-8"
              renderItem={(exp, idx) => (
                <TimelineEntry
                  key={idx}
                  title={exp.title}
                  subtitle={exp.company}
                  startDate={exp.startDate}
                  endDate={exp.endDate}
                  location={exp.location}
                  highlights={exp.responsibilities}
                  className="card"
                  titleClassName="text-2xl font-bold text-white mb-1"
                  subtitleClassName="text-xl text-[var(--accent-blue)]"
                  dateClassName="text-gray-400 text-sm"
                  highlightClassName="flex items-start text-gray-300"
                  highlightBullet={<span className="text-[var(--accent-teal)] mr-2 mt-1">▹</span>}
                />
              )}
            />
        </Section>

        <Section id="projects" title="Projects" data={data.projects} className="bg-[var(--onyx-900)]" containerClassName="section-container" titleClassName="section-title">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.projects.map((project, idx) => (
                <ProjectCard
                  key={idx}
                  project={project}
                  className="card group"
                  nameClassName="text-xl font-bold text-white mb-3 group-hover:text-[var(--accent-blue)] transition-colors"
                  techClassName="tech-tag"
                  linkClassName="inline-flex items-center text-[var(--accent-blue)] hover:text-[var(--accent-teal)] transition-colors"
                />
              ))}
            </div>
        </Section>

        <Section id="education" title="Education" data={data.education} className="bg-[var(--onyx-950)]" containerClassName="section-container" titleClassName="section-title">
            <SectionList
              items={data.education}
              className="space-y-6"
              renderItem={(edu, idx) => (
                <TimelineEntry
                  key={idx}
                  title={edu.institution}
                  subtitle={`${edu.degree}${edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ''}`}
                  startDate={edu.startDate}
                  endDate={edu.endDate}
                  notes={edu.notes}
                  className="card"
                  titleClassName="text-2xl font-bold text-white mb-1"
                  subtitleClassName="text-lg text-[var(--accent-blue)]"
                  dateClassName="text-gray-400 text-sm"
                />
              )}
            />
        </Section>

        <Section id="certifications" title="Certifications" data={data.certifications} className="bg-[var(--onyx-900)]" containerClassName="section-container" titleClassName="section-title">
            <SectionList
              items={data.certifications}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
              renderItem={(cert, idx) => (
                <CertificationItem
                  key={idx}
                  cert={cert}
                  className="card"
                  nameClassName="text-lg font-bold text-white"
                  detailClassName="text-gray-400 text-sm"
                />
              )}
            />
        </Section>

        <Section id="publications" title="Publications" data={data.publications} className="bg-[var(--onyx-950)]" containerClassName="section-container" titleClassName="section-title">
            <SectionList
              items={data.publications}
              className="space-y-4"
              renderItem={(pub, idx) => (
                <PublicationItem
                  key={idx}
                  pub={pub}
                  className="card flex flex-col gap-1"
                  titleClassName="text-lg font-bold text-white"
                  detailClassName="text-gray-400 text-sm ml-2"
                  linkClassName="text-lg font-bold text-[var(--accent-blue)] hover:text-[var(--accent-teal)]"
                />
              )}
            />
        </Section>

        <Section id="awards" title="Awards" data={data.awards} className="bg-[var(--onyx-900)]" containerClassName="section-container" titleClassName="section-title">
            <SectionList
              items={data.awards}
              className="space-y-4"
              renderItem={(award, idx) => (
                <AwardItem
                  key={idx}
                  award={award}
                  className="card"
                  titleClassName="text-lg font-bold text-white"
                  detailClassName="text-gray-400 text-sm ml-2"
                />
              )}
            />
        </Section>

        <Section id="volunteer" title="Volunteer Experience" data={data.volunteer} className="bg-[var(--onyx-950)]" containerClassName="section-container" titleClassName="section-title">
            <SectionList
              items={data.volunteer}
              className="space-y-6"
              renderItem={(vol, idx) => (
                <TimelineEntry
                  key={idx}
                  title={vol.role || ''}
                  subtitle={vol.organization}
                  startDate={vol.startDate}
                  endDate={vol.endDate}
                  description={vol.description}
                  className="card"
                  titleClassName="text-xl font-bold text-white mb-1"
                  subtitleClassName="text-lg text-[var(--accent-blue)]"
                  dateClassName="text-gray-400 text-sm"
                />
              )}
            />
        </Section>

        <Section id="languages" title="Languages" data={data.languages} className="bg-[var(--onyx-900)]" containerClassName="section-container" titleClassName="section-title">
            <div className="flex flex-wrap gap-4">
              {data.languages.map((lang, idx) => (
                <LanguageItem
                  key={idx}
                  lang={lang}
                  className="card flex items-center gap-2 px-4 py-2"
                  nameClassName="text-white font-bold"
                  proficiencyClassName="text-gray-400 text-sm"
                />
              ))}
            </div>
        </Section>

        <Section id="contact" title="Get In Touch" data={data.contact} className="bg-[var(--onyx-950)]" containerClassName="section-container text-center" titleClassName="section-title">
            <p className="text-lg text-gray-300 mb-8">
              I&apos;m always open to discussing new projects, creative ideas, or opportunities.
            </p>
            <ContactBar
              contact={data.contact}
              className="flex flex-col items-center space-y-4"
              linkClassName="text-xl text-[var(--accent-blue)] hover:text-[var(--accent-teal)] transition-colors"
            />
        </Section>
      </main>

      <OnyxFooter fullName={data.profile.fullName} />
    </div>
  );
}
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd src-generator && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src-generator/app/themes/onyx/portfolio.tsx src-generator/app/themes/onyx/components/
git commit -m "feat(generator): build Onyx portfolio layout with primitives"
```

---

## Task 9: Onyx Targeted Layout

**Files:**
- Create: `src-generator/app/themes/onyx/targeted.tsx`

The targeted layout leads with a role-match header, then relevant skills and experience, more concise than portfolio.

- [ ] **Step 1: Create Onyx targeted layout**

Create `src-generator/app/themes/onyx/targeted.tsx`:

```tsx
import React from 'react';
import { PortfolioData } from '@/types/portfolio';
import { Section, SectionList, ContactBar, TimelineEntry, ProjectCard, CertificationItem, LanguageItem } from '@/primitives';
import { PhotoFrame } from '@/primitives';
import { OnyxSkillGrid } from './components/OnyxSkillGrid';
import { OnyxFooter } from './components/OnyxFooter';
import './styles/theme.css';

interface OnyxTargetedProps {
  data: PortfolioData;
}

export default function OnyxTargeted({ data }: OnyxTargetedProps) {
  return (
    <div className="onyx-theme min-h-screen bg-[var(--onyx-950)] text-gray-100 font-body">
      {/* Targeted header — no full nav, focus on role match */}
      <header className="bg-[var(--onyx-900)] border-b border-[var(--onyx-700)]">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="flex items-center gap-8">
            <PhotoFrame
              src={data.profile.photo}
              alt={data.profile.fullName}
              shape="rounded"
              size="w-24 h-24"
            />
            <div>
              <h1 className="text-4xl font-heading font-bold text-white">
                {data.profile.fullName}
              </h1>
              {data.jobPosting && (
                <p className="text-xl text-[var(--accent-blue)] mt-1">
                  for {data.jobPosting.title} at {data.jobPosting.company}
                </p>
              )}
              <p className="text-gray-400 mt-2">{data.profile.title}</p>
            </div>
          </div>
          {data.profile.summary && (
            <p className="text-gray-300 mt-6 max-w-3xl leading-relaxed">
              {data.profile.summary}
            </p>
          )}
        </div>
      </header>

      <main>
        <Section id="skills" title="Skills" data={data.skills} className="bg-[var(--onyx-950)]" containerClassName="section-container" titleClassName="section-title">
          <OnyxSkillGrid skills={data.skills} />
        </Section>

        <Section id="experience" title="Experience" data={data.workExperience} className="bg-[var(--onyx-900)]" containerClassName="section-container" titleClassName="section-title">
          <SectionList
            items={data.workExperience}
            className="space-y-6"
            renderItem={(exp, idx) => (
              <TimelineEntry
                key={idx}
                title={exp.title}
                subtitle={exp.company}
                startDate={exp.startDate}
                endDate={exp.endDate}
                highlights={exp.responsibilities}
                className="card"
                titleClassName="text-xl font-bold text-white mb-1"
                subtitleClassName="text-lg text-[var(--accent-blue)]"
                dateClassName="text-gray-400 text-sm"
                highlightClassName="flex items-start text-gray-300"
                highlightBullet={<span className="text-[var(--accent-teal)] mr-2 mt-1">▹</span>}
              />
            )}
          />
        </Section>

        <Section id="projects" title="Projects" data={data.projects} className="bg-[var(--onyx-950)]" containerClassName="section-container" titleClassName="section-title">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.projects.map((project, idx) => (
              <ProjectCard
                key={idx}
                project={project}
                className="card"
                nameClassName="text-lg font-bold text-white mb-2"
                techClassName="tech-tag"
                linkClassName="text-[var(--accent-blue)] hover:text-[var(--accent-teal)] transition-colors text-sm"
              />
            ))}
          </div>
        </Section>

        <Section id="education" title="Education" data={data.education} className="bg-[var(--onyx-900)]" containerClassName="section-container" titleClassName="section-title">
          <SectionList
            items={data.education}
            className="space-y-4"
            renderItem={(edu, idx) => (
              <TimelineEntry
                key={idx}
                title={edu.institution}
                subtitle={`${edu.degree}${edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ''}`}
                endDate={edu.endDate}
                className="card"
                titleClassName="text-lg font-bold text-white mb-1"
                subtitleClassName="text-[var(--accent-blue)]"
                dateClassName="text-gray-400 text-sm"
              />
            )}
          />
        </Section>

        <Section id="certifications" title="Certifications" data={data.certifications} className="bg-[var(--onyx-950)]" containerClassName="section-container" titleClassName="section-title">
          <SectionList
            items={data.certifications}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
            renderItem={(cert, idx) => (
              <CertificationItem
                key={idx}
                cert={cert}
                className="card"
                nameClassName="text-white font-bold"
                detailClassName="text-gray-400 text-sm"
              />
            )}
          />
        </Section>

        <Section id="languages" title="Languages" data={data.languages} className="bg-[var(--onyx-900)]" containerClassName="section-container" titleClassName="section-title">
          <div className="flex flex-wrap gap-3">
            {data.languages.map((lang, idx) => (
              <LanguageItem
                key={idx}
                lang={lang}
                className="card flex items-center gap-2 px-4 py-2"
                nameClassName="text-white font-bold"
                proficiencyClassName="text-gray-400 text-sm"
              />
            ))}
          </div>
        </Section>

        <section className="bg-[var(--onyx-950)]">
          <div className="max-w-5xl mx-auto px-6 py-12 text-center">
            <ContactBar
              contact={data.contact}
              className="flex flex-wrap justify-center gap-6"
              linkClassName="text-[var(--accent-blue)] hover:text-[var(--accent-teal)] transition-colors"
            />
          </div>
        </section>
      </main>

      <OnyxFooter fullName={data.profile.fullName} />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd src-generator && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src-generator/app/themes/onyx/targeted.tsx
git commit -m "feat(generator): build Onyx targeted layout"
```

---

## Task 10: Router Update, Cleanup, and Integration Test

**Files:**
- Modify: `src-generator/app/page.tsx`
- Delete: old Onyx theme files (page.tsx, theme.config.json, components/)

- [ ] **Step 1: Update page.tsx router**

Replace `src-generator/app/page.tsx`:

```tsx
import { loadPortfolioData } from './lib/loadPortfolioData';
import { jetbrainsMono, inter } from './themes/onyx/fonts';
import OnyxPortfolio from './themes/onyx/portfolio';
import OnyxTargeted from './themes/onyx/targeted';

export default function Home() {
  const data = loadPortfolioData();
  const themeName = data.theme.name.toLowerCase();
  const isTargeted = data.siteType === 'targeted';

  // Font classes — each theme applies its own font variables
  let fontClasses = '';

  switch (themeName) {
    case 'onyx':
    default:
      fontClasses = `${jetbrainsMono.variable} ${inter.variable}`;
      if (isTargeted) {
        return <div className={fontClasses}><OnyxTargeted data={data} /></div>;
      }
      return <div className={fontClasses}><OnyxPortfolio data={data} /></div>;
  }
}
```

- [ ] **Step 2: Delete old Onyx theme files**

```bash
cd src-generator
rm -f app/themes/onyx/page.tsx
rm -f app/themes/onyx/theme.config.json
rm -rf app/themes/onyx/components/Header.tsx
rm -rf app/themes/onyx/components/Profile.tsx
rm -rf app/themes/onyx/components/WorkExperience.tsx
rm -rf app/themes/onyx/components/Projects.tsx
rm -rf app/themes/onyx/components/Education.tsx
rm -rf app/themes/onyx/components/Skills.tsx
rm -rf app/themes/onyx/components/Contact.tsx
```

- [ ] **Step 3: Create sample data for integration test**

Create `src-generator/.data/portfolio-data.json` (temporary, for build test):

```json
{
  "profile": {
    "fullName": "Jane Developer",
    "title": "Senior Software Engineer",
    "summary": "Full-stack engineer with 10 years of experience building scalable systems.",
    "location": "San Francisco, CA"
  },
  "contact": {
    "email": "jane@example.com",
    "website": "https://jane.dev",
    "socialLinks": [{"platform": "LinkedIn", "url": "https://linkedin.com/in/jane"}, {"platform": "GitHub", "url": "https://github.com/jane"}]
  },
  "workExperience": [
    {"company": "BigTech Corp", "title": "Senior Engineer", "startDate": "2020-01", "endDate": "Present", "responsibilities": ["Led platform migration", "Mentored 5 junior engineers"]},
    {"company": "StartupCo", "title": "Software Engineer", "startDate": "2016-06", "endDate": "2019-12", "responsibilities": ["Built real-time data pipeline", "Reduced costs 40%"]}
  ],
  "projects": [
    {"name": "OpenSource Tool", "description": "CLI for managing cloud infrastructure", "technologies": ["Go", "AWS", "Terraform"], "url": "https://github.com/jane/tool"},
    {"name": "Data Dashboard", "description": "Real-time analytics visualization", "technologies": ["React", "D3.js", "PostgreSQL"]}
  ],
  "education": [
    {"institution": "MIT", "degree": "B.S.", "fieldOfStudy": "Computer Science", "endDate": "2016"}
  ],
  "skills": [
    {"category": "Languages", "items": ["Python", "TypeScript", "Go", "Rust"]},
    {"category": "Infrastructure", "items": ["AWS", "Docker", "Kubernetes", "Terraform"]},
    {"category": "Frameworks", "items": ["React", "FastAPI", "Next.js"]}
  ],
  "certifications": [
    {"name": "AWS Solutions Architect", "issuer": "Amazon", "dateObtained": "2023-01"}
  ],
  "publications": [],
  "awards": [{"title": "Hack Week Winner", "issuer": "BigTech Corp", "date": "2022"}],
  "volunteer": [],
  "languages": [{"language": "English", "proficiency": "Native"}, {"language": "Spanish", "proficiency": "Conversational"}],
  "theme": {"name": "onyx"},
  "siteType": "portfolio"
}
```

- [ ] **Step 4: Run integration test — build the site**

Run: `cd src-generator && npx next build`
Expected: Build succeeds, `out/` directory created with static HTML

- [ ] **Step 5: Verify the output contains expected content**

Run: `grep "Jane Developer" src-generator/out/index.html`
Expected: Match found — the profile name appears in the generated HTML

- [ ] **Step 6: Clean up test data**

```bash
rm -rf src-generator/.data
rm -rf src-generator/out
```

- [ ] **Step 7: Run all tests**

```bash
cd src-generator && npx vitest run
cd ../src-api && uv run pytest tests/unit/test_profile_transform.py tests/unit/test_site_generator.py -v
```

Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add -A src-generator/
git commit -m "feat(generator): wire Onyx theme through router, remove old theme files

Onyx is now the first theme built on the composition architecture:
- Primitives library for shared components
- Portfolio and targeted layout variants
- JetBrains Mono + Inter fonts via next/font
- Expanded data contract with full JSON Resume coverage"
```

---

## Summary

After Plan A is complete:
- ✅ Expanded TypeScript types (full JSON Resume coverage)
- ✅ Python profile transform (DB schema → PortfolioData)
- ✅ Updated data pipeline (generate.js + loadPortfolioData)
- ✅ Photo field in backend schema
- ✅ 15 shared primitives (structural + utility + content)
- ✅ Onyx theme with portfolio + targeted layouts
- ✅ Theme config schema (ThemeConfig type)
- ✅ Vitest test infrastructure
- ✅ Integration-tested end-to-end build

**Plan B** (next phase) will cover:
- 4 remaining themes (Coral, Serene, Jade, Quartz) — both layouts each
- Live preview system (generator SSR mode + API endpoints)
- Admin UI theme picker redesign (card grid with preview iframe)
- Photo upload UI on the admin profile page
- `GET /api/themes` and `GET /api/themes/preview/{slug}` endpoints
