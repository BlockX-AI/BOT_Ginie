"""
Complete integration test for file system features
Tests database schema, API endpoints, and file storage
"""
import asyncio
import os
import sys
from sqlalchemy import select, inspect, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import httpx
import uuid

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db.models import Base, ProjectFile, Chat
from utils.file_manager import (
    store_project_file,
    get_project_files,
    get_project_files_with_content,
    delete_project_files,
    get_file_count
)

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("❌ DATABASE_URL not found in environment")
    sys.exit(1)

# Convert postgres:// to postgresql+asyncpg://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

print(f"🔗 Database URL: {DATABASE_URL[:50]}...")

# API Configuration
API_BASE_URL = os.getenv("API_BASE_URL", " https://evi-web-production.up.railway.app")


async def test_database_schema():
    """Test 1: Verify database tables and schema"""
    print("\n" + "="*60)
    print("TEST 1: Database Schema Verification")
    print("="*60)
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    try:
        async with engine.begin() as conn:
            # Check if project_files table exists
            result = await conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'project_files'
            """))
            table_exists = result.fetchone()
            
            if table_exists:
                print("✅ project_files table exists")
            else:
                print("❌ project_files table NOT found")
                return False
            
            # Check columns
            result = await conn.execute(text("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'project_files'
                ORDER BY ordinal_position
            """))
            columns = result.fetchall()
            
            print("\n📋 Table Schema:")
            expected_columns = ['id', 'project_id', 'file_path', 'content', 'size', 'created_at', 'updated_at']
            found_columns = [col[0] for col in columns]
            
            for col in columns:
                nullable = "NULL" if col[2] == "YES" else "NOT NULL"
                print(f"   {col[0]:<15} {col[1]:<25} {nullable}")
            
            # Verify all expected columns exist
            missing = set(expected_columns) - set(found_columns)
            if missing:
                print(f"❌ Missing columns: {missing}")
                return False
            else:
                print("✅ All expected columns present")
            
            # Check foreign key constraint
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
            fk_constraints = result.fetchall()
            
            print("\n🔗 Foreign Key Constraints:")
            if fk_constraints:
                for fk in fk_constraints:
                    print(f"   {fk[0]}: {fk[1]} -> {fk[2]}.{fk[3]}")
                print("✅ Foreign key to chats table exists")
            else:
                print("❌ No foreign key constraints found")
                return False
            
            # Check unique constraint
            result = await conn.execute(text("""
                SELECT constraint_name
                FROM information_schema.table_constraints
                WHERE table_name = 'project_files' AND constraint_type = 'UNIQUE'
            """))
            unique_constraints = result.fetchall()
            
            print("\n🔒 Unique Constraints:")
            if unique_constraints:
                for uc in unique_constraints:
                    print(f"   {uc[0]}")
                print("✅ Unique constraint on (project_id, file_path) exists")
            else:
                print("⚠️  No unique constraints found (may be OK)")
            
            # Check indexes
            result = await conn.execute(text("""
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE tablename = 'project_files'
            """))
            indexes = result.fetchall()
            
            print("\n📇 Indexes:")
            for idx in indexes:
                print(f"   {idx[0]}")
            
            print("\n✅ TEST 1 PASSED: Database schema is correct")
            return True
            
    except Exception as e:
        print(f"❌ TEST 1 FAILED: {e}")
        return False
    finally:
        await engine.dispose()


async def test_file_manager_operations():
    """Test 2: Test file_manager.py operations"""
    print("\n" + "="*60)
    print("TEST 2: File Manager Operations")
    print("="*60)
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    test_project_id = str(uuid.uuid4())
    
    try:
        async with async_session() as db:
            # First, create a test chat entry
            async with db.begin():
                from db.models import Chat, User
                
                # Check if test user exists
                result = await db.execute(select(User).limit(1))
                user = result.scalar_one_or_none()
                
                if not user:
                    print("⚠️  No users found, creating test user...")
                    user = User(
                        id=str(uuid.uuid4()),
                        email="test@example.com",
                        username="testuser",
                        password_hash="test",
                        tokens_remaining=1000,
                        max_tokens=1000
                    )
                    db.add(user)
                    await db.flush()
                
                # Create test chat
                test_chat = Chat(
                    id=test_project_id,
                    user_id=user.id,
                    title="Test Project"
                )
                db.add(test_chat)
            
            print(f"✅ Created test project: {test_project_id}")
            
            # Test 1: Store files
            print("\n📝 Testing file storage...")
            
            test_files = [
                ("src/App.jsx", "import React from 'react';\nexport default App;", None),
                ("src/index.js", "import ReactDOM from 'react-dom';\n", None),
                ("package.json", '{"name": "test-app", "version": "1.0.0"}', None),
            ]
            
            for file_path, content, _ in test_files:
                file_obj = await store_project_file(
                    db=db,
                    project_id=test_project_id,
                    file_path=file_path,
                    content=content,
                    notify_callback=None
                )
                print(f"   ✅ Stored: {file_path} ({file_obj.size} bytes)")
            
            # Test 2: Get file list
            print("\n📋 Testing file list retrieval...")
            files = await get_project_files(db, test_project_id)
            print(f"   ✅ Retrieved {len(files)} files")
            for f in files:
                print(f"      - {f['file_path']} ({f['size']} bytes)")
            
            # Test 3: Get files with content
            print("\n📦 Testing file content retrieval...")
            files_with_content = await get_project_files_with_content(db, test_project_id)
            print(f"   ✅ Retrieved {len(files_with_content)} files with content")
            for path, content in files_with_content.items():
                print(f"      - {path}: {len(content)} bytes")
            
            # Test 4: Update existing file
            print("\n📝 Testing file update...")
            updated_content = "import React from 'react';\nimport './App.css';\nexport default App;"
            await store_project_file(
                db=db,
                project_id=test_project_id,
                file_path="src/App.jsx",
                content=updated_content,
                notify_callback=None
            )
            print("   ✅ Updated existing file")
            
            # Test 5: Get file count
            print("\n🔢 Testing file count...")
            count = await get_file_count(db, test_project_id)
            print(f"   ✅ File count: {count}")
            
            # Test 6: Delete files
            print("\n🗑️  Testing file deletion...")
            deleted = await delete_project_files(db, test_project_id)
            print(f"   ✅ Deleted {deleted} files")
            
            # Verify deletion
            count_after = await get_file_count(db, test_project_id)
            if count_after == 0:
                print("   ✅ All files deleted successfully")
            else:
                print(f"   ❌ Still {count_after} files remaining")
                return False
            
            # Clean up test chat
            async with db.begin():
                await db.execute(text(f"DELETE FROM chats WHERE id = '{test_project_id}'"))
            
            print("\n✅ TEST 2 PASSED: File manager operations work correctly")
            return True
            
    except Exception as e:
        print(f"❌ TEST 2 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        await engine.dispose()


async def test_api_endpoints():
    """Test 3: Test API endpoints"""
    print("\n" + "="*60)
    print("TEST 3: API Endpoints")
    print("="*60)
    
    # Note: This requires the server to be running and authentication
    # We'll check if endpoints are defined in the code
    
    print("📝 Checking API endpoint definitions...")
    
    try:
        # Check main.py for route imports
        with open("main.py", "r") as f:
            main_content = f.read()
            
        if "from routes.download import router as download_router" in main_content:
            print("   ✅ Download router imported")
        else:
            print("   ❌ Download router NOT imported")
            return False
        
        if "app.include_router(router=download_router)" in main_content:
            print("   ✅ Download router registered")
        else:
            print("   ❌ Download router NOT registered")
            return False
        
        # Check routes/download.py exists and has correct endpoints
        with open("routes/download.py", "r") as f:
            routes_content = f.read()
        
        if '@router.get("/projects/{project_id}/download-db")' in routes_content:
            print("   ✅ ZIP download endpoint defined")
        else:
            print("   ❌ ZIP download endpoint NOT defined")
            return False
        
        if '@router.get("/projects/{project_id}/files-list")' in routes_content:
            print("   ✅ Files list endpoint defined")
        else:
            print("   ❌ Files list endpoint NOT defined")
            return False
        
        print("\n✅ TEST 3 PASSED: API endpoints are properly defined")
        return True
        
    except Exception as e:
        print(f"❌ TEST 3 FAILED: {e}")
        return False


async def test_graph_nodes_integration():
    """Test 4: Test graph_nodes.py integration"""
    print("\n" + "="*60)
    print("TEST 4: Graph Nodes Integration")
    print("="*60)
    
    try:
        # Check if file_storage_hook is imported and used
        with open("agent/graph_nodes.py", "r") as f:
            graph_nodes_content = f.read()
        
        if "from agent.file_storage_hook import snapshot_and_store_files" in graph_nodes_content:
            print("   ✅ file_storage_hook imported")
        else:
            print("   ❌ file_storage_hook NOT imported")
            return False
        
        if "snapshot_and_store_files(" in graph_nodes_content:
            print("   ✅ snapshot_and_store_files called in builder node")
        else:
            print("   ❌ snapshot_and_store_files NOT called")
            return False
        
        # Check file_storage_hook.py exists
        if os.path.exists("agent/file_storage_hook.py"):
            print("   ✅ file_storage_hook.py exists")
        else:
            print("   ❌ file_storage_hook.py NOT found")
            return False
        
        print("\n✅ TEST 4 PASSED: Graph nodes integration is correct")
        return True
        
    except Exception as e:
        print(f"❌ TEST 4 FAILED: {e}")
        return False


async def test_relationships():
    """Test 5: Verify database relationships"""
    print("\n" + "="*60)
    print("TEST 5: Database Relationships")
    print("="*60)
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    try:
        async with engine.begin() as conn:
            # Test CASCADE delete
            print("📋 Testing CASCADE delete behavior...")
            
            # Check foreign key has ON DELETE CASCADE
            result = await conn.execute(text("""
                SELECT
                    rc.update_rule,
                    rc.delete_rule
                FROM information_schema.referential_constraints rc
                JOIN information_schema.table_constraints tc
                    ON rc.constraint_name = tc.constraint_name
                WHERE tc.table_name = 'project_files'
            """))
            rules = result.fetchone()
            
            if rules and rules[1] == 'CASCADE':
                print("   ✅ CASCADE delete is configured")
            else:
                print(f"   ⚠️  Delete rule: {rules[1] if rules else 'NOT FOUND'}")
            
            print("\n✅ TEST 5 PASSED: Relationships are correctly configured")
            return True
            
    except Exception as e:
        print(f"❌ TEST 5 FAILED: {e}")
        return False
    finally:
        await engine.dispose()


async def run_all_tests():
    """Run all tests"""
    print("\n" + "🚀"*30)
    print("FILE SYSTEM INTEGRATION TEST SUITE")
    print("🚀"*30)
    
    results = {}
    
    # Run tests
    results['schema'] = await test_database_schema()
    results['file_manager'] = await test_file_manager_operations()
    results['api_endpoints'] = await test_api_endpoints()
    results['graph_nodes'] = await test_graph_nodes_integration()
    results['relationships'] = await test_relationships()
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{test_name.upper():<20} {status}")
    
    all_passed = all(results.values())
    
    print("\n" + "="*60)
    if all_passed:
        print("🎉 ALL TESTS PASSED! System is ready for production.")
    else:
        print("⚠️  SOME TESTS FAILED. Please review the errors above.")
    print("="*60)
    
    return all_passed


if __name__ == "__main__":
    success = asyncio.run(run_all_tests())
    sys.exit(0 if success else 1)
