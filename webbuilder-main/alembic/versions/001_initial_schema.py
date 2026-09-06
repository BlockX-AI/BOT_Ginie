"""Initial schema with users, chats, messages, and contracts

Revision ID: 001
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_query_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('tokens_remaining', sa.Integer(), nullable=False, server_default='10'),
        sa.Column('tokens_reset_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)

    # Create chats table
    op.create_table(
        'chats',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('app_url', sa.String(length=1024), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create messages table
    op.create_table(
        'messages',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('chat_id', sa.String(length=36), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('event_type', sa.String(length=100), nullable=True),
        sa.Column('tool_calls', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['chat_id'], ['chats.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create contracts table
    op.create_table(
        'contracts',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('chat_id', sa.String(length=36), nullable=False),
        sa.Column('contract_name', sa.String(length=255), nullable=False),
        sa.Column('contract_address', sa.String(length=42), nullable=False),
        sa.Column('network', sa.String(length=50), nullable=False),
        sa.Column('chain_id', sa.Integer(), nullable=False),
        sa.Column('abi', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('source_code', sa.Text(), nullable=True),
        sa.Column('job_id', sa.String(length=100), nullable=True),
        sa.Column('deploy_tx_hash', sa.String(length=66), nullable=True),
        sa.Column('verified', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('explorer_url', sa.String(length=512), nullable=True),
        sa.Column('deployment_status', sa.String(length=50), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['chat_id'], ['chats.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_contracts_chat_id'), 'contracts', ['chat_id'], unique=False)
    op.create_index(op.f('ix_contracts_contract_address'), 'contracts', ['contract_address'], unique=False)
    op.create_index(op.f('ix_contracts_job_id'), 'contracts', ['job_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_contracts_job_id'), table_name='contracts')
    op.drop_index(op.f('ix_contracts_contract_address'), table_name='contracts')
    op.drop_index(op.f('ix_contracts_chat_id'), table_name='contracts')
    op.drop_table('contracts')
    op.drop_table('messages')
    op.drop_table('chats')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
