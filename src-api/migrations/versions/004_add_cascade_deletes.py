"""Add CASCADE on delete to foreign keys

Revision ID: 004
Revises: 003
Create Date: 2026-03-31
"""
from typing import Sequence, Union

from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("documents_user_id_fkey", "documents", type_="foreignkey")
    op.create_foreign_key("documents_user_id_fkey", "documents", "users", ["user_id"], ["id"], ondelete="CASCADE")
    op.drop_constraint("api_keys_user_id_fkey", "api_keys", type_="foreignkey")
    op.create_foreign_key("api_keys_user_id_fkey", "api_keys", "users", ["user_id"], ["id"], ondelete="CASCADE")


def downgrade() -> None:
    op.drop_constraint("documents_user_id_fkey", "documents", type_="foreignkey")
    op.create_foreign_key("documents_user_id_fkey", "documents", "users", ["user_id"], ["id"])
    op.drop_constraint("api_keys_user_id_fkey", "api_keys", type_="foreignkey")
    op.create_foreign_key("api_keys_user_id_fkey", "api_keys", "users", ["user_id"], ["id"])
