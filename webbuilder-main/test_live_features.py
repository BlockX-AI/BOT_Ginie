"""
Quick validation script for Live File Viewing & Vercel URL features
Tests the newly implemented functionality
"""
import asyncio
import os
import sys
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)


async def test_live_features():
    print("\n" + "="*70)
    print("🧪 TESTING LIVE FILE VIEWING & VERCEL URL FEATURES")
    print("="*70 + "\n")
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    try:
        async with engine.begin() as conn:
            # Test 1: Check project_files table exists
            print("1️⃣  Checking project_files table...")
            result = await conn.execute(text("""
                SELECT COUNT(*) FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'project_files'
            """))
            table_exists = result.scalar() == 1
            print(f"   {'✅' if table_exists else '❌'} project_files table: {'EXISTS' if table_exists else 'MISSING'}")
            
            if not table_exists:
                print("   ⚠️  Database migration may not have run")
                return False
            
            # Test 2: Check table schema
            print("\n2️⃣  Verifying table schema...")
            result = await conn.execute(text("""
                SELECT column_name, data_type 
                FROM information_schema.columns
                WHERE table_name = 'project_files'
                ORDER BY ordinal_position
            """))
            columns = {row[0]: row[1] for row in result.fetchall()}
            
            required_columns = {
                'id': 'character varying',
                'project_id': 'character varying',
                'file_path': 'character varying',
                'content': 'text',
                'size': 'integer',
                'created_at': 'timestamp with time zone',
                'updated_at': 'timestamp with time zone'
            }
            
            all_good = True
            for col, dtype in required_columns.items():
                exists = col in columns
                print(f"   {'✅' if exists else '❌'} {col}: {columns.get(col, 'MISSING')}")
                if not exists:
                    all_good = False
            
            if not all_good:
                print("   ⚠️  Schema is incomplete")
                return False
            
            # Test 3: Check foreign key to chats table
            print("\n3️⃣  Checking foreign key relationship...")
            result = await conn.execute(text("""
                SELECT 
                    tc.constraint_name,
                    kcu.column_name,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name
                FROM information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                    ON tc.constraint_name = kcu.constraint_name
                JOIN information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = tc.constraint_name
                WHERE tc.table_name = 'project_files' AND tc.constraint_type = 'FOREIGN KEY'
            """))
            fk = result.fetchone()
            
            if fk:
                print(f"   ✅ Foreign key: {fk[1]} → {fk[2]}.{fk[3]}")
            else:
                print("   ❌ Foreign key constraint NOT FOUND")
                all_good = False
            
            # Test 4: Check unique constraint
            print("\n4️⃣  Checking unique constraint...")
            result = await conn.execute(text("""
                SELECT constraint_name 
                FROM information_schema.table_constraints
                WHERE table_name = 'project_files' AND constraint_type = 'UNIQUE'
            """))
            unique = result.fetchone()
            
            if unique:
                print(f"   ✅ Unique constraint: {unique[0]}")
            else:
                print("   ⚠️  Unique constraint not found (may cause duplicates)")
            
            # Test 5: Check if chats table has vercel_url column
            print("\n5️⃣  Checking chats table for Vercel URL column...")
            result = await conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns
                WHERE table_name = 'chats' AND column_name = 'vercel_url'
            """))
            vercel_col = result.fetchone()
            
            if vercel_col:
                print(f"   ✅ vercel_url column exists in chats table")
            else:
                print("   ❌ vercel_url column NOT FOUND in chats table")
                all_good = False
            
            # Test 6: Check deployment_status column
            result = await conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns
                WHERE table_name = 'chats' AND column_name = 'deployment_status'
            """))
            status_col = result.fetchone()
            
            if status_col:
                print(f"   ✅ deployment_status column exists in chats table")
            else:
                print("   ⚠️  deployment_status column not found")
            
            # Test 7: Count existing files in database
            print("\n6️⃣  Checking existing file records...")
            result = await conn.execute(text("""
                SELECT COUNT(*) FROM project_files
            """))
            file_count = result.scalar()
            print(f"   📁 Current file records in database: {file_count}")
            
            if file_count > 0:
                # Show a sample
                result = await conn.execute(text("""
                    SELECT project_id, file_path, size 
                    FROM project_files 
                    LIMIT 3
                """))
                print("   Sample files:")
                for row in result.fetchall():
                    print(f"      - {row[1]} ({row[2]} bytes) in project {row[0][:8]}...")
            
            # Test 8: Check imports in tools.py
            print("\n7️⃣  Verifying code changes in tools.py...")
            tools_path = "agent/tools.py"
            if os.path.exists(tools_path):
                with open(tools_path, 'r') as f:
                    content = f.read()
                    has_get_db = "from db.base import get_db" in content
                    has_store = "from utils.file_manager import store_project_file" in content
                    has_logging = "import logging" in content
                    
                    print(f"   {'✅' if has_get_db else '❌'} Import: get_db")
                    print(f"   {'✅' if has_store else '❌'} Import: store_project_file")
                    print(f"   {'✅' if has_logging else '❌'} Import: logging")
                    
                    if not (has_get_db and has_store):
                        all_good = False
            else:
                print("   ⚠️  Cannot find agent/tools.py")
            
            # Test 9: Check Vercel client naming changes
            print("\n8️⃣  Verifying Vercel naming changes...")
            vercel_path = "integrations/vercel_client.py"
            if os.path.exists(vercel_path):
                with open(vercel_path, 'r') as f:
                    content = f.read()
                    has_title_logic = "chat title" in content.lower() or "prompt" in content.lower()
                    has_short_suffix = "[-4:]" in content or "4 char" in content.lower()
                    
                    print(f"   {'✅' if has_title_logic else '❌'} Uses chat title for naming")
                    print(f"   {'✅' if has_short_suffix else '⚠️ '} Uses short suffix (4 chars)")
            else:
                print("   ⚠️  Cannot find integrations/vercel_client.py")
            
            print("\n" + "="*70)
            if all_good:
                print("✅ ALL CHECKS PASSED - Features are ready for testing!")
            else:
                print("⚠️  SOME ISSUES FOUND - Review output above")
            print("="*70 + "\n")
            
            return all_good
            
    except Exception as e:
        print(f"\n❌ Error during testing: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        await engine.dispose()


async def main():
    success = await test_live_features()
    
    if success:
        print("\n📋 NEXT STEPS:")
        print("   1. Start the backend: uvicorn main:app --reload")
        print("   2. Start the frontend: cd frontend && npm run dev")
        print("   3. Create a new chat and test:")
        print("      - Watch files appear in real-time as they're created")
        print("      - Check that Vercel URL uses project name")
        print("      - Verify green banner appears with Vercel link")
        print("\n🎯 Test with: 'Create a React calculator with modern UI'")
    else:
        print("\n⚠️  ISSUES DETECTED - Fix the problems above before testing")
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())
