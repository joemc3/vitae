import pytest

from app.schemas.profile import (
    Award,
    Basics,
    Certification,
    Education,
    Experience,
    LanguageSkill,
    ProfileData,
    Project,
    Publication,
    Skill,
    Volunteer,
)


class TestProfileDataValidation:
    def test_empty_profile_is_valid(self):
        """All sections are optional — an empty profile is valid."""
        profile = ProfileData()
        assert profile.basics is None
        assert profile.skills is None
        assert profile.experience is None

    def test_full_profile_is_valid(self):
        """A profile with every section populated validates correctly."""
        profile = ProfileData(
            basics=Basics(
                name="Jane Doe",
                title="Senior Engineer",
                email="jane@example.com",
                phone="555-0100",
                location="San Francisco, CA",
                linkedin="linkedin.com/in/janedoe",
                website="janedoe.dev",
                summary="Experienced engineer with 10 years in distributed systems.",
            ),
            skills=[
                Skill(category="Languages", items=["Python", "Go", "TypeScript"]),
                Skill(category="Tools", items=["Docker", "Kubernetes"]),
            ],
            experience=[
                Experience(
                    company="Acme Corp",
                    title="Staff Engineer",
                    start_date="2020-01",
                    end_date=None,
                    current=True,
                    description="Leading platform team.",
                    highlights=["Built CI/CD pipeline", "Reduced deploy time 80%"],
                ),
            ],
            education=[
                Education(
                    institution="MIT",
                    degree="BS",
                    field="Computer Science",
                    start_date="2008",
                    end_date="2012",
                    notes=None,
                ),
            ],
            certifications=[
                Certification(
                    name="AWS Solutions Architect",
                    issuer="Amazon",
                    date_obtained="2023-03",
                    expiration="2026-03",
                    credential_id="ABC123",
                ),
            ],
            projects=[
                Project(
                    name="Open Source Router",
                    description="High-performance HTTP router.",
                    role="Creator & maintainer",
                    technologies=["Go", "Linux"],
                    outcomes=["5k GitHub stars", "Used by 200+ companies"],
                ),
            ],
            publications=[
                Publication(
                    title="Scaling Distributed Systems",
                    venue="ACM Queue",
                    date="2022-06",
                    url="https://example.com/paper",
                ),
            ],
            awards=[
                Award(
                    title="Engineer of the Year",
                    issuer="Acme Corp",
                    date="2023",
                    description="For platform reliability improvements.",
                ),
            ],
            volunteer=[
                Volunteer(
                    organization="Code for America",
                    role="Mentor",
                    start_date="2019",
                    end_date="2021",
                    description="Mentored junior developers.",
                ),
            ],
            languages=[
                LanguageSkill(language="English", proficiency="Native"),
                LanguageSkill(language="Spanish", proficiency="Conversational"),
            ],
        )
        assert profile.basics.name == "Jane Doe"
        assert len(profile.skills) == 2
        assert len(profile.experience) == 1
        assert profile.experience[0].current is True
        assert len(profile.certifications) == 1
        assert len(profile.projects) == 1
        assert len(profile.publications) == 1
        assert len(profile.awards) == 1
        assert len(profile.volunteer) == 1
        assert len(profile.languages) == 2

    def test_partial_profile_only_basics_and_skills(self):
        """A profile with only basics and skills, everything else null."""
        profile = ProfileData(
            basics=Basics(name="John", summary="Developer"),
            skills=[Skill(category="Languages", items=["Python"])],
        )
        assert profile.basics.name == "John"
        assert profile.basics.title is None
        assert profile.basics.email is None
        assert profile.education is None
        assert profile.certifications is None
        assert profile.projects is None

    def test_profile_serialization_excludes_none(self):
        """model_dump(exclude_none=True) omits null sections."""
        profile = ProfileData(
            basics=Basics(name="Jane"),
        )
        data = profile.model_dump(exclude_none=True)
        assert "basics" in data
        assert "skills" not in data
        assert "experience" not in data

    def test_profile_from_dict(self):
        """ProfileData can be constructed from a raw dict (LLM JSON output)."""
        raw = {
            "basics": {"name": "Jane", "title": "Engineer"},
            "skills": [{"category": "Tools", "items": ["Git"]}],
        }
        profile = ProfileData(**raw)
        assert profile.basics.name == "Jane"
        assert profile.skills[0].items == ["Git"]

    def test_experience_defaults(self):
        """Experience fields default to None, current defaults to None."""
        exp = Experience(company="Acme", title="Engineer")
        assert exp.start_date is None
        assert exp.end_date is None
        assert exp.current is None
        assert exp.highlights is None


class TestBasicsModel:
    def test_all_fields_optional(self):
        """Every field in Basics is optional."""
        basics = Basics()
        assert basics.name is None
        assert basics.title is None
        assert basics.email is None
        assert basics.phone is None
        assert basics.location is None
        assert basics.linkedin is None
        assert basics.website is None
        assert basics.summary is None
