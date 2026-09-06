"""make_user_id_nullable_in_chats

Revision ID: 4dc2dc2386b4
Revises: 2c1f0c3a4d11
Create Date: 2026-09-07 01:39:05.783429

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4dc2dc2386b4'
down_revision: Union[str, None] = '2c1f0c3a4d11'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Make user_id nullable in chats table
    op.alter_column('chats', 'user_id',
                    existing_type=sa.Integer(),
                    nullable=True)


def downgrade() -> None:
    # Make user_id non-nullable again
    op.alter_column('chats', 'user_id',
                    existing_type=sa.Integer(),
                    nullable=False)
