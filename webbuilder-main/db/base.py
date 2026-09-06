from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from typing import AsyncGenerator
import os
import logging

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

# Fallback to SQLite if DATABASE_URL is empty or unresolved (e.g. literal "${{...}}")
if not DATABASE_URL or DATABASE_URL.startswith("${{"):
    logger.warning("DATABASE_URL not set or unresolved, falling back to SQLite")
    DATABASE_URL = "sqlite+aiosqlite:///./webbuilder.db"

# Railway provides postgresql:// or postgres:// but SQLAlchemy async needs postgresql+asyncpg://
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)

logger.info(f"Using database URL (masked): {DATABASE_URL.split('@')[0].split(':')[0]}:***@{DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else 'local'}")

# Check if using SQLite
_is_sqlite = DATABASE_URL.startswith("sqlite")

# Creates a connection pool that supports async I/O.
if _is_sqlite:
    engine = create_async_engine(
        DATABASE_URL,
        echo=False,
        future=True,
    )
else:
    engine = create_async_engine(
        DATABASE_URL,
        echo=True,
        future=True,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        pool_recycle=3600,
        connect_args={
            "statement_cache_size": 0,
            "server_settings": {
                "application_name": "lovable-backend",
                "jit": "off"
            }
        }
    )


# async_sessionmaker() creates a factory for new async sessions.
# Every time you call AsyncSessionLocal(), you get a new independent database session.
# class_=AsyncSession → ensures it returns async sessions (not sync ones).
# expire_on_commit=False → means objects remain “usable” even after commit.
# If it were True, SQLAlchemy would clear object state after a commit.

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    # Creates a database session.
    async with AsyncSessionLocal() as session:
        try:
            # “Pauses” the function and hands out the session object to whoever called get_db().
            yield session
            # When the route finishes using the session, Python returns control back to get_db() — continuing after the yield line.
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
