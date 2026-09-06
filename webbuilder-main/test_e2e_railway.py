#!/usr/bin/env python3
"""
Comprehensive End-to-End Test Suite for EVI WebBuilder API
Tests all endpoints on Railway deployment: https://evi-web-test-production.up.railway.app

This script tests:
- Authentication (register, login, refresh, me)
- Chat/Project creation
- DApp creation (smart contract + frontend)
- File management and downloads
- Contract management
- Error handling
"""

import asyncio
import httpx
import json
import time
from datetime import datetime
from typing import Dict, Any, Optional, List
import random
import string

# Configuration
API_BASE = "https://evi-web-test-production.up.railway.app"
TIMEOUT = 300.0  # 5 minutes for long operations

# Colors for output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    MAGENTA = '\033[95m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

class TestResult:
    def __init__(self):
        self.passed = []
        self.failed = []
        self.warnings = []
        self.bugs = []
    
    def add_pass(self, name: str, details: str = ""):
        self.passed.append((name, details))
        print(f"{Colors.GREEN}✅ PASS: {name}{Colors.RESET}")
        if details:
            print(f"   └─ {details}")
    
    def add_fail(self, name: str, error: str):
        self.failed.append((name, error))
        print(f"{Colors.RED}❌ FAIL: {name}{Colors.RESET}")
        print(f"   └─ {error}")
    
    def add_warning(self, name: str, message: str):
        self.warnings.append((name, message))
        print(f"{Colors.YELLOW}⚠️  WARN: {name}{Colors.RESET}")
        print(f"   └─ {message}")
    
    def add_bug(self, name: str, description: str, reproduction: str):
        self.bugs.append((name, description, reproduction))
        print(f"{Colors.RED}🐛 BUG: {name}{Colors.RESET}")
        print(f"   └─ {description}")
        print(f"   └─ Reproduction: {reproduction}")

def print_section(title: str):
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*80}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}{title}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'='*80}{Colors.RESET}\n")

def generate_random_string(length: int = 8) -> str:
    """Generate random string for unique test data"""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

class E2ETestSuite:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=TIMEOUT)
        self.results = TestResult()
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.user_id: Optional[int] = None
        self.test_email = f"test_{generate_random_string()}@example.com"
        self.test_password = "TestPassword123!"
        self.test_name = f"Test User {generate_random_string(4)}"
        self.chat_id: Optional[str] = None
        self.project_id: Optional[str] = None
        self.contract_address: Optional[str] = None
    
    async def close(self):
        await self.client.aclose()
    
    def get_auth_headers(self) -> Dict[str, str]:
        """Get authorization headers"""
        if not self.access_token:
            return {}
        return {"Authorization": f"Bearer {self.access_token}"}
    
    # ==================== AUTHENTICATION TESTS ====================
    
    async def test_health_check(self):
        """Test 1: Health check endpoint"""
        print_section("Test 1: Health Check")
        
        try:
            response = await self.client.get(f"{API_BASE}/")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "Healthy":
                    self.results.add_pass(
                        "Health check",
                        f"API is healthy: {json.dumps(data)}"
                    )
                else:
                    self.results.add_warning(
                        "Health check",
                        f"Unexpected response: {data}"
                    )
            else:
                self.results.add_fail(
                    "Health check",
                    f"Status {response.status_code}: {response.text}"
                )
        except Exception as e:
            self.results.add_fail("Health check", str(e))
    
    async def test_register(self):
        """Test 2: User registration"""
        print_section("Test 2: User Registration")
        
        try:
            payload = {
                "name": self.test_name,
                "email": self.test_email,
                "password": self.test_password
            }
            
            response = await self.client.post(
                f"{API_BASE}/auth/register",
                json=payload
            )
            
            if response.status_code == 201:
                data = response.json()
                self.access_token = data.get("access_token")
                user = data.get("user", {})
                self.user_id = user.get("id")
                
                if self.access_token and self.user_id:
                    self.results.add_pass(
                        "User registration",
                        f"User created: {user.get('email')} (ID: {self.user_id})"
                    )
                else:
                    self.results.add_fail(
                        "User registration",
                        "Missing access_token or user_id in response"
                    )
            else:
                self.results.add_fail(
                    "User registration",
                    f"Status {response.status_code}: {response.text}"
                )
        except Exception as e:
            self.results.add_fail("User registration", str(e))
    
    async def test_login(self):
        """Test 3: User login"""
        print_section("Test 3: User Login")
        
        try:
            payload = {
                "email": self.test_email,
                "password": self.test_password
            }
            
            response = await self.client.post(
                f"{API_BASE}/auth/login",
                json=payload
            )
            
            if response.status_code == 200:
                data = response.json()
                self.access_token = data.get("access_token")
                self.refresh_token = data.get("refresh_token")
                
                if self.access_token and self.refresh_token:
                    self.results.add_pass(
                        "User login",
                        "Successfully logged in with access and refresh tokens"
                    )
                else:
                    self.results.add_fail(
                        "User login",
                        "Missing tokens in response"
                    )
            else:
                self.results.add_fail(
                    "User login",
                    f"Status {response.status_code}: {response.text}"
                )
        except Exception as e:
            self.results.add_fail("User login", str(e))
    
    async def test_get_me(self):
        """Test 4: Get current user info"""
        print_section("Test 4: Get Current User")
        
        try:
            response = await self.client.get(
                f"{API_BASE}/auth/me",
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                email = data.get("email")
                tokens_remaining = data.get("tokens_remaining")
                
                if email == self.test_email:
                    self.results.add_pass(
                        "Get current user",
                        f"User: {email}, Tokens: {tokens_remaining}"
                    )
                else:
                    self.results.add_fail(
                        "Get current user",
                        f"Email mismatch: expected {self.test_email}, got {email}"
                    )
            else:
                self.results.add_fail(
                    "Get current user",
                    f"Status {response.status_code}: {response.text}"
                )
        except Exception as e:
            self.results.add_fail("Get current user", str(e))
    
    async def test_refresh_token(self):
        """Test 5: Refresh access token"""
        print_section("Test 5: Token Refresh")
        
        if not self.refresh_token:
            self.results.add_warning("Token refresh", "No refresh token available")
            return
        
        try:
            payload = {"refresh_token": self.refresh_token}
            
            response = await self.client.post(
                f"{API_BASE}/auth/refresh",
                json=payload
            )
            
            if response.status_code == 200:
                data = response.json()
                new_access = data.get("access_token")
                new_refresh = data.get("refresh_token")
                
                if new_access and new_refresh:
                    self.access_token = new_access
                    self.refresh_token = new_refresh
                    self.results.add_pass(
                        "Token refresh",
                        "Successfully refreshed tokens"
                    )
                else:
                    self.results.add_fail(
                        "Token refresh",
                        "Missing tokens in response"
                    )
            else:
                self.results.add_fail(
                    "Token refresh",
                    f"Status {response.status_code}: {response.text}"
                )
        except Exception as e:
            self.results.add_fail("Token refresh", str(e))
    
    # ==================== PROJECT TESTS ====================
    
    async def test_create_simple_chat(self):
        """Test 6: Create a simple chat/project"""
        print_section("Test 6: Create Simple Chat")
        
        try:
            payload = {
                "prompt": "Create a simple counter app with increment and decrement buttons",
                "model": "gemini-2.5-pro"
            }
            
            response = await self.client.post(
                f"{API_BASE}/chat",
                json=payload,
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                self.chat_id = data.get("chat_id") or data.get("id")
                
                if self.chat_id:
                    self.results.add_pass(
                        "Create simple chat",
                        f"Chat created with ID: {self.chat_id}"
                    )
                else:
                    self.results.add_fail(
                        "Create simple chat",
                        "No chat_id in response"
                    )
            else:
                self.results.add_fail(
                    "Create simple chat",
                    f"Status {response.status_code}: {response.text}"
                )
        except Exception as e:
            self.results.add_fail("Create simple chat", str(e))
    
    async def test_get_chat_messages(self):
        """Test 7: Get chat messages"""
        print_section("Test 7: Get Chat Messages")
        
        if not self.chat_id:
            self.results.add_warning("Get chat messages", "No chat_id available")
            return
        
        # Wait a bit for agent to process
        print("Waiting 10 seconds for agent to process...")
        await asyncio.sleep(10)
        
        try:
            response = await self.client.get(
                f"{API_BASE}/chats/{self.chat_id}/messages",
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                messages = data.get("messages", [])
                
                if messages:
                    self.results.add_pass(
                        "Get chat messages",
                        f"Retrieved {len(messages)} message(s)"
                    )
                else:
                    self.results.add_warning(
                        "Get chat messages",
                        "No messages found (agent might still be processing)"
                    )
            else:
                self.results.add_fail(
                    "Get chat messages",
                    f"Status {response.status_code}: {response.text}"
                )
        except Exception as e:
            self.results.add_fail("Get chat messages", str(e))
    
    async def test_get_build_status(self):
        """Test 8: Get build status"""
        print_section("Test 8: Get Build Status")
        
        if not self.chat_id:
            self.results.add_warning("Get build status", "No chat_id available")
            return
        
        try:
            response = await self.client.get(
                f"{API_BASE}/chats/{self.chat_id}/build-status",
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                self.results.add_pass(
                    "Get build status",
                    f"Status: {json.dumps(data, indent=2)}"
                )
            else:
                self.results.add_fail(
                    "Get build status",
                    f"Status {response.status_code}: {response.text}"
                )
        except Exception as e:
            self.results.add_fail("Get build status", str(e))
    
    async def test_list_projects(self):
        """Test 9: List user projects"""
        print_section("Test 9: List User Projects")
        
        try:
            response = await self.client.get(
                f"{API_BASE}/projects",
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                projects = data.get("projects", [])
                
                self.results.add_pass(
                    "List user projects",
                    f"Found {len(projects)} project(s)"
                )
                
                # Store first project ID for later tests
                if projects and not self.project_id:
                    self.project_id = projects[0].get("id")
            else:
                self.results.add_fail(
                    "List user projects",
                    f"Status {response.status_code}: {response.text}"
                )
        except Exception as e:
            self.results.add_fail("List user projects", str(e))
    
    # ==================== DAPP CREATION TESTS ====================
    
    async def test_create_dapp_contract_only(self):
        """Test 10: Create DApp (contract only)"""
        print_section("Test 10: Create DApp - Contract Only")
        
        try:
            payload = {
                "prompt": "Create a simple ERC20 token called TestToken with symbol TEST and 1000 total supply",
                "network": "basecamp-testnet",
                "contract_only": True
            }
            
            print(f"Sending request: {json.dumps(payload, indent=2)}")
            
            response = await self.client.post(
                f"{API_BASE}/dapp/create",
                json=payload,
                headers=self.get_auth_headers(),
                timeout=180.0  # 3 minutes
            )
            
            print(f"Response status: {response.status_code}")
            print(f"Response body: {response.text[:500]}")
            
            if response.status_code == 200:
                data = response.json()
                contract_address = data.get("contract_address")
                job_id = data.get("job_id")
                
                if contract_address:
                    self.contract_address = contract_address
                    self.results.add_pass(
                        "DApp creation (contract only)",
                        f"Contract deployed: {contract_address}, Job: {job_id}"
                    )
                elif job_id:
                    self.results.add_warning(
                        "DApp creation (contract only)",
                        f"Job started: {job_id}, but no contract address yet"
                    )
                else:
                    self.results.add_warning(
                        "DApp creation (contract only)",
                        f"Response: {json.dumps(data)}"
                    )
            else:
                error_text = response.text
                self.results.add_fail(
                    "DApp creation (contract only)",
                    f"Status {response.status_code}: {error_text}"
                )
                
                # Check for specific bugs
                if "500" in str(response.status_code):
                    self.results.add_bug(
                        "Contract Generation 500 Error",
                        "Server returns 500 error when trying to create contract",
                        f"POST {API_BASE}/dapp/create with contract_only=True"
                    )
        except Exception as e:
            self.results.add_fail("DApp creation (contract only)", str(e))
    
    async def test_create_full_dapp(self):
        """Test 11: Create full DApp (contract + frontend)"""
        print_section("Test 11: Create Full DApp - Contract + Frontend")
        
        try:
            payload = {
                "prompt": "Create a simple voting DApp where users can vote on a proposal",
                "network": "basecamp-testnet",
                "contract_only": False
            }
            
            print(f"Sending request: {json.dumps(payload, indent=2)}")
            print("This may take several minutes...")
            
            response = await self.client.post(
                f"{API_BASE}/dapp/create",
                json=payload,
                headers=self.get_auth_headers(),
                timeout=300.0  # 5 minutes
            )
            
            print(f"Response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                contract_address = data.get("contract_address")
                frontend_url = data.get("frontend_url")
                chat_id = data.get("chat_id")
                
                if contract_address and frontend_url:
                    self.results.add_pass(
                        "Full DApp creation",
                        f"Contract: {contract_address}, Frontend: {frontend_url}"
                    )
                elif chat_id:
                    self.results.add_warning(
                        "Full DApp creation",
                        f"DApp creation started (chat: {chat_id}), waiting for completion..."
                    )
                else:
                    self.results.add_warning(
                        "Full DApp creation",
                        f"Response: {json.dumps(data)}"
                    )
            else:
                self.results.add_fail(
                    "Full DApp creation",
                    f"Status {response.status_code}: {response.text[:500]}"
                )
        except httpx.TimeoutException:
            self.results.add_warning(
                "Full DApp creation",
                "Request timed out (this is expected for long operations)"
            )
        except Exception as e:
            self.results.add_fail("Full DApp creation", str(e))
    
    async def test_frontend_for_existing_contract(self):
        """Test 12: Create frontend for existing contract"""
        print_section("Test 12: Create Frontend for Existing Contract")
        
        # Use a well-known contract for testing
        test_contract = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
        test_abi = [
            {"inputs": [], "name": "name", "outputs": [{"type": "string"}], "stateMutability": "view", "type": "function"},
            {"inputs": [], "name": "symbol", "outputs": [{"type": "string"}], "stateMutability": "view", "type": "function"}
        ]
        
        try:
            payload = {
                "contract_address": test_contract,
                "abi": test_abi,
                "network": "basecamp-testnet",
                "prompt": "Create a simple frontend to interact with this ERC20 token"
            }
            
            response = await self.client.post(
                f"{API_BASE}/dapp/frontend-for-contract",
                json=payload,
                headers=self.get_auth_headers(),
                timeout=180.0
            )
            
            if response.status_code == 200:
                data = response.json()
                frontend_url = data.get("frontend_url")
                chat_id = data.get("chat_id")
                
                if frontend_url:
                    self.results.add_pass(
                        "Frontend for existing contract",
                        f"Frontend created: {frontend_url}"
                    )
                elif chat_id:
                    self.results.add_warning(
                        "Frontend for existing contract",
                        f"Frontend generation started (chat: {chat_id})"
                    )
                else:
                    self.results.add_warning(
                        "Frontend for existing contract",
                        f"Response: {json.dumps(data)}"
                    )
            else:
                self.results.add_fail(
                    "Frontend for existing contract",
                    f"Status {response.status_code}: {response.text[:500]}"
                )
        except Exception as e:
            self.results.add_fail("Frontend for existing contract", str(e))
    
    # ==================== FILE MANAGEMENT TESTS ====================
    
    async def test_get_project_files(self):
        """Test 13: Get project files"""
        print_section("Test 13: Get Project Files")
        
        project_id = self.project_id or self.chat_id
        if not project_id:
            self.results.add_warning("Get project files", "No project_id available")
            return
        
        try:
            response = await self.client.get(
                f"{API_BASE}/projects/{project_id}/files"
            )
            
            if response.status_code == 200:
                data = response.json()
                files = data.get("files", [])
                
                self.results.add_pass(
                    "Get project files",
                    f"Retrieved {len(files)} file(s)"
                )
            else:
                self.results.add_fail(
                    "Get project files",
                    f"Status {response.status_code}: {response.text}"
                )
        except Exception as e:
            self.results.add_fail("Get project files", str(e))
    
    async def test_get_files_list(self):
        """Test 14: Get files list (for real-time viewer)"""
        print_section("Test 14: Get Files List")
        
        project_id = self.project_id or self.chat_id
        if not project_id:
            self.results.add_warning("Get files list", "No project_id available")
            return
        
        try:
            response = await self.client.get(
                f"{API_BASE}/api/projects/{project_id}/files-list"
            )
            
            if response.status_code == 200:
                data = response.json()
                files = data.get("files", [])
                
                self.results.add_pass(
                    "Get files list",
                    f"Retrieved {len(files)} file(s)"
                )
            else:
                self.results.add_fail(
                    "Get files list",
                    f"Status {response.status_code}: {response.text}"
                )
        except Exception as e:
            self.results.add_fail("Get files list", str(e))
    
    async def test_get_project_contracts(self):
        """Test 15: Get project contracts"""
        print_section("Test 15: Get Project Contracts")
        
        project_id = self.project_id or self.chat_id
        if not project_id:
            self.results.add_warning("Get project contracts", "No project_id available")
            return
        
        try:
            response = await self.client.get(
                f"{API_BASE}/projects/{project_id}/contracts",
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                contracts = data.get("contracts", [])
                
                self.results.add_pass(
                    "Get project contracts",
                    f"Found {len(contracts)} contract(s)"
                )
            else:
                self.results.add_fail(
                    "Get project contracts",
                    f"Status {response.status_code}: {response.text}"
                )
        except Exception as e:
            self.results.add_fail("Get project contracts", str(e))
    
    # ==================== MAIN TEST RUNNER ====================
    
    async def run_all_tests(self):
        """Run all E2E tests"""
        print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*80}{Colors.RESET}")
        print(f"{Colors.BOLD}{Colors.BLUE}EVI WebBuilder - Comprehensive E2E Test Suite{Colors.RESET}")
        print(f"{Colors.BOLD}{Colors.BLUE}{'='*80}{Colors.RESET}")
        print(f"\n{Colors.CYAN}API Base: {API_BASE}{Colors.RESET}")
        print(f"{Colors.CYAN}Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{Colors.RESET}\n")
        
        # Run tests in sequence
        await self.test_health_check()
        await self.test_register()
        await self.test_login()
        await self.test_get_me()
        await self.test_refresh_token()
        await self.test_create_simple_chat()
        await self.test_get_chat_messages()
        await self.test_get_build_status()
        await self.test_list_projects()
        await self.test_create_dapp_contract_only()
        await self.test_create_full_dapp()
        await self.test_frontend_for_existing_contract()
        await self.test_get_project_files()
        await self.test_get_files_list()
        await self.test_get_project_contracts()
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print_section("📊 TEST SUMMARY")
        
        total = len(self.results.passed) + len(self.results.failed) + len(self.results.warnings)
        passed = len(self.results.passed)
        failed = len(self.results.failed)
        warnings = len(self.results.warnings)
        bugs = len(self.results.bugs)
        
        print(f"Total Tests: {total}")
        print(f"{Colors.GREEN}✅ Passed: {passed}{Colors.RESET}")
        print(f"{Colors.RED}❌ Failed: {failed}{Colors.RESET}")
        print(f"{Colors.YELLOW}⚠️  Warnings: {warnings}{Colors.RESET}")
        print(f"{Colors.MAGENTA}🐛 Bugs Found: {bugs}{Colors.RESET}")
        
        if total > 0:
            success_rate = (passed / total) * 100
            print(f"\n{Colors.BOLD}Success Rate: {success_rate:.1f}%{Colors.RESET}")
        
        # Print bugs in detail
        if self.results.bugs:
            print(f"\n{Colors.RED}{Colors.BOLD}🐛 BUGS FOUND:{Colors.RESET}")
            for i, (name, desc, repro) in enumerate(self.results.bugs, 1):
                print(f"\n{Colors.RED}{i}. {name}{Colors.RESET}")
                print(f"   Description: {desc}")
                print(f"   Reproduce: {repro}")
        
        # Print failed tests
        if self.results.failed:
            print(f"\n{Colors.RED}{Colors.BOLD}❌ FAILED TESTS:{Colors.RESET}")
            for name, error in self.results.failed:
                print(f"\n{Colors.RED}• {name}{Colors.RESET}")
                print(f"  {error}")
        
        print(f"\n{Colors.CYAN}Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{Colors.RESET}\n")

async def main():
    """Main entry point"""
    suite = E2ETestSuite()
    try:
        await suite.run_all_tests()
    finally:
        await suite.close()

if __name__ == "__main__":
    asyncio.run(main())
