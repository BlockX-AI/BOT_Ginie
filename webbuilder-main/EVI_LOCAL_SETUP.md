# 🚀 EVI Local Setup Guide

Complete step-by-step guide to run this AI-powered web builder locally with "evi" branding.

---

## 📊 System Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    EVI System                        │
│                                                      │
│  ┌────────────┐         ┌──────────────┐           │
│  │  Frontend  │ ◄─────► │   Backend    │           │
│  │ (Next.js)  │         │  (FastAPI)   │           │
│  │ Port 3000  │         │  Port 8000   │           │
│  └────────────┘         └───────┬──────┘           │
│                                 │                    │
│                         ┌───────▼─────────┐         │
│                         │  PostgreSQL DB  │         │
│                         │   Port 5432     │         │
│                         └───────┬─────────┘         │
│                                 │                    │
│          ┌──────────────────────┼─────────────────┐ │
│          │                      │                 │ │
│    ┌─────▼─────┐      ┌────────▼────┐   ┌───────▼──┐
│    │ LangGraph │      │ E2B Sandbox │   │  Google  │
│    │  Agents   │      │  (React)    │   │  Gemini  │
│    └───────────┘      └─────────────┘   └──────────┘
└─────────────────────────────────────────────────────┘
```

---

## 🔑 Required Environment Variables

### **1. Database Configuration**
```env
DATABASE_URL=postgresql+asyncpg://evi_user:evi_password@localhost:5432/evi_db
```

**What it does:** Connects to PostgreSQL database for storing users, projects, and contracts.

---

### **2. Authentication & Security**
```env
SECRET_KEY=your-secret-key-here
```

**How to generate:**
```bash
# Method 1: Using OpenSSL
openssl rand -hex 32

# Method 2: Using Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**What it does:** Used for JWT token generation and password hashing.

---

### **3. E2B Sandbox (REQUIRED)**
```env
E2B_API_KEY=your-e2b-api-key
```

**How to get:**
1. Go to https://e2b.dev
2. Sign up for a free account
3. Navigate to Settings → API Keys
4. Copy your API key

**What it does:** Creates isolated sandboxes to run generated React applications safely.

**Template ID:** `9jwfe1bxhxidt50x0a6o` (pre-configured with Node.js + React)

**Cost:** Free tier includes 100 hours/month of sandbox time.

---

### **4. LLM Provider (Choose at least ONE)**

#### **Option A: Google Gemini (Recommended - FREE tier available)**
```env
GOOGLE_API_KEY=your-google-api-key
```

**How to get:**
1. Go to https://makersuite.google.com/app/apikey
2. Sign in with Google account
3. Click "Create API Key"
4. Copy the key

**What it does:** Powers the AI agents that generate code. Uses:
- `gemini-2.5-pro` for complex planning
- `gemini-2.5-flash` for faster operations

**Cost:** Free tier: 15 RPM (requests per minute), 1 million tokens/month

---

#### **Option B: Anthropic Claude (Optional - Better quality)**
```env
ANTHROPIC_API_KEY=your-anthropic-key
```

**How to get:**
1. Go to https://console.anthropic.com/
2. Sign up for account
3. Add payment method (required)
4. Navigate to API Keys
5. Create new key

**What it does:** Alternative LLM provider, used for `claude-sonnet-4-5` model.

**Cost:** Pay-as-you-go starting at $3/$15 per million tokens.

---

#### **Option C: OpenAI (Optional)**
```env
OPENAI_API_KEY=sk-...
```

**How to get:**
1. Go to https://platform.openai.com/api-keys
2. Sign up and add payment
3. Create new API key

**Cost:** GPT-4: $30/$60 per million tokens, GPT-3.5: $0.50/$1.50

---

#### **Option D: HuggingFace (Optional - Open source models)**
```env
HUGGINGFACE_API_KEY=hf_...
```

**How to get:**
1. Go to https://huggingface.co/settings/tokens
2. Create new token

**Cost:** Free for most models, inference endpoints have costs.

---

### **5. Smart Contract Integration (Optional)**

No API key needed! Uses AcademicChain public API:
```
Base URL: https://evi-v4-production.up.railway.app
```

**What it does:** Generates and deploys Solidity smart contracts for DApps.

---

## 📦 Prerequisites Checklist

### Required Software

- [ ] **Python 3.12+**
  ```bash
  python3 --version  # Should show 3.12 or higher
  ```

- [ ] **Node.js 18+**
  ```bash
  node --version     # Should show v18 or higher
  ```

- [ ] **PostgreSQL 14+**
  ```bash
  psql --version     # Should show 14 or higher
  ```

- [ ] **Git**
  ```bash
  git --version
  ```

---

## 🛠️ Step-by-Step Setup

### **Step 1: Install Prerequisites**

#### macOS
```bash
# Install Homebrew if not installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install required software
brew install python@3.12 node postgresql
brew services start postgresql
```

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install -y python3.12 python3-pip nodejs npm postgresql
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### Windows (WSL2 recommended)
```powershell
# Install WSL2 first, then follow Ubuntu instructions
wsl --install
```

---

### **Step 2: Navigate to Project**
```bash
cd /Users/satyamsinghal/Downloads/webbuilder-main
```

---

### **Step 3: Create PostgreSQL Database**

```bash
# Method 1: Using createdb command
createdb evi_db

# Method 2: Using psql
psql postgres
```

Then in psql:
```sql
CREATE DATABASE evi_db;
CREATE USER evi_user WITH PASSWORD 'evi_password';
GRANT ALL PRIVILEGES ON DATABASE evi_db TO evi_user;
\q
```

**Verify connection:**
```bash
psql -U evi_user -d evi_db -h localhost
# If it connects, you're good!
```

---

### **Step 4: Configure Environment Variables**

```bash
# Create .env file
cp .env.example .env

# Edit with your favorite editor
nano .env  # or vim, vscode, etc.
```

**Paste this configuration:**
```env
# Database
DATABASE_URL=postgresql+asyncpg://evi_user:evi_password@localhost:5432/evi_db

# Authentication (generate with: openssl rand -hex 32)
SECRET_KEY=YOUR_GENERATED_SECRET_HERE

# E2B Sandbox (REQUIRED)
E2B_API_KEY=YOUR_E2B_KEY_HERE

# Google Gemini (REQUIRED - at least one LLM)
GOOGLE_API_KEY=YOUR_GOOGLE_KEY_HERE

# Optional: Other LLM providers
# ANTHROPIC_API_KEY=your-anthropic-key
# OPENAI_API_KEY=your-openai-key
# HUGGINGFACE_API_KEY=your-huggingface-key

# Optional: Custom branding
APP_NAME=EVI
FRONTEND_BASE_URL=http://localhost:3000
```

**Save and exit** (Ctrl+X, Y, Enter in nano)

---

### **Step 5: Install Python Dependencies**

#### Option A: Using pip (Standard)
```bash
pip3 install -r requirements.txt
```

#### Option B: Using uv (Faster - Recommended)
```bash
# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies
uv sync
```

**Expected output:**
```
✓ Resolved XX packages in X.XXs
✓ Installed XX packages in X.XXs
```

---

### **Step 6: Run Database Migrations**

```bash
# This creates all required tables
alembic upgrade head
```

**Expected output:**
```
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade  -> 001, Initial schema
```

**Verify tables created:**
```bash
psql -U evi_user -d evi_db -c "\dt"
```

You should see:
```
           List of relations
 Schema |    Name    | Type  |   Owner   
--------+------------+-------+-----------
 public | chats      | table | evi_user
 public | contracts  | table | evi_user
 public | messages   | table | evi_user
 public | users      | table | evi_user
```

---

### **Step 7: Setup Frontend**

```bash
cd frontend

# Install dependencies
npm install

# Create frontend environment file
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
NEXT_PUBLIC_APP_NAME=EVI
EOF

cd ..
```

---

### **Step 8: Start Backend Server**

#### Terminal 1: Backend
```bash
# From project root
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Or with uv
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Expected output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [XXXXX] using WatchFiles
INFO:     Started server process [XXXXX]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

**Test backend:**
```bash
# In another terminal
curl http://localhost:8000/
# Should return: {"message":"Welome","status":"Healthy"}
```

**Access API docs:**
```
http://localhost:8000/docs
```

---

### **Step 9: Start Frontend Server**

#### Terminal 2: Frontend
```bash
cd frontend
npm run dev
```

**Expected output:**
```
▲ Next.js 16.0.0
- Local:        http://localhost:3000
- Network:      http://192.168.x.x:3000

✓ Starting...
✓ Ready in X.XXs
```

**Access frontend:**
```
http://localhost:3000
```

---

## ✅ Verification Checklist

### Backend Health Checks

1. **API Health:**
   ```bash
   curl http://localhost:8000/
   # Expected: {"message":"Welome","status":"Healthy"}
   ```

2. **API Documentation:**
   ```bash
   open http://localhost:8000/docs
   # Should show Swagger UI
   ```

3. **Database Connection:**
   ```bash
   psql -U evi_user -d evi_db -c "SELECT COUNT(*) FROM users;"
   # Should return 0 (or number of users)
   ```

### Frontend Health Checks

1. **Frontend loads:**
   ```bash
   open http://localhost:3000
   # Should show EVI landing page
   ```

2. **No console errors:**
   - Open browser DevTools (F12)
   - Check Console tab
   - Should have no red errors

### End-to-End Test

1. **Sign Up:**
   - Go to http://localhost:3000
   - Click "Sign Up"
   - Enter: `test@evi.local` / `password123` / `Test User`
   - Submit

2. **Login:**
   - Login with same credentials
   - Should redirect to dashboard

3. **Create Project:**
   - Click "New Project"
   - Enter prompt: `Create a simple counter app`
   - Watch real-time progress in WebSocket messages

4. **View Generated App:**
   - Wait 2-5 minutes for completion
   - Should show file tree
   - Should show live preview

---

## 🎯 Using EVI Locally

### Creating Web Apps

**Simple Example:**
```
Prompt: "Create a todo list app with add, delete, and mark complete"
Time: 2-3 minutes
Output: Working React todo app
```

**Complex Example:**
```
Prompt: "Create a weather dashboard with current conditions, 5-day forecast, and search by city"
Time: 4-6 minutes
Output: Full weather app with API integration
```

### Creating DApps (Smart Contracts)

**Via API:**
```bash
# 1. Login to get token
TOKEN=$(curl -X POST http://localhost:8000/auth/login \
  -d "username=test@evi.local&password=password123" \
  | jq -r '.access_token')

# 2. Create DApp
curl -X POST http://localhost:8000/dapp/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create an ERC20 token with 1 million supply",
    "network": "sepolia"
  }'
```

**Via Frontend:**
1. Login to EVI
2. Click "Create DApp" (not just "Create Project")
3. Enter: `Create an NFT collection with minting`
4. Wait 5-10 minutes
5. Get deployed contract + Web3 UI

---

## 🐛 Common Issues & Solutions

### Issue: "Module not found: httpx"
```bash
pip install httpx
# or
uv pip install httpx
```

### Issue: "Database connection failed"
```bash
# Check PostgreSQL is running
brew services list  # macOS
systemctl status postgresql  # Linux

# Verify credentials
psql -U evi_user -d evi_db -h localhost
```

### Issue: "GOOGLE_API_KEY not found"
```bash
# Check .env file exists and has the key
cat .env | grep GOOGLE_API_KEY

# Make sure .env is in project root
ls -la .env
```

### Issue: "E2B sandbox timeout"
```bash
# Check E2B API key is valid
curl https://api.e2b.dev/health

# Verify you have quota left
# Check E2B dashboard: https://e2b.dev/dashboard
```

### Issue: "Port 8000 already in use"
```bash
# Find process using port
lsof -i:8000

# Kill it
kill -9 <PID>

# Or use different port
uvicorn main:app --port 8001
```

### Issue: "Frontend can't connect to backend"
```bash
# Check backend is running
curl http://localhost:8000/

# Check frontend .env.local
cat frontend/.env.local

# Verify CORS settings in main.py includes localhost:3000
```

### Issue: "WebSocket disconnects immediately"
- Check JWT token is valid (not expired)
- Verify WebSocket URL: `ws://localhost:8000` (not `wss://`)
- Check browser console for errors

---

## 📊 System Requirements

### Minimum
- **CPU:** 2 cores
- **RAM:** 4GB
- **Disk:** 10GB free
- **Internet:** Broadband (for API calls)

### Recommended
- **CPU:** 4+ cores
- **RAM:** 8GB+
- **Disk:** 20GB+ SSD
- **Internet:** Fiber/high-speed

---

## 🔐 Security Notes

### Development Mode
- Backend runs on `0.0.0.0:8000` (all interfaces)
- Frontend runs on `localhost:3000`
- CORS allows `localhost:3000`
- JWT tokens expire in 30 days

### Production Considerations
- Change `SECRET_KEY` to production value
- Use HTTPS (not HTTP)
- Restrict CORS to production domain
- Set up rate limiting
- Use environment-specific configs

---

## 💰 Cost Breakdown (Free Tier)

| Service | Free Tier | Paid After |
|---------|-----------|------------|
| **PostgreSQL** | Unlimited (self-hosted) | N/A |
| **E2B Sandboxes** | 100 hours/month | $0.10/hour |
| **Google Gemini** | 15 RPM, 1M tokens/month | $0.001/1K tokens |
| **AcademicChain** | Testnet (free) | Mainnet (gas fees) |
| **Total/month** | **$0** | ~$5-20 typical usage |

---

## 📈 Performance Expectations

| Operation | Time |
|-----------|------|
| Backend startup | 5-10s |
| Frontend startup | 10-20s |
| User signup/login | < 500ms |
| Simple web app | 2-3 min |
| Complex web app | 4-6 min |
| Smart contract deployment | 1-2 min |
| Full DApp (contract + UI) | 5-10 min |

---

## 🎓 Next Steps

1. ✅ **Complete setup** - Follow all steps above
2. ✅ **Run tests** - `python3 test_api.py`
3. 🎨 **Customize branding** - Update frontend with EVI logo/colors
4. 🚀 **Build your first app** - Try the examples above
5. 📚 **Read docs** - `ARCHITECTURE.md`, `TESTING_GUIDE.md`
6. 🌐 **Deploy to production** - Follow `plan.md` for code69.xyz deployment

---

## 🆘 Getting Help

1. **Check logs:**
   ```bash
   # Backend logs (Terminal 1)
   # Frontend logs (Terminal 2)
   # Database logs: sudo tail -f /var/log/postgresql/postgresql-*.log
   ```

2. **Run diagnostics:**
   ```bash
   python3 test_api.py
   ```

3. **Review documentation:**
   - `README.md` - Overview
   - `TESTING_GUIDE.md` - Testing procedures
   - `ARCHITECTURE.md` - Technical details
   - `plan.md` - Deployment plan

---

## 🎉 Success Indicators

You know everything is working when:

✅ Backend responds at http://localhost:8000  
✅ Frontend loads at http://localhost:3000  
✅ Can create user account  
✅ Can login successfully  
✅ Can create a simple project  
✅ WebSocket shows real-time updates  
✅ Files appear in file tree  
✅ Preview shows working app  
✅ `test_api.py` passes all tests  

---

## 🚀 You're Ready!

Your EVI instance is now running locally. You can:

- ✨ Generate React apps from natural language
- ⛓️ Deploy smart contracts to testnets
- 🎨 Build full DApps with Web3 integration
- 📊 Track all projects in your dashboard
- 🔄 Iterate with AI-powered modifications

**Start building:** http://localhost:3000

**Happy coding! 🎉**
