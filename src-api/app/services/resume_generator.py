import json
import re
import uuid
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

TEMPLATES_DIR = Path(__file__).parent.parent / "templates" / "resume"

VALID_THEMES = ["plain", "onyx", "coral", "serene", "jade", "quartz"]

GENERAL_SYSTEM_PROMPT = """You are a professional resume writer. You will receive a person's professional profile. Your task is to produce resume content — concise, impactful, and formatted for a professional resume PDF.

Guidelines:
- Write a strong professional summary (2-3 sentences)
- Convert experience descriptions into concise achievement-oriented bullets
- Use strong action verbs and quantify results where possible
- Prioritize content by impact and relevance
- Include only the most important items — a resume is not a comprehensive list
- Target content density for the specified page count

Return ONLY valid JSON with this structure:
{
  "summary": "Professional summary text",
  "experience": [{"company": "", "title": "", "start_date": "", "end_date": null, "bullets": [""]}],
  "skills": [{"category": "", "items": [""]}],
  "education": [{"institution": "", "degree": "", "end_date": ""}],
  "certifications": [{"name": "", "issuer": "", "date": ""}],
  "projects": [{"name": "", "description": "", "technologies": [""]}],
  "publications": [{"title": "", "venue": "", "date": ""}],
  "awards": [{"title": "", "issuer": "", "date": ""}],
  "languages": [{"language": "", "proficiency": ""}]
}

Omit empty arrays. No markdown, no explanation — JSON only."""

TARGETED_SYSTEM_PROMPT = """You are a professional resume writer specializing in targeted resumes. You will receive a person's professional profile AND a specific job posting. Your task is to produce resume content tailored to that role.

Guidelines:
- Rewrite the summary to address the specific role and company
- Reorder experience to lead with the most relevant positions
- Rephrase bullets to emphasize skills and achievements matching the job requirements
- Surface matching skills prominently, de-emphasize irrelevant ones
- Drop content that isn't relevant to the target role
- Do NOT invent information — only restructure and rewrite what exists
- Target content density for the specified page count

Return ONLY valid JSON with the same structure as a general resume. No markdown, no explanation — JSON only."""


def build_general_prompt(profile_data: dict, page_target: int) -> list[dict]:
    """Build LLM messages for general resume content generation."""
    user_content = (
        f"## Professional Profile\n\n{json.dumps(profile_data, indent=2)}\n\n"
        f"## Instructions\n\n"
        f"Produce resume content targeting {page_target} page{'s' if page_target > 1 else ''}. "
        f"Calibrate the amount of content accordingly — {'be very concise, only the essentials' if page_target == 1 else 'include detail proportional to the page budget'}."
    )
    return [
        {"role": "system", "content": GENERAL_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]


def build_targeted_prompt(profile_data: dict, job_posting: dict, page_target: int) -> list[dict]:
    """Build LLM messages for targeted resume content generation."""
    user_content = (
        f"## Professional Profile\n\n{json.dumps(profile_data, indent=2)}\n\n"
        f"## Target Job Posting\n\n"
        f"Title: {job_posting.get('title', 'Unknown')}\n"
        f"Company: {job_posting.get('company', 'Unknown')}\n"
        f"Description: {job_posting.get('description', '')}\n"
        f"Requirements: {json.dumps(job_posting.get('requirements', {}), indent=2)}\n\n"
        f"## Instructions\n\n"
        f"Produce resume content targeting {page_target} page{'s' if page_target > 1 else ''}, "
        f"tailored specifically for this role at {job_posting.get('company', 'the company')}."
    )
    return [
        {"role": "system", "content": TARGETED_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]


def build_trim_prompt(resume_content: dict, actual_pages: int, target_pages: int) -> list[dict]:
    """Build a follow-up prompt to trim content that overflowed the page target."""
    return [
        {"role": "system", "content": GENERAL_SYSTEM_PROMPT},
        {
            "role": "assistant",
            "content": json.dumps(resume_content, indent=2),
        },
        {
            "role": "user",
            "content": (
                f"The rendered resume is {actual_pages} pages but the target is {target_pages} pages. "
                f"Condense the content to fit {target_pages} page{'s' if target_pages > 1 else ''}: "
                f"cut less important items, tighten bullets, remove optional sections. "
                f"Return the trimmed JSON in the same format."
            ),
        },
    ]


def parse_resume_content(text: str) -> dict:
    """Parse resume content JSON from LLM response, stripping markdown if present."""
    text = text.strip()
    code_block_match = re.match(r"```(?:json)?\s*\n?(.*?)\n?\s*```", text, re.DOTALL)
    if code_block_match:
        text = code_block_match.group(1).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in LLM response: {e}") from e


def render_resume_html(resume_content: dict, basics: dict, theme: str) -> str:
    """Render resume content to HTML using the specified theme template."""
    if theme not in VALID_THEMES:
        raise ValueError(f"Unknown theme: {theme}. Valid themes: {VALID_THEMES}")

    env = Environment(
        loader=FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=True,
    )
    template = env.get_template(f"{theme}.html.j2")

    # Read theme CSS
    css_path = TEMPLATES_DIR / f"{theme}.css"
    theme_css = css_path.read_text() if css_path.exists() else ""

    # Read base CSS
    base_css_path = TEMPLATES_DIR / "base.css"
    base_css = base_css_path.read_text() if base_css_path.exists() else ""

    return template.render(
        basics=basics,
        content=resume_content,
        base_css=base_css,
        theme_css=theme_css,
    )


def render_pdf(html: str) -> bytes:
    """Convert HTML to PDF bytes using WeasyPrint."""
    from weasyprint import HTML

    return HTML(string=html).write_pdf()


def count_pdf_pages(pdf_bytes: bytes) -> int:
    """Count pages in a PDF from bytes using pymupdf (already a project dependency)."""
    import fitz  # pymupdf

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    count = len(doc)
    doc.close()
    return max(count, 1)
