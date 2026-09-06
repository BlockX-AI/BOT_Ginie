"""add build status tracking

Revision ID: f8e9a7c5d3b1
Revises: ac30a08bd1fe
Create Date: 2025-12-11

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'f8e9a7c5d3b1'
down_revision = 'ac30a08bd1fe'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add build status tracking columns to chats table
    op.add_column('chats', sa.Column('build_status', sa.String(length=50), nullable=True))
    op.add_column('chats', sa.Column('build_started_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('chats', sa.Column('last_build_event', sa.Text(), nullable=True))


def downgrade() -> None:
    # Remove build status tracking columns
    op.drop_column('chats', 'last_build_event')
    op.drop_column('chats', 'build_started_at')
    op.drop_column('chats', 'build_status')
