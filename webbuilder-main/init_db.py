"""Initialize SQLite database with all tables"""
import asyncio
import os
import sys

# Set env defaults before importing app modules
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./webbuilder.db")
os.environ.setdefault("SECRET_KEY", "botchain-dapp-builder-secret-key-2026-secure")

from db.base import Base, engine
from db.models import User, Chat, Message, Contract, ProjectFile


async def init():
    print("Creating database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ All tables created successfully!")
    
    # List tables
    async with engine.connect() as conn:
        result = await conn.run_sync(
            lambda sync_conn: [
                t.name for t in Base.metadata.sorted_tables
            ]
        )
        print(f"Tables: {result}")
    
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(init())
