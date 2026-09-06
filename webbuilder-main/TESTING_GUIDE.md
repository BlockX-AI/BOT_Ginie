# WebBuilder Testing Guide

Complete guide for testing the WebBuilder DApp platform locally and in production.

## Table of Contents

- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Setup Instructions](#setup-instructions)
- [Testing Backend](#testing-backend)
- [Testing Frontend](#testing-frontend)
- [Testing DApp Creation](#testing-dapp-creation)
- [Manual Testing Checklist](#manual-testing-checklist)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

```bash
# 1. Run automated setup
./setup.sh

# 2. Start backend
uvicorn main:app --reload

# 3. Start frontend (in new terminal)
cd frontend && npm run dev

# 4. Run automated tests
python3 test_api.py
```

---

## Prerequisites

### Required Software

- **Python 3.12+** - Backend runtime
- **Node.js 18+** - Frontend runtime
- **PostgreSQL 14+** - Database
- **Git** - Version control

### Required API Keys

1. **E2B API Key** - For sandboxed code execution
   - Sign up at https://e2b.dev
   - Create account and get API key
   - Template ID: `9jwfe1bxhxidt50x0a6o`

2. **LLM Provider Key** (at least one):
   - OpenAI: https://platform.openai.com/api-keys
   - Google Gemini: https://makersuite.google.com/app/apikey
   - Anthropic Claude: https://console.anthropic.com/
   - HuggingFace: https://huggingface.co/settings/tokens

3. **Database** - PostgreSQL instance
   - Local: Install PostgreSQL
   - Cloud: Supabase, Railway, Render, etc.

---

## Setup Instructions

### 1. Clone and Navigate

```bash
cd /path/to/webbuilder-main
```

### 2. Environment Configuration

Create `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/webbuilder

# Authentication (generate with: openssl rand -hex 32)
SECRET_KEY=your-secret-key-here

# E2B Sandbox
E2B_API_KEY=your-e2b-api-key

# LLM Providers (at least one required)
OPENAI_API_KEY=sk-...
# GOOGLE_API_KEY=...
# ANTHROPIC_API_KEY=...
# HUGGINGFACE_API_KEY=...
```

### 3. Database Setup

```bash
# Create database
createdb webbuilder

# Or in PostgreSQL shell:
# CREATE DATABASE webbuilder;

# Run migrations
alembic upgrade head
```

### 4. Install Dependencies

**Backend:**
```bash
# Using uv (recommended - faster)
uv sync

# Or using pip
pip install -r requirements.txt
```

**Frontend:**
```bash
cd frontend

# Create .env.local
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
EOF

# Install dependencies
npm install
```

---

## Testing Backend

### 1. Start Backend Server

```bash
# With auto-reload
uvicorn main:app --reload

# Or with uv
uv run uvicorn main:app --reload

# Check logs for:
# - "Application startup complete"
# - Database connection success
```

### 2. Test API Endpoints

**Health Check:**
```bash
curl http://localhost:8000/
# Expected: {"message":"Welome","status":"Healthy"}
```

**API Documentation:**
Open http://localhost:8000/docs in browser for interactive API docs.

### 3. Automated API Tests

```bash
# Run comprehensive test suite
python3 test_api.py

# This tests:
# - Health endpoint
# - User signup/login
# - Token authentication
# - Project creation
# - File management
# - Message history
```

**Expected Output:**
```
🧪 RUNNING BASIC API TESTS
==========================================================
🔍 Testing Health Endpoint...
✅ Health check passed: {'message': 'Welome', 'status': 'Healthy'}

📝 Testing User Signup...
✅ Signup successful: test@example.com

🔐 Testing User Login...
✅ Login successful, token obtained

👤 Testing Get Current User...
✅ User info retrieved: test@example.com, Tokens: 2

🚀 Testing Project Creation...
✅ Project created: abc-123-def

📋 Testing Get Projects...
✅ Found 1 project(s)

==========================================================
✅ ALL BASIC TESTS PASSED!
```

### 4. Manual API Testing

**Signup:**
```bash
curl -X POST http://localhost:8000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@example.com",
    "password": "demo123",
    "name": "Demo User"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:8000/auth/login \
  -d "username=demo@example.com&password=demo123"

# Save the access_token from response
TOKEN="eyJ..."
```

**Create Project:**
```bash
curl -X POST http://localhost:8000/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Create a todo list app"}'

# Save the chat_id from response
CHAT_ID="..."
```

**Get Project Files:**
```bash
curl http://localhost:8000/projects/$CHAT_ID/files \
  -H "Authorization: Bearer $TOKEN"
```

---

## Testing Frontend

### 1. Start Frontend Server

```bash
cd frontend
npm run dev

# Frontend should be at http://localhost:3000
```

### 2. Manual Frontend Tests

**Test Flow:**

1. **Landing Page** - http://localhost:3000
   - ✅ Page loads without errors
   - ✅ UI is responsive
   - ✅ Navigation works

2. **Sign Up** - Click "Sign Up" button
   - ✅ Form validation works
   - ✅ Can create account
   - ✅ Error messages show for invalid input

3. **Login**
   - ✅ Can login with credentials
   - ✅ Token is stored
   - ✅ Redirects to dashboard

4. **Dashboard**
   - ✅ Shows user info
   - ✅ Displays token count
   - ✅ Lists existing projects
   - ✅ Can create new project

5. **Project Creation**
   - ✅ Enter prompt (e.g., "Create a calculator app")
   - ✅ WebSocket connects
   - ✅ Real-time updates appear
   - ✅ File tree populates
   - ✅ Preview loads

6. **Code Viewer**
   - ✅ Can browse files
   - ✅ Syntax highlighting works
   - ✅ Can view different files

7. **Live Preview**
   - ✅ Preview iframe loads
   - ✅ App is functional
   - ✅ No console errors

---

## Testing DApp Creation

### Prerequisites
- Backend and frontend running
- Logged in user account
- Available tokens (check `/auth/me`)

### Test Case 1: Simple ERC20 Token

**Prompt:**
```
Create an ERC20 token contract:
- Name: MyToken
- Symbol: MTK
- Initial supply: 1,000,000
- Decimals: 18
```

**Expected Behavior:**
1. ✅ WebSocket shows "contract_generating"
2. ✅ Contract is generated and compiled
3. ✅ Contract deploys to testnet
4. ✅ ABI is retrieved
5. ✅ Frontend scaffolding created
6. ✅ Web3 libraries installed
7. ✅ Contract info saved
8. ✅ UI generated with wallet connect
9. ✅ Can interact with contract

**Via API:**
```bash
curl -X POST http://localhost:8000/dapp/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create an ERC20 token: MyToken (MTK), 1M supply",
    "network": "basecamp-testnet"
  }'
```

### Test Case 2: NFT Collection

**Prompt:**
```
Create an NFT minting DApp:
- Collection name: CoolPunks
- Symbol: PUNK
- Mint price: 0.01 ETH
- Max supply: 100
```

**Expected:**
- ✅ NFT contract deployed
- ✅ Minting UI created
- ✅ Wallet connection works
- ✅ Can mint NFT (on testnet)
- ✅ Gallery shows owned NFTs

### Test Case 3: Frontend for Existing Contract

```bash
curl -X POST http://localhost:8000/dapp/frontend-for-contract \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "contract_address": "0x...",
    "abi": [...],
    "network": "sepolia",
    "prompt": "Create a dashboard for this token"
  }'
```

---

## Manual Testing Checklist

### Backend Tests

- [ ] Health endpoint returns 200
- [ ] User signup works
- [ ] User login returns JWT token
- [ ] Protected endpoints require auth
- [ ] Rate limiting works (2 tokens per 24h)
- [ ] Token reset after 24 hours
- [ ] WebSocket connection works
- [ ] Chat messages persist to database
- [ ] Project files are created
- [ ] File download works
- [ ] Multiple users are isolated

### Frontend Tests

- [ ] App loads without errors
- [ ] Sign up form validation
- [ ] Login flow works
- [ ] Dashboard shows projects
- [ ] WebSocket reconnects on disconnect
- [ ] File tree updates in real-time
- [ ] Code viewer syntax highlighting
- [ ] Preview iframe loads
- [ ] Responsive on mobile
- [ ] Dark mode works (if implemented)

### DApp Tests

- [ ] Contract generation succeeds
- [ ] Compilation errors are fixed automatically
- [ ] Contract deploys to testnet
- [ ] ABI is correctly saved
- [ ] Frontend includes Web3 libraries
- [ ] Wallet connection UI appears
- [ ] Can switch networks
- [ ] Contract read functions work
- [ ] Contract write functions work
- [ ] Transaction status updates

### Integration Tests

- [ ] End-to-end DApp creation (< 10 min)
- [ ] Multiple DApps per user
- [ ] Contract info persists
- [ ] Project restoration after timeout
- [ ] WebSocket reconnection
- [ ] Error recovery mechanisms
- [ ] Token consumption tracked correctly

---

## Troubleshooting

### Backend Won't Start

**Error: "Could not connect to database"**
```bash
# Check PostgreSQL is running
pg_isready

# Check connection string
echo $DATABASE_URL

# Create database if missing
createdb webbuilder
```

**Error: "Module not found"**
```bash
# Reinstall dependencies
pip install -r requirements.txt

# Or with uv
uv sync
```

**Port 8000 already in use**
```bash
# Find process
lsof -i:8000

# Kill it
kill -9 <PID>

# Or use different port
uvicorn main:app --port 8001
```

### Frontend Issues

**Error: "Cannot connect to backend"**
- ✅ Check backend is running (http://localhost:8000)
- ✅ Verify `.env.local` has correct API URL
- ✅ Check CORS settings in `main.py`

**WebSocket disconnects immediately**
- ✅ Check JWT token is valid
- ✅ Verify WebSocket URL format: `ws://localhost:8000`
- ✅ Check browser console for errors

**Build errors**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Database Issues

**Migration fails**
```bash
# Reset database
alembic downgrade base
alembic upgrade head

# Or manual migration
psql $DATABASE_URL < migrations/add_contracts_table.sql
```

**Connection pool errors**
- ✅ Reduce `pool_size` in `db/base.py`
- ✅ Check database connection limits
- ✅ Close idle connections

### E2B Sandbox Issues

**Sandbox timeout**
- ✅ Check E2B_API_KEY is valid
- ✅ Verify template ID is correct
- ✅ Check E2B account quota

**Files not persisting**
- ✅ Check `projects/` directory exists
- ✅ Verify write permissions
- ✅ Check disk space

### DApp Creation Issues

**Contract deployment fails**
- ✅ Verify network is testnet (not mainnet)
- ✅ Check AcademicChain API is reachable
- ✅ Review contract prompt for errors

**Frontend doesn't include Web3**
- ✅ Check `e2b.Dockerfile` has Web3 libraries
- ✅ Verify agent tools are working
- ✅ Review WebSocket logs for errors

---

## Performance Testing

### Load Testing

```bash
# Install hey (HTTP load generator)
# brew install hey  # macOS
# apt install hey   # Ubuntu

# Test health endpoint
hey -n 1000 -c 10 http://localhost:8000/

# Test authenticated endpoint
hey -n 100 -c 5 \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/projects
```

### Expected Performance

- Health check: < 50ms
- Login: < 200ms
- Project creation: 2-5 minutes (depends on LLM)
- File retrieval: < 100ms
- WebSocket latency: < 50ms

---

## Continuous Integration

### GitHub Actions (Example)

```yaml
name: Test WebBuilder

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: webbuilder_test
    
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
        with:
          python-version: '3.12'
      
      - name: Install dependencies
        run: pip install -r requirements.txt
      
      - name: Run migrations
        env:
          DATABASE_URL: postgresql+asyncpg://postgres:postgres@localhost/webbuilder_test
        run: alembic upgrade head
      
      - name: Run tests
        env:
          DATABASE_URL: postgresql+asyncpg://postgres:postgres@localhost/webbuilder_test
          SECRET_KEY: test-secret-key
        run: python test_api.py
```

---

## Summary

✅ **Setup**: Use `./setup.sh` for automated setup  
✅ **Backend**: Test with `python3 test_api.py`  
✅ **Frontend**: Manual testing via browser  
✅ **DApp**: Test contract + frontend creation  
✅ **Troubleshoot**: Check logs and connection strings

For issues, check:
1. Environment variables (`.env`, `.env.local`)
2. API keys are valid
3. Database is running
4. Ports are available
5. Dependencies are installed

**Happy testing! 🧪**
