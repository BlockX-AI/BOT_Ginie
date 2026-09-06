"""add_project_files_table

Revision ID: ac30a08bd1fe
Revises: 7b9779bbc27d
Create Date: 2025-12-08 20:10:10.602948

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ac30a08bd1fe'
down_revision: Union[str, None] = '7b9779bbc27d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create project_files table for storing all project files
    op.create_table(
        'project_files',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('project_id', sa.String(36), sa.ForeignKey('chats.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('file_path', sa.String(512), nullable=False),
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('size', sa.Integer, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    
    # Create unique constraint on project_id + file_path
    op.create_unique_constraint('uq_project_file', 'project_files', ['project_id', 'file_path'])


def downgrade() -> None:
    op.drop_table('project_files')
