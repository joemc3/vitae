import json
import re
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.services import llm_service

TAILORING_SYSTEM_PROMPT = """You are a professional profile tailor. You will receive a person's professional profile and a job posting. Your task is to produce a tailored version of the profile that emphasizes the most relevant experience, skills, and accomplishments for the specific role.

Guidelines:
- Rewrite the summary to highlight relevance to the target role
- Reorder and filter experience to lead with the most relevant positions
- Emphasize relevant skills, de-emphasize irrelevant ones
- Adjust highlights to match the job requirements
- Do NOT invent information — only restructure and rewrite what exists
- Keep the same JSON structure as the input profile

Return ONLY valid JSON matching the same profile structure. No markdown, no explanation."""


def build_tailoring_prompt(profile_data: dict, job_posting: dict) -> list[dict]:
    """Build LLM messages for profile tailoring."""
    user_content = (
        f"## Professional Profile\n\n{json.dumps(profile_data, indent=2)}\n\n"
        f"## Target Job Posting\n\n"
        f"Title: {job_posting.get('title', 'Unknown')}\n"
        f"Company: {job_posting.get('company', 'Unknown')}\n"
        f"Description: {job_posting.get('description', '')}\n"
        f"Requirements: {json.dumps(job_posting.get('requirements', {}), indent=2)}"
    )

    return [
        {"role": "system", "content": TAILORING_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]


def _parse_json_response(text: str) -> dict:
    """Parse a JSON response, stripping markdown code blocks if present."""
    text = text.strip()
    code_block_match = re.match(r"```(?:json)?\s*\n?(.*?)\n?\s*```", text, re.DOTALL)
    if code_block_match:
        text = code_block_match.group(1).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in LLM response: {e}") from e


async def tailor_profile(
    profile_data: dict,
    job_posting: dict,
    model: str,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> dict:
    """Produce a tailored profile variant for a specific job posting."""
    messages = build_tailoring_prompt(profile_data, job_posting)

    response_text = await llm_service.complete(model, messages, user_id, db)

    try:
        return _parse_json_response(response_text)
    except ValueError:
        # Retry once
        messages.append({"role": "assistant", "content": response_text})
        messages.append({
            "role": "user",
            "content": "Your response was not valid JSON. Please respond with ONLY valid JSON matching the profile schema. No markdown, no explanation.",
        })
        response_text = await llm_service.complete(model, messages, user_id, db)
        return _parse_json_response(response_text)
