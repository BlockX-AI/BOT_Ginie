"""add_github_repo_url

Revision ID: 2c1f0c3a4d11
Revises: f8e9a7c5d3b1
Create Date: 2026-01-08

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '2c1f0c3a4d11'
down_revision = 'f8e9a7c5d3b1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('chats', sa.Column('github_repo_url', sa.String(1024), nullable=True))


def downgrade() -> None:
    op.drop_column('chats', 'github_repo_url')
