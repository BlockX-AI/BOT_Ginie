# 🚀 BOT Chain DApp Builder - Quick Start Guide

## Overview

This guide will help you get started with building the BOT Chain DApp Builder by integrating the three cloned repositories.

---

## 📋 Prerequisites Checklist

Before starting, ensure you have:

- [x] All three repositories cloned
- [ ] Node.js 18+ installed
- [ ] Python 3.10+ installed
- [ ] PostgreSQL 14+ installed
- [ ] Redis installed (optional for development)
- [ ] Git installed

### Verify Installations

```bash
# Check Node.js
node --version  # Should be 18+

# Check Python
python --version  # Should be 3.10+

# Check PostgreSQL
psql --version  # Should be 14+

# Check Redis (optional)
redis-cli --version
```

---

## 🔧 Step 1: Set Up Evi_Contract_Engine

### 1.1 Install Dependencies

```bash
cd Evi_Contract_Engine
npm install
```

### 1.2 Configure Environment

Create `.env` file:

```bash
# Copy example or create new
cat > .env << EOF
# Gemini AI (Required for contract generation)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash-exp

# Database (Optional - for job persistence)
DATABASE_URL=postgresql://user:password@localhost:5432/evi_contracts

# BOT Chain Configuration (Add this)
BOT_CHAIN_RPC_URL=https://rpc.botchain.ai
BOT_CHAIN_PRIVATE_KEY=your_private_key_for_testnet
BOT_CHAIN_EXPLORER_URL=https://explorer.botchain.ai

# Server Configuration
PORT=3001
NODE_ENV=development
EOF
```

### 1.3 Add BOT Chain Network to Hardhat

Edit `hardhat.config.js` and add BOT Chain network:

```javascript
// Add to networks section
botchain: {
  url: process.env.BOT_CHAIN_RPC_URL || "https://rpc.botchain.ai",
  chainId: 12345, // Replace with actual BOT Chain ID
  accounts: process.env.BOT_CHAIN_PRIVATE_KEY ? [process.env.BOT_CHAIN_PRIVATE_KEY] : [],
  gasPrice: "auto",
  timeout: 60000
},
botchainTestnet: {
  url: process.env.BOT_CHAIN_TESTNET_RPC_URL || "https://testnet-rpc.botchain.ai",
  chainId: 12346, // Replace with actual testnet chain ID
  accounts: process.env.BOT_CHAIN_PRIVATE_KEY ? [process.env.BOT_CHAIN_PRIVATE_KEY] : [],
  gasPrice: "auto",
  timeout: 60000
}
```

### 1.4 Test EVI Engine

```bash
# Start the server
npm start

# In another terminal, test the API
curl http://localhost:3001/
# Expected: API documentation or health check response

# Test contract generation (simple test)
curl -X POST http://localhost:3001/api/ai/pipeline \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a simple counter contract with increment and decrement functions",
    "network": "botchainTestnet",
    "maxIterations": 5
  }'
```

---

## 🔧 Step 2: Set Up Canton_Ginie

### 2.1 Install Daml SDK (Required for Canton contracts)

```bash
# Install Daml SDK
curl -sSL https://get.daml.com/ | sh

# Verify installation
daml version
```

### 2.2 Set Up Backend

```bash
cd ../Canton_Ginie/backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2.3 Configure Environment

Create `.env.ginie` file:

```bash
cat > .env.ginie << EOF
# LLM Providers (at least one required)
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key
GOOGLE_API_KEY=your_google_key

# Canton Configuration
CANTON_ENVIRONMENT=sandbox
CANTON_LEDGER_HOST=localhost
CANTON_LEDGER_PORT=6865

# Redis (Optional)
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0

# API Configuration
API_HOST=0.0.0.0
API_PORT=8001
LOG_LEVEL=INFO
EOF
```

### 2.4 Start Canton Sandbox (Optional for testing)

```bash
# In a new terminal
cd Canton_Ginie
daml sandbox --port 6865
```

### 2.5 Start Canton Ginie Backend

```bash
cd backend
python -m api.main
# Server should start on http://localhost:8001
```

### 2.6 Test Canton Ginie

```bash
# Test health endpoint
curl http://localhost:8001/api/v1/health

# Test contract generation
curl -X POST http://localhost:8001/api/v1/generate \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Create a simple bond contract between issuer and investor",
    "environment": "sandbox"
  }'
```

---

## 🔧 Step 3: Set Up WebBuilder

### 3.1 Set Up Backend

```bash
cd ../webbuilder-main

# Install Python dependencies
pip install -r requirements.txt
```

### 3.2 Set Up Database

```bash
# Create database
createdb webbuilder

# Run migrations
alembic upgrade head
```

### 3.3 Configure Environment

Create `.env` file:

```bash
cat > .env << EOF
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/webbuilder
DIRECT_URL=postgresql://user:password@localhost:5432/webbuilder

# Authentication
SECRET_KEY=your-secret-key-here-change-in-production

# E2B Sandbox
E2B_API_KEY=your_e2b_api_key

# LLM Providers (at least one required)
OPENAI_API_KEY=your_openai_key
GOOGLE_API_KEY=your_google_key
ANTHROPIC_API_KEY=your_anthropic_key

# EVI Integration (point to EVI engine)
EVI_API_BASE_URL=http://localhost:3001

# Server Configuration
API_HOST=0.0.0.0
API_PORT=8000
EOF
```

### 3.4 Start WebBuilder Backend

```bash
uvicorn main:app --reload --port 8000
# Server should start on http://localhost:8000
```

### 3.5 Set Up Frontend

```bash
# In a new terminal
cd webbuilder-main/frontend

# Install dependencies
npm install

# Create environment file
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
EOF

# Start frontend
npm run dev
# Frontend should start on http://localhost:3000
```

### 3.6 Test WebBuilder

```bash
# Test backend health
curl http://localhost:8000/

# Open frontend in browser
# Navigate to http://localhost:3000
```

---

## 🏗️ Step 4: Create Orchestrator Service

Now let's create the orchestration layer that ties everything together.

### 4.1 Create Orchestrator Directory

```bash
cd ..
mkdir orchestrator
cd orchestrator
```

### 4.2 Create Python Virtual Environment

```bash
python -m venv venv

# Activate
# Windows:
venv\Scripts\activate
# macOS/Linux:
# source venv/bin/activate
```

### 4.3 Install Dependencies

```bash
pip install fastapi uvicorn httpx websockets sqlalchemy psycopg2-binary redis python-jose[cryptography] passlib[bcrypt] python-multipart pydantic-settings
```

### 4.4 Create Orchestrator Service

Create `main.py`:

```python
from fastapi import FastAPI, WebSocket, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
import httpx
import asyncio
from typing import Optional, Dict, Any
import os
from pydantic import BaseModel

app = FastAPI(title="BOT Chain DApp Builder Orchestrator")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Service URLs
EVI_BASE_URL = os.getenv("EVI_API_BASE_URL", "http://localhost:3001")
CANTON_BASE_URL = os.getenv("CANTON_API_BASE_URL", "http://localhost:8001")
WEBBUILDER_BASE_URL = os.getenv("WEBBUILDER_API_BASE_URL", "http://localhost:8000")

class DAppRequest(BaseModel):
    prompt: str
    dapp_type: str  # "evm", "canton", "hybrid"
    network: str = "botchainTestnet"
    include_frontend: bool = True

@app.get("/")
async def root():
    return {
        "message": "BOT Chain DApp Builder Orchestrator",
        "status": "healthy",
        "services": {
            "evi": EVI_BASE_URL,
            "canton": CANTON_BASE_URL,
            "webbuilder": WEBBUILDER_BASE_URL
        }
    }

@app.get("/health")
async def health_check():
    """Check health of all services"""
    health_status = {}
    
    async with httpx.AsyncClient() as client:
        # Check EVI
        try:
            response = await client.get(f"{EVI_BASE_URL}/", timeout=5.0)
            health_status["evi"] = "healthy" if response.status_code == 200 else "unhealthy"
        except:
            health_status["evi"] = "unreachable"
        
        # Check Canton
        try:
            response = await client.get(f"{CANTON_BASE_URL}/api/v1/health", timeout=5.0)
            health_status["canton"] = "healthy" if response.status_code == 200 else "unhealthy"
        except:
            health_status["canton"] = "unreachable"
        
        # Check WebBuilder
        try:
            response = await client.get(f"{WEBBUILDER_BASE_URL}/", timeout=5.0)
            health_status["webbuilder"] = "healthy" if response.status_code == 200 else "unhealthy"
        except:
            health_status["webbuilder"] = "unreachable"
    
    all_healthy = all(status == "healthy" for status in health_status.values())
    
    return {
        "status": "healthy" if all_healthy else "degraded",
        "services": health_status
    }

@app.post("/dapp/create")
async def create_dapp(request: DAppRequest):
    """
    Create a complete DApp on BOT Chain
    Routes to appropriate service based on dapp_type
    """
    
    if request.dapp_type == "evm":
        # Route to EVI for EVM contracts
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{EVI_BASE_URL}/api/ai/pipeline",
                json={
                    "prompt": request.prompt,
                    "network": request.network,
                    "maxIterations": 11
                },
                timeout=300.0
            )
            job_data = response.json()
            
            return {
                "status": "success",
                "dapp_type": "evm",
                "job_id": job_data.get("jobId"),
                "message": "EVM contract generation started",
                "poll_url": f"/dapp/status/{job_data.get('jobId')}"
            }
    
    elif request.dapp_type == "canton":
        # Route to Canton Ginie
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{CANTON_BASE_URL}/api/v1/generate",
                json={
                    "description": request.prompt,
                    "environment": "sandbox"
                },
                timeout=300.0
            )
            job_data = response.json()
            
            return {
                "status": "success",
                "dapp_type": "canton",
                "job_id": job_data.get("job_id"),
                "message": "Canton contract generation started",
                "poll_url": f"/dapp/status/{job_data.get('job_id')}"
            }
    
    elif request.dapp_type == "hybrid":
        # Create both EVM and Canton contracts
        return {
            "status": "success",
            "dapp_type": "hybrid",
            "message": "Hybrid DApp creation not yet implemented",
            "note": "This will create both EVM and Canton contracts"
        }
    
    else:
        raise HTTPException(status_code=400, detail="Invalid dapp_type. Must be 'evm', 'canton', or 'hybrid'")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9000)
```

### 4.5 Start Orchestrator

```bash
python main.py
# Orchestrator should start on http://localhost:9000
```

### 4.6 Test Orchestrator

```bash
# Check health of all services
curl http://localhost:9000/health

# Create a test DApp
curl -X POST http://localhost:9000/dapp/create \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a simple ERC20 token called BOTToken with 1 million supply",
    "dapp_type": "evm",
    "network": "botchainTestnet",
    "include_frontend": true
  }'
```

---

## 📊 Step 5: Verify Everything is Working

### 5.1 Service Status Check

You should now have all services running:

```
✅ EVI Contract Engine:    http://localhost:3001
✅ Canton Ginie Backend:    http://localhost:8001
✅ WebBuilder Backend:      http://localhost:8000
✅ WebBuilder Frontend:     http://localhost:3000
✅ Orchestrator:            http://localhost:9000
✅ PostgreSQL:              localhost:5432
✅ Redis (optional):        localhost:6379
```

### 5.2 Test Complete Flow

```bash
# 1. Create an EVM DApp on BOT Chain
curl -X POST http://localhost:9000/dapp/create \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a voting contract where users can create proposals and vote",
    "dapp_type": "evm",
    "network": "botchainTestnet"
  }'

# Save the job_id from response

# 2. Check status
curl http://localhost:3001/api/job/{job_id}/status

# 3. Get results when complete
curl http://localhost:3001/api/artifacts?jobId={job_id}&include=all
```

---

## 🐛 Troubleshooting

### Common Issues

#### 1. Port Already in Use

```bash
# Find process using port
# Windows:
netstat -ano | findstr :3001

# Kill process
taskkill /PID <process_id> /F
```

#### 2. Database Connection Failed

```bash
# Check PostgreSQL is running
# Windows:
net start postgresql-x64-14

# Create database if missing
createdb webbuilder
createdb evi_contracts
```

#### 3. Module Not Found Errors

```bash
# Reinstall dependencies
pip install -r requirements.txt
npm install
```

#### 4. Gemini API Key Invalid

- Get a valid API key from https://makersuite.google.com/app/apikey
- Update `.env` file in Evi_Contract_Engine

#### 5. E2B Sandbox Timeout

- Sign up at https://e2b.dev
- Get API key from dashboard
- Update `.env` in webbuilder-main

---

## 📚 Next Steps

### 1. Configure BOT Chain Properly

- Get actual BOT Chain RPC URLs
- Get BOT Chain testnet tokens
- Update chain IDs in configuration
- Test deployment to BOT Chain testnet

### 2. Enhance Orchestrator

- Add WebSocket support for real-time updates
- Implement hybrid DApp creation
- Add error handling and retries
- Create unified database schema

### 3. Build Unified Frontend

- Create new Next.js app for BOT Chain DApp Builder
- Integrate with orchestrator API
- Add DApp type selector
- Show real-time progress

### 4. Add BOT Chain Specific Features

- AI agent integration
- DePIN templates
- Gas optimization
- Explorer integration

---

## 🎯 Testing Checklist

- [ ] EVI Engine generates contracts
- [ ] Contracts compile successfully
- [ ] Canton Ginie generates Daml contracts
- [ ] WebBuilder creates React apps
- [ ] Orchestrator routes requests correctly
- [ ] All services communicate
- [ ] Database connections work
- [ ] Frontend loads and displays data

---

## 📖 Documentation Links

- **Master Plan:** `BOT_CHAIN_DAPP_BUILDER_PLAN.md`
- **EVI Docs:** `Evi_Contract_Engine/README.md`
- **Canton Docs:** `Canton_Ginie/README.md`
- **WebBuilder Docs:** `webbuilder-main/README.md`

---

## 🆘 Getting Help

If you encounter issues:

1. Check service logs in terminal
2. Verify all environment variables are set
3. Ensure all dependencies are installed
4. Check database connections
5. Review error messages carefully

---

## ✅ Success Criteria

You're ready to move forward when:

✅ All 5 services are running without errors
✅ Health check returns all services as "healthy"
✅ Can create a test contract via orchestrator
✅ Database connections are working
✅ Frontend loads at localhost:3000

---

**Congratulations! You now have the foundation for the BOT Chain DApp Builder running locally.** 🎉

Next: Review the master plan and begin Phase 2 implementation.
