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
    has_resume: bool = False,
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
        has_resume=has_resume,
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
