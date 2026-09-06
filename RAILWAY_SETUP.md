# Railway Deployment - Two Service Setup

## Architecture

BOT_Ginie requires **TWO separate Railway services**:

1. **WebBuilder (Python)** - Main API service
2. **EVI Contract Engine (Node.js)** - Contract generation microservice

## Step-by-Step Deployment

### 1. Create Railway Project

1. Go to https://railway.app/new
2. Click **Empty Project**
3. Name it `BOT_Ginie`

### 2. Add PostgreSQL Database

1. Click **+ New** → **Database** → **PostgreSQL**
2. Railway auto-creates `DATABASE_URL` variable

### 3. Deploy WebBuilder Service (Python)

1. Click **+ New** → **GitHub Repo**
2. Select `BlockX-AI/BOT_Ginie`
3. **Service Name**: `webbuilder`
4. **Root Directory**: Leave empty (uses root)
5. Railway will detect `nixpacks.toml` and build Python service

#### WebBuilder Environment Variables

```bash
# Database (auto-injected by Railway)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# E2B Sandbox
E2B_API_KEY=e2b_xxxxxxxxxxxxx

# LLM APIs (at least one required)
OPENAI_API_KEY=sk-xxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxx
GOOGLE_API_KEY=xxxxx

# JWT Secret (generate: openssl rand -hex 32)
SECRET_KEY=your_random_32_char_secret_here

# Vercel Deployment
VERCEL_TOKEN=your_vercel_token
VERCEL_ORG_ID=your_vercel_org_id

# EVI API URL (internal Railway URL)
EVI_API_BASE_URL=http://evi.railway.internal:3000

# CORS
CORS_ORIGINS=https://your-frontend.vercel.app,http://localhost:3000

# Network
DEFAULT_NETWORK=botchain
```

### 4. Deploy EVI Service (Node.js)

1. Click **+ New** → **GitHub Repo**
2. Select `BlockX-AI/BOT_Ginie` again
3. **Service Name**: `evi`
4. **Root Directory**: `Evi_Contract_Engine`
5. **Start Command**: `npm start`

#### EVI Environment Variables

```bash
# Port (Railway auto-injects)
PORT=${{PORT}}

# OpenAI for AI contract generation
OPENAI_API_KEY=sk-xxxxxxxxxxxxx

# BOT Chain RPC
BOT_CHAIN_RPC=https://rpc.botchain.ai
BOT_CHAIN_TESTNET_RPC=https://rpc.bohr.life

# Deployer Private Key (DO NOT COMMIT)
PRIVATE_KEY=0xyour_private_key_here

# Explorer API Keys
BOTCHAIN_API_KEY=your_botchain_api_key

# Sentry (optional)
SENTRY_DSN=your_sentry_dsn

# Environment
NODE_ENV=production
```

### 5. Enable Private Networking

1. Go to **WebBuilder** service settings
2. Enable **Private Networking**
3. Go to **EVI** service settings
4. Enable **Private Networking**
5. Update `EVI_API_BASE_URL` in WebBuilder to: `http://evi.railway.internal:3000`

### 6. Initialize Database

After WebBuilder deploys successfully:

1. Go to **WebBuilder** service
2. Click **Settings** → **Deploy**
3. Add **Custom Start Command** (one-time):
   ```bash
   cd webbuilder-main && alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
4. After first successful start, remove `alembic upgrade head` from start command

Or SSH into the service:
```bash
railway run cd webbuilder-main && alembic upgrade head
```

## Service URLs

- **WebBuilder (Public)**: `https://webbuilder-production-xxxx.up.railway.app`
- **EVI (Internal only)**: `http://evi.railway.internal:3000`

## Complete Environment Variables List

### WebBuilder Service

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | ✅ | PostgreSQL connection (auto) | `postgresql://...` |
| `E2B_API_KEY` | ✅ | E2B sandbox API key | `e2b_xxxxx` |
| `OPENAI_API_KEY` | ✅ | OpenAI API key | `sk-xxxxx` |
| `SECRET_KEY` | ✅ | JWT secret (32+ chars) | Random hex string |
| `VERCEL_TOKEN` | ✅ | Vercel deployment token | `xxxxx` |
| `VERCEL_ORG_ID` | ✅ | Vercel organization ID | `team_xxxxx` |
| `EVI_API_BASE_URL` | ✅ | EVI service URL | `http://evi.railway.internal:3000` |
| `CORS_ORIGINS` | ✅ | Allowed origins | `https://app.com` |
| `DEFAULT_NETWORK` | ❌ | Default blockchain | `botchain` |
| `ANTHROPIC_API_KEY` | ❌ | Anthropic API key | `sk-ant-xxxxx` |
| `GOOGLE_API_KEY` | ❌ | Google AI API key | `xxxxx` |

### EVI Service

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `PORT` | ✅ | Service port (auto) | `3000` |
| `OPENAI_API_KEY` | ✅ | OpenAI for contract gen | `sk-xxxxx` |
| `PRIVATE_KEY` | ✅ | Deployer wallet key | `0xyour_key` |
| `BOT_CHAIN_RPC` | ❌ | BOT Chain mainnet RPC | `https://rpc.botchain.ai` |
| `BOT_CHAIN_TESTNET_RPC` | ❌ | BOT Chain testnet RPC | `https://rpc.bohr.life` |
| `BOTCHAIN_API_KEY` | ❌ | Explorer API key | `xxxxx` |
| `NODE_ENV` | ❌ | Environment | `production` |
| `SENTRY_DSN` | ❌ | Error tracking | `https://...` |

## Troubleshooting

### Build Fails: "npm: command not found"
- **Cause**: Trying to build both services in one
- **Fix**: Deploy as two separate services (see above)

### Database Connection Error
- **Cause**: `DATABASE_URL` not set
- **Fix**: Ensure PostgreSQL service is linked and variable is `${{Postgres.DATABASE_URL}}`

### EVI Service Not Reachable
- **Cause**: Private networking not enabled
- **Fix**: Enable private networking on both services

### Contract Deployment Fails
- **Cause**: `PRIVATE_KEY` has no BOT tokens for gas
- **Fix**: Fund deployer wallet with BOT tokens

## Health Checks

- **WebBuilder**: `https://your-webbuilder-url.railway.app/health`
- **EVI**: Internal only, no public health endpoint

## Logs

View logs in Railway dashboard:
- **WebBuilder**: Service → Deployments → Logs
- **EVI**: Service → Deployments → Logs

## Scaling

Railway auto-scales based on usage. For manual scaling:
- Go to Service → Settings → Resources
- Adjust CPU/Memory limits
