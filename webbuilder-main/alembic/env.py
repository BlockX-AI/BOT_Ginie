from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

import os

import sys

from pathlib import Path



# Add parent directory to path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))



# this is the Alembic Config object

config = context.config



# Interpret the config file for Python logging

if config.config_file_name is not None:

    fileConfig(config.config_file_name)



# Import your models

from db.base import Base

from db.models import User, Chat, Message, Contract, ProjectFile



target_metadata = Base.metadata



# Get DATABASE_URL from environment

from dotenv import load_dotenv

load_dotenv()  # Load from .env file if exists (local development)



# Always try to set DATABASE_URL from environment

database_url = os.getenv("DATABASE_URL")

if database_url:

    # Convert async driver to sync for migrations

    database_url = database_url.replace("postgresql+asyncpg://", "postgresql://")

    config.set_main_option("sqlalchemy.url", database_url)





def run_migrations_offline() -> None:

    """Run migrations in 'offline' mode."""

    url = config.get_main_option("sqlalchemy.url")

    context.configure(

        url=url,

        target_metadata=target_metadata,

        literal_binds=True,

        dialect_opts={"paramstyle": "named"},

    )



    with context.begin_transaction():

        context.run_migrations()





def run_migrations_online() -> None:

    """Run migrations in 'online' mode."""

    # Get the configuration section

    configuration = config.get_section(config.config_ini_section) or {}

    

    # Get the database URL from environment or config

    db_url = config.get_main_option("sqlalchemy.url")

    

    if not db_url:

        raise ValueError(

            "No database URL found. Please set DATABASE_URL environment variable."

        )

    

    # Set the URL in the configuration dict with the prefix

    configuration["sqlalchemy.url"] = db_url

    

    connectable = engine_from_config(

        configuration,

        prefix="sqlalchemy.",

        poolclass=pool.NullPool,

    )



    with connectable.connect() as connection:

        context.configure(

            connection=connection, target_metadata=target_metadata

        )



        with context.begin_transaction():

            context.run_migrations()





if context.is_offline_mode():

    run_migrations_offline()

else:

    run_migrations_online()

