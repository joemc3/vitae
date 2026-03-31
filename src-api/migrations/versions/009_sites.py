"""Create sites table

Revision ID: 009
Revises: 008
Create Date: 2026-03-31
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sites",
        sa.Column("id", sa.UUID(), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("profile_id", sa.UUID(), nullable=False),
        sa.Column("job_posting_id", sa.UUID(), nullable=True),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("theme", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="queued"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("output_path", sa.String(500), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["profile_id"], ["profiles.id"]),
        sa.ForeignKeyConstraint(["job_posting_id"], ["job_postings.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("slug", name="uq_sites_slug"),
    )
    op.create_index("ix_sites_user_id", "sites", ["user_id"])
    op.create_index(
        "ix_sites_one_portfolio_per_user",
        "sites",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("type = 'portfolio'"),
    )


def downgrade() -> None:
    op.drop_index("ix_sites_one_portfolio_per_user")
    op.drop_index("ix_sites_user_id")
    op.drop_table("sites")
