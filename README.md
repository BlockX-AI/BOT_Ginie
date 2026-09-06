# BOT_Ginie 🤖

**AI-Powered DApp Generator for BOT Chain**

BOT_Ginie is a full-stack platform that generates, deploys, and verifies smart contracts on BOT Chain, then automatically builds beautiful React frontends with Web3 integration — all from a single natural language prompt.

## 🚀 Deploy to Railway (Recommended)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/BlockX-AI/BOT_Ginie)

**See [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md) for detailed deployment instructions.**

## 🏃 Quick Start (Local Development)

### 1. Install Dependencies

```bash
# EVI Contract Engine
cd Evi_Contract_Engine
npm install
cd ..

# WebBuilder
cd webbuilder-main
pip install -r requirements.txt
cd ..
```

### 2. Configure Environment

**EVI Contract Engine** (`Evi_Contract_Engine/.env`):
```bash
GEMINI_API_KEY=your_gemini_api_key
BOT_CHAIN_RPC_URL=https://rpc.botchain.ai/en
BOT_CHAIN_PRIVATE_KEY=your_private_key
PORT=3001
```

**WebBuilder** (`webbuilder-main/.env`):
```bash
DATABASE_URL=postgresql+asyncpg://user:password@localhost/webbuilder
SECRET_KEY=your-secret-key
E2B_API_KEY=your_e2b_api_key
OPENAI_API_KEY=your_openai_key
EVI_API_BASE_URL=http://localhost:3001
DEFAULT_NETWORK=botchain-testnet
```

### 3. Setup Database

```bash
cd webbuilder-main
createdb webbuilder
alembic upgrade head
cd ..
```

### 4. Start Services

**Terminal 1 - EVI:**
```bash
cd Evi_Contract_Engine
npm start
```

**Terminal 2 - WebBuilder:**
```bash
cd webbuilder-main
uvicorn main:app --reload
```

### 5. Test Backend

```bash
python test-backend.py
```

## API Usage

### Create DApp via API

```bash
# 1. Sign up
curl -X POST http://localhost:8000/auth/signup \
  -d "username=user@example.com&password=pass123"

# 2. Login
TOKEN=$(curl -X POST http://localhost:8000/auth/login \
  -d "username=user@example.com&password=pass123" \
  | jq -r '.access_token')

# 3. Create DApp
curl -X POST http://localhost:8000/dapp/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create an NFT collection with minting",
    "network": "botchain-testnet"
  }'
```

## What's Configured

✅ EVI Contract Engine with BOT Chain networks
✅ WebBuilder with BOT Chain integration  
✅ DApp orchestration (contract + frontend)
✅ Web3 boilerplate with BOT Chain in wagmi
✅ Real-time WebSocket updates
✅ Database schema for contracts
✅ Authentication system

## Architecture

```
User Request
    ↓
WebBuilder Backend (port 8000)
    ↓
DApp Orchestrator
    ├─→ EVI Contract Engine (port 3001)
    │   └─→ Generates & deploys to BOT Chain
    └─→ WebBuilder Agents
        └─→ Generates React frontend with Web3
```

## Files Modified

- `Evi_Contract_Engine/hardhat.config.js` - Added BOT Chain networks
- `webbuilder-main/integrations/evi_client.py` - Added BOT Chain config
- `webbuilder-main/integrations/dapp_orchestrator.py` - Default to botchain-testnet
- `webbuilder-main/agent/tools.py` - Added BOT Chain to wagmi

## Next Steps

1. Get actual BOT Chain RPC URLs and chain IDs
2. Test deployment on BOT Chain testnet
3. Build frontend (optional) or use API directly
4. Deploy to production

## Support

See `SIMPLIFIED_BOT_CHAIN_PLAN.md` for detailed architecture and implementation plan.
