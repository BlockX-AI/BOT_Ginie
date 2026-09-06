#!/usr/bin/env python3
"""
Comprehensive Test Suite for WebBuilder API
Tests authentication, project creation, and DApp building functionality
"""

import asyncio
import httpx
import json
import os
from dotenv import load_dotenv

load_dotenv()

BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "testpassword123"
TEST_NAME = "Test User"


class WebBuilderTester:
    def __init__(self):
        self.client = httpx.AsyncClient(base_url=BASE_URL, timeout=60.0)
        self.token = None
        self.user_id = None
        self.chat_id = None

    async def close(self):
        await self.client.aclose()

    async def test_health(self):
        """Test API health endpoint"""
        print("\n🔍 Testing Health Endpoint...")
        response = await self.client.get("/")
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Health check passed: {data}")
        return data

    async def test_signup(self):
        """Test user signup"""
        print("\n📝 Testing User Signup...")
        response = await self.client.post(
            "/auth/signup",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
                "name": TEST_NAME
            }
        )
        
        # User might already exist
        if response.status_code == 400:
            print("⚠️  User already exists, will test login instead")
            return None
        
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Signup successful: {data['email']}")
        return data

    async def test_login(self):
        """Test user login"""
        print("\n🔐 Testing User Login...")
        response = await self.client.post(
            "/auth/login",
            data={
                "username": TEST_EMAIL,
                "password": TEST_PASSWORD
            }
        )
        assert response.status_code == 200
        data = response.json()
        self.token = data["access_token"]
        print(f"✅ Login successful, token obtained")
        return data

    async def test_get_me(self):
        """Test get current user"""
        print("\n👤 Testing Get Current User...")
        response = await self.client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        assert response.status_code == 200
        data = response.json()
        self.user_id = data["id"]
        print(f"✅ User info retrieved: {data['email']}, Tokens: {data['tokens_remaining']}")
        return data

    async def test_create_project(self, prompt: str = "Create a beautiful todo list app with dark mode"):
        """Test project creation"""
        print(f"\n🚀 Testing Project Creation...")
        print(f"   Prompt: {prompt}")
        
        response = await self.client.post(
            "/chat",
            json={"prompt": prompt},
            headers={"Authorization": f"Bearer {self.token}"}
        )
        assert response.status_code == 200
        data = response.json()
        self.chat_id = data["chat_id"]
        print(f"✅ Project created: {self.chat_id}")
        print(f"   Title: {data.get('title', 'N/A')}")
        return data

    async def test_get_projects(self):
        """Test getting user projects"""
        print("\n📋 Testing Get Projects...")
        response = await self.client.get(
            "/projects",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Found {len(data)} project(s)")
        for project in data[:3]:  # Show first 3
            print(f"   - {project['title']} ({project['id']})")
        return data

    async def test_get_chat_messages(self):
        """Test getting chat messages"""
        if not self.chat_id:
            print("⚠️  No chat_id available, skipping message test")
            return None
        
        print(f"\n💬 Testing Get Chat Messages for {self.chat_id}...")
        response = await self.client.get(
            f"/chats/{self.chat_id}/messages",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Found {len(data.get('messages', []))} message(s)")
        return data

    async def test_get_project_files(self):
        """Test getting project files"""
        if not self.chat_id:
            print("⚠️  No chat_id available, skipping files test")
            return None
        
        print(f"\n📁 Testing Get Project Files...")
        response = await self.client.get(
            f"/projects/{self.chat_id}/files",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        
        # Files might not exist yet
        if response.status_code == 404:
            print("⚠️  No files found yet (project might be building)")
            return None
        
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Found {len(data.get('files', []))} file(s)")
        for file in data.get('files', [])[:5]:  # Show first 5
            print(f"   - {file}")
        return data

    async def run_basic_tests(self):
        """Run basic API tests"""
        print("\n" + "="*60)
        print("🧪 RUNNING BASIC API TESTS")
        print("="*60)
        
        try:
            # Test health
            await self.test_health()
            
            # Test authentication
            await self.test_signup()
            await self.test_login()
            await self.test_get_me()
            
            # Test projects
            await self.test_create_project()
            await self.test_get_projects()
            await self.test_get_chat_messages()
            
            # Wait a bit for file generation
            print("\n⏳ Waiting 5 seconds for project to initialize...")
            await asyncio.sleep(5)
            
            await self.test_get_project_files()
            
            print("\n" + "="*60)
            print("✅ ALL BASIC TESTS PASSED!")
            print("="*60)
            
        except AssertionError as e:
            print(f"\n❌ Test failed: {e}")
            raise
        except Exception as e:
            print(f"\n❌ Unexpected error: {e}")
            raise

    async def test_dapp_creation(self, prompt: str = "Create a simple ERC20 token contract"):
        """Test DApp creation (requires AcademicChain integration)"""
        print("\n" + "="*60)
        print("🧪 TESTING DAPP CREATION")
        print("="*60)
        
        print(f"\n🏗️  Creating DApp...")
        print(f"   Prompt: {prompt}")
        
        response = await self.client.post(
            "/dapp/create",
            json={
                "prompt": prompt,
                "network": "basecamp-testnet"
            },
            headers={"Authorization": f"Bearer {self.token}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ DApp creation started: {data.get('chat_id')}")
            print(f"   Connect to WebSocket to monitor progress")
            return data
        else:
            print(f"⚠️  DApp creation failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return None


async def main():
    """Main test runner"""
    tester = WebBuilderTester()
    
    try:
        # Run basic tests
        await tester.run_basic_tests()
        
        # Optionally test DApp creation
        print("\n" + "="*60)
        test_dapp = input("\n🤔 Do you want to test DApp creation? (y/n): ")
        if test_dapp.lower() == 'y':
            await tester.test_dapp_creation()
        
        print("\n🎉 All tests completed!")
        
    except Exception as e:
        print(f"\n❌ Test suite failed: {e}")
    finally:
        await tester.close()


if __name__ == "__main__":
    print("""
╔═══════════════════════════════════════════════════════════╗
║           WebBuilder API Test Suite                      ║
║  Comprehensive testing for authentication and projects    ║
╚═══════════════════════════════════════════════════════════╝
    """)
    
    asyncio.run(main())
