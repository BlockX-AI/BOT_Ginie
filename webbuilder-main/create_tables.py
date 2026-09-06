"""
Create all database tables directly using SQLAlchemy
This bypasses Alembic and creates tables from the models
"""
import asyncio
import os
import sys

# Import models to register them with Base
from db.base import Base, engine
from db.models import User, Chat, Message, Contract, ProjectFile

async def create_all_tables():
    """Create all tables defined in the models"""
    print("🔧 Creating all database tables...")
    print(f"📊 Database URL: {os.getenv('DATABASE_URL', 'Not set')[:50]}...")
    
    try:
        async with engine.begin() as conn:
            # Drop all tables first (optional - comment out if you want to keep existing data)
            # await conn.run_sync(Base.metadata.drop_all)
            # print("🗑️  Dropped all existing tables")
            
            # Create all tables
            await conn.run_sync(Base.metadata.create_all)
            print("✅ All tables created successfully!")
        
        # List created tables
        async with engine.connect() as conn:
            result = await conn.run_sync(
                lambda sync_conn: [t.name for t in Base.metadata.sorted_tables]
            )
            print(f"\n📋 Created tables: {', '.join(result)}")
        
        await engine.dispose()
        print("\n🎉 Database initialization complete!")
        return True
        
    except Exception as e:
        print(f"\n❌ Error creating tables: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(create_all_tables())
    sys.exit(0 if success else 1)
