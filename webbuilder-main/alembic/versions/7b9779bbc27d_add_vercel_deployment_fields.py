"""add_vercel_deployment_fields

Revision ID: 7b9779bbc27d
Revises: 001
Create Date: 2025-12-05 21:33:01.652875

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7b9779bbc27d'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add vercel_url column to chats table
    op.add_column('chats', sa.Column('vercel_url', sa.String(1024), nullable=True))
    
    # Add deployment_status column to chats table
    # Possible values: null (not deployed), 'deploying', 'deployed', 'failed'
    op.add_column('chats', sa.Column('deployment_status', sa.String(50), nullable=True))


def downgrade() -> None:
    # Remove the added columns
    op.drop_column('chats', 'deployment_status')
    op.drop_column('chats', 'vercel_url')
