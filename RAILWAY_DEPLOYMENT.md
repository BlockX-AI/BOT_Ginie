# BOT_Ginie Railway Deployment Guide

**BOT_Ginie** is a full-stack AI-powered DApp generator for BOT Chain. It consists of:
- **WebBuilder** (Python/FastAPI): LangGraph-based React frontend generator with E2B sandboxes
- **EVI Contract Engine** (Node.js/Express): AI smart contract generation, compilation, deployment, and verification

## 🚀 Quick Deploy to Railway

### Prerequisites
1. Railway account: https://railway.app
2. GitHub account with access to https://github.com/BlockX-AI/BOT_Ginie
3. API keys ready:
   - E2B API key (https://e2b.dev)
   - OpenAI API key (https://platform.openai.com)
   - Vercel token (https://vercel.com/account/tokens)
   - BOT Chain deployer private key

### Step 1: Create Railway Project

1. Go to https://railway.app/new
2. Click **Deploy from GitHub repo**
3. Select `BlockX-AI/BOT_Ginie`
4. Railway will auto-detect the `railway.json` config

### Step 2: Add PostgreSQL Database

1. In your Railway project, click **+ New**
2. Select **Database** → **PostgreSQL**
3. Railway will auto-provision a Postgres instance
4. The `DATABASE_URL` environment variable will be auto-injected

### Step 3: Configure Environment Variables

Go to your service's **Variables** tab and add:

#### Required Variables

```bash
# E2B Sandbox (for React app building)
E2B_API_KEY=e2b_xxxxxxxxxxxxx

# OpenAI (for AI contract generation + LangGraph)
OPENAI_API_KEY=sk-xxxxxxxxxxxxx

# JWT Secret (generate with: openssl rand -hex 32)
SECRET_KEY=your_random_32_char_secret

# Vercel (for frontend deployment)
VERCEL_TOKEN=your_vercel_token
VERCEL_ORG_ID=your_vercel_org_id

# BOT Chain deployer wallet
PRIVATE_KEY=0xyour_private_key_here

# CORS (add your frontend domains)
CORS_ORIGINS=https://your-frontend.vercel.app,http://localhost:3000
```

#### Optional Variables

```bash
# Alternative LLM providers
ANTHROPIC_API_KEY=sk-ant-xxxxx
GOOGLE_API_KEY=xxxxx

# BOT Chain Explorer API
BOTCHAIN_API_KEY=your_api_key

# Logging
LOG_LEVEL=info
NODE_ENV=production
```

### Step 4: Deploy

1. Railway will automatically build and deploy after you push to GitHub
2. Monitor the build logs in the **Deployments** tab
3. Once deployed, Railway will provide a public URL: `https://your-app.up.railway.app`

### Step 5: Initialize Database

After first deployment, run migrations:

```bash
# In Railway's terminal (or locally with DATABASE_URL)
cd webbuilder-main
alembic upgrade head
```

## 🏗️ Architecture

```
BOT_Ginie/
├── webbuilder-main/          # Python FastAPI backend
│   ├── main.py               # FastAPI app entry
│   ├── agent/                # LangGraph agents
│   ├── integrations/         # EVI + E2B clients
│   └── models.py             # SQLAlchemy models
│
├── Evi_Contract_Engine/      # Node.js Express API
│   ├── api/server.js         # Express entry
│   ├── api/routes/           # Contract generation, deploy, verify
│   └── hardhat.config.js     # Hardhat config for deployment
│
├── requirements.txt          # Python dependencies
├── Procfile                  # Railway process config
├── railway.json              # Railway build config
└── .env.example              # Environment template
```

## 🔧 Local Development

### 1. Clone the repo

```bash
git clone https://github.com/BlockX-AI/BOT_Ginie.git
cd BOT_Ginie
```

### 2. Set up environment

```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Install dependencies

```bash
# Python (WebBuilder)
pip install -r requirements.txt

# Node.js (EVI Contract Engine)
cd Evi_Contract_Engine
npm install
cd ..
```

### 4. Run locally

**Terminal 1 (WebBuilder):**
```bash
cd webbuilder-main
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 (EVI Contract Engine):**
```bash
cd Evi_Contract_Engine
node api/server.js
```

Access:
- WebBuilder API: http://localhost:8000
- EVI API: http://localhost:3000
- API Docs: http://localhost:8000/docs

## 📊 Database Schema

Railway PostgreSQL stores:
- **users**: Auth + API tokens
- **chats**: DApp projects
- **messages**: Conversation history
- **contracts**: Deployed contracts (address, ABI, verification status)
- **files**: Generated React components

## 🔐 Security Notes

1. **Never commit `.env`** — it's in `.gitignore`
2. **Rotate secrets regularly** — especially `SECRET_KEY` and `PRIVATE_KEY`
3. **Use Railway's secret management** — don't hardcode keys
4. **Restrict CORS_ORIGINS** — only allow trusted domains

## 🐛 Troubleshooting

### Build fails with "Module not found"
- Check `requirements.txt` includes all Python deps
- Check `Evi_Contract_Engine/package.json` includes all Node deps

### Database connection fails
- Verify `DATABASE_URL` is set (Railway auto-injects it)
- Run `alembic upgrade head` to create tables

### E2B sandbox errors
- Verify `E2B_API_KEY` is valid
- Check E2B quota: https://e2b.dev/dashboard

### Contract deployment fails
- Verify `PRIVATE_KEY` has BOT tokens for gas
- Check RPC URL is correct: `https://rpc.botchain.ai`

## 📞 Support

- GitHub Issues: https://github.com/BlockX-AI/BOT_Ginie/issues
- BOT Chain Docs: https://docs.botchain.ai

## 📜 License

MIT
