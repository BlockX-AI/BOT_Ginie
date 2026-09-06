# WebBuilder Architecture Documentation

Complete technical architecture of the WebBuilder DApp platform.

## Table of Contents

- [System Overview](#system-overview)
- [Technology Stack](#technology-stack)
- [Architecture Diagrams](#architecture-diagrams)
- [Component Details](#component-details)
- [Data Flow](#data-flow)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Security](#security)
- [Deployment](#deployment)

---

## System Overview

WebBuilder is an AI-powered platform that generates full-stack decentralized applications (DApps) from natural language descriptions. It combines:

1. **Multi-Agent System** (LangGraph) - Plans and builds applications
2. **Smart Contract Backend** (AcademicChain) - Generates and deploys Solidity contracts
3. **Frontend Engine** (E2B Sandboxes) - Creates React applications with Web3 integration
4. **Real-time Communication** (WebSockets) - Streams progress updates
5. **Persistent Storage** (PostgreSQL) - Stores users, projects, and contracts

### Key Features

- 🤖 **AI-Powered Generation** - Natural language to working DApp
- 🔗 **Smart Contracts** - Automatic Solidity generation and deployment
- ⚛️ **React Frontend** - Modern UI with TailwindCSS and Web3 libraries
- 🔄 **Real-time Updates** - WebSocket-based progress streaming
- 🔐 **Authentication** - JWT-based user management
- 💰 **Token System** - Rate limiting with daily token resets
- 🌐 **Multi-Chain** - Support for 10+ EVM networks

---

## Technology Stack

### Backend
```
FastAPI         - Web framework
LangGraph       - Multi-agent orchestration
LangChain       - LLM integration
SQLAlchemy      - ORM and database management
Alembic         - Database migrations
AsyncPG         - PostgreSQL async driver
Python-Jose     - JWT authentication
Passlib         - Password hashing
E2B             - Sandboxed code execution
HTTPX           - Async HTTP client
```

### Frontend
```
Next.js 16      - React framework
TypeScript      - Type safety
TailwindCSS     - Styling
Radix UI        - Component primitives
Monaco Editor   - Code viewer
Axios           - HTTP client
WebSocket API   - Real-time communication
```

### LLM Providers (Multi-provider support)
```
OpenAI GPT-4/3.5
Google Gemini
Anthropic Claude
HuggingFace Models
```

### Infrastructure
```
PostgreSQL      - Primary database
E2B Sandboxes   - Isolated execution environments
AcademicChain   - Smart contract deployment service
```

---

## Architecture Diagrams

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         USER                                │
│                     (Web Browser)                           │
└────────────┬─────────────────────────────────┬──────────────┘
             │                                 │
             │ HTTP/REST                       │ WebSocket
             │                                 │
┌────────────▼─────────────────────────────────▼──────────────┐
│                    FASTAPI BACKEND                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Auth Router  │  │ Chat Router  │  │ DApp Router  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│  ┌──────▼──────────────────▼──────────────────▼──────┐      │
│  │          WebBuilder Service Layer                 │      │
│  │  ┌──────────────┐  ┌──────────────────────────┐  │      │
│  │  │  LangGraph   │  │  DApp Orchestrator       │  │      │
│  │  │  Multi-Agent │  │  (Contract + Frontend)   │  │      │
│  │  └──────┬───────┘  └──────┬───────────────────┘  │      │
│  └─────────┼──────────────────┼──────────────────────┘      │
└────────────┼──────────────────┼─────────────────────────────┘
             │                  │
    ┌────────▼────────┐  ┌──────▼────────────────┐
    │  E2B Sandbox    │  │  AcademicChain API    │
    │  (React Build)  │  │  (Smart Contracts)    │
    └─────────────────┘  └───────────────────────┘
             │                  │
             │                  ▼
             │            ┌───────────────┐
             │            │  EVM Networks │
             │            │  (Testnets)   │
             │            └───────────────┘
             │
    ┌────────▼────────────────────┐
    │     PostgreSQL Database     │
    │  - users                    │
    │  - chats                    │
    │  - messages                 │
    │  - contracts                │
    └─────────────────────────────┘
```

### LangGraph Multi-Agent Workflow

```
┌─────────────┐
│ User Prompt │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  Planner Node   │ ← Creates implementation plan
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Builder Node   │ ← Generates React code
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Import Checker  │ ← Validates imports
└────────┬────────┘
         │
    ┌────▼─────┐
    │ Errors?  │
    └────┬─────┘
         │ No
         ▼
┌─────────────────┐
│ Code Validator  │ ← Checks syntax
└────────┬────────┘
         │
    ┌────▼─────┐
    │ Errors?  │
    └────┬─────┘
         │ No
         ▼
┌─────────────────┐
│ App Checker     │ ← Tests runtime
└────────┬────────┘
         │
    ┌────▼─────┐
    │ Success? │
    └────┬─────┘
         │ Yes
         ▼
┌─────────────────┐
│   Complete      │
└─────────────────┘
```

### DApp Creation Flow

```
User Prompt: "Create NFT contract"
       │
       ▼
┌──────────────────────────────┐
│  POST /dapp/create           │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  DApp Orchestrator           │
│  1. Generate contract        │ ────┐
└──────┬───────────────────────┘     │
       │                             │
       │                      ┌──────▼──────────────┐
       │                      │ AcademicChain API   │
       │                      │ - AI generates code │
       │                      │ - Compiles Solidity │
       │                      │ - Fixes errors      │
       │                      │ - Deploys to chain  │
       │                      │ - Returns ABI       │
       │                      └──────┬──────────────┘
       │                             │
       ▼                             │
┌──────────────────────────────┐    │
│  2. Save Contract to DB      │ ◄──┘
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  3. Create Web3 Boilerplate  │
│  - wagmi hooks              │
│  - RainbowKit setup         │
│  - Contract ABI import      │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  4. Run WebBuilder Agent     │ ────┐
└──────┬───────────────────────┘     │
       │                             │
       │                      ┌──────▼──────────────┐
       │                      │  LangGraph Agents   │
       │                      │  - Plan UI          │
       │                      │  - Build components │
       │                      │  - Validate code    │
       │                      │  - Test app         │
       │                      └──────┬──────────────┘
       │                             │
       ▼                             │
┌──────────────────────────────┐    │
│  5. Get Live URL             │ ◄──┘
│  https://project.evi.buzz    │
└──────────────────────────────┘
```

---

## Component Details

### 1. Authentication System (`auth/`)

**Files:**
- `router.py` - API endpoints (signup, login, me)
- `dependencies.py` - JWT verification
- `utils.py` - Password hashing, token generation
- `schema.py` - Pydantic models

**Features:**
- JWT-based authentication
- Bcrypt password hashing
- Token expiration (30 days)
- Rate limiting per user

**Token Format:**
```json
{
  "sub": "user@example.com",
  "exp": 1234567890
}
```

### 2. Database Layer (`db/`)

**Files:**
- `base.py` - Database connection and session management
- `models.py` - SQLAlchemy ORM models

**Connection Pooling:**
```python
engine = create_async_engine(
    DATABASE_URL,
    pool_pre_ping=True,      # Test connections
    pool_size=5,             # Base connections
    max_overflow=10,         # Additional connections
    pool_recycle=3600        # Recycle after 1 hour
)
```

**Models:**
- `User` - User accounts with token system
- `Chat` - Projects/conversations
- `Message` - Chat messages and events
- `Contract` - Deployed smart contracts

### 3. Multi-Agent System (`agent/`)

**Files:**
- `agent.py` - LLM configuration
- `graph_builder.py` - LangGraph workflow
- `graph_nodes.py` - Agent node implementations
- `graph_state.py` - Shared state management
- `prompts.py` - System prompts
- `service.py` - Sandbox lifecycle
- `tools.py` - File and command tools

**Agents:**

1. **Planner Node**
   - Analyzes user prompt
   - Creates implementation plan
   - Lists files to create

2. **Builder Node**
   - Generates React components
   - Creates TailwindCSS styles
   - Implements functionality

3. **Import Checker**
   - Validates import statements
   - Fixes missing packages
   - Updates package.json

4. **Code Validator**
   - Runs ESLint
   - Checks syntax errors
   - Fixes compilation issues

5. **Application Checker**
   - Starts dev server
   - Tests runtime
   - Verifies functionality

**Retry Logic:**
```python
max_retries = 3
retry_count = {
    "validation_errors": 0,
    "runtime_errors": 0
}
```

### 4. Smart Contract Integration (`integrations/`)

**Files:**
- `academic_chain_client.py` - API client for AcademicChain
- `dapp_orchestrator.py` - Coordinates contract + frontend

**AcademicChain API Methods:**
```python
generate_contract(prompt)      # AI generates Solidity
compile_contract(code)         # Compiles with solc
fix_contract(code, errors)     # AI fixes errors
deploy_contract(code, network) # Deploys to blockchain
get_contract_abi(job_id)      # Retrieves ABI
```

**Supported Networks:**
- Sepolia Testnet (Ethereum)
- Base Camp Testnet
- Polygon Mumbai
- Avalanche Fuji
- And more...

### 5. E2B Sandbox Management

**Template:** `9jwfe1bxhxidt50x0a6o`

**Pre-installed:**
```json
{
  "dependencies": {
    "react": "^18.0.0",
    "vite": "^5.0.0",
    "tailwindcss": "^3.4.0",
    "wagmi": "^2.0.0",
    "viem": "^2.0.0",
    "@rainbow-me/rainbowkit": "^2.0.0"
  }
}
```

**Lifecycle:**
- Created on-demand per project
- 30-minute timeout
- Files persisted to disk
- Restored on reconnection

**File Structure:**
```
/home/user/react-app/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   └── components/
├── public/
├── index.html
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

---

## Data Flow

### 1. Standard Web App Creation

```
1. User submits prompt
2. Create Chat record in DB
3. Initialize E2B sandbox
4. Run LangGraph workflow:
   a. Planner creates plan
   b. Builder generates code
   c. Validators check code
   d. Checkers test runtime
5. Files saved to sandbox
6. Snapshot to disk
7. Return live URL
```

### 2. DApp Creation with Smart Contract

```
1. User submits DApp prompt
2. Create Chat record
3. Call AcademicChain:
   a. Generate Solidity
   b. Compile contract
   c. Fix errors (max 3 iterations)
   d. Deploy to testnet
4. Receive contract address + ABI
5. Save Contract record to DB
6. Initialize E2B sandbox
7. Create Web3 boilerplate
8. Save contract info to sandbox
9. Run LangGraph workflow:
   a. Build UI with Web3 integration
   b. Add wallet connection
   c. Add contract interaction
10. Return live URL + contract info
```

### 3. WebSocket Updates

```
Client ──► WS Connect ──► Authenticate (JWT)
   │                         │
   │                         ▼
   │                  Add to active_sockets
   │                         │
   ▼                         ▼
Receive ◄── Push Updates ◄── Agent Events
   │
   │ Events:
   │ - started
   │ - planning
   │ - building
   │ - validating
   │ - contract_generating
   │ - contract_deploying
   │ - completed
   │ - error
   │
   ▼
Display to User
```

---

## API Endpoints

### Authentication

```
POST   /auth/signup        Create new user
POST   /auth/login         Login (returns JWT)
GET    /auth/me            Get current user info
```

### Projects

```
POST   /chat               Create new project
GET    /projects           List user projects
GET    /chats/{id}/messages  Get chat history
```

### Files

```
GET    /projects/{id}/files       List project files
GET    /projects/{id}/files/{path}  Get file content
GET    /projects/{id}/download    Download as ZIP
```

### DApp

```
POST   /dapp/create                      Create full DApp
POST   /dapp/frontend-for-contract       Frontend only
GET    /projects/{id}/contracts          List contracts
```

### WebSocket

```
WS     /ws/{id}?token={jwt}   Real-time updates
```

---

## Database Schema

### users
```sql
id                INTEGER PRIMARY KEY
email             VARCHAR(255) UNIQUE NOT NULL
hashed_password   VARCHAR(255) NOT NULL
name              VARCHAR(255) NOT NULL
created_at        TIMESTAMP WITH TIME ZONE
last_query_at     TIMESTAMP WITH TIME ZONE
tokens_remaining  INTEGER DEFAULT 2
tokens_reset_at   TIMESTAMP WITH TIME ZONE
```

### chats
```sql
id          VARCHAR(36) PRIMARY KEY
user_id     INTEGER REFERENCES users(id)
title       VARCHAR(255) NOT NULL
app_url     VARCHAR(1024)
created_at  TIMESTAMP WITH TIME ZONE
```

### messages
```sql
id          VARCHAR(36) PRIMARY KEY
chat_id     VARCHAR(36) REFERENCES chats(id)
role        VARCHAR(50)  -- 'user' or 'assistant'
content     TEXT
event_type  VARCHAR(100) -- 'planning', 'building', etc.
tool_calls  JSON
created_at  TIMESTAMP WITH TIME ZONE
```

### contracts
```sql
id                  VARCHAR(36) PRIMARY KEY
chat_id             VARCHAR(36) REFERENCES chats(id)
contract_name       VARCHAR(255) NOT NULL
contract_address    VARCHAR(42) NOT NULL
network             VARCHAR(50) NOT NULL
chain_id            INTEGER NOT NULL
abi                 JSON NOT NULL
source_code         TEXT
job_id              VARCHAR(100)
deploy_tx_hash      VARCHAR(66)
verified            INTEGER DEFAULT 0
explorer_url        VARCHAR(512)
deployment_status   VARCHAR(50) DEFAULT 'pending'
created_at          TIMESTAMP WITH TIME ZONE
```

---

## Security

### Authentication
- ✅ JWT tokens with 30-day expiration
- ✅ Bcrypt password hashing (10 rounds)
- ✅ Secure token storage
- ✅ CORS protection

### Rate Limiting
- ✅ 2 tokens per user per 24 hours
- ✅ Automatic token reset
- ✅ Database-tracked usage

### Sandboxing
- ✅ Isolated E2B environments
- ✅ No access to host system
- ✅ Timeout protection (30 min)

### Smart Contracts
- ✅ Testnet-only by default
- ✅ AI security auditing (optional)
- ✅ Contract verification on explorers

### Input Validation
- ✅ Pydantic schemas
- ✅ SQL injection protection (ORM)
- ✅ XSS prevention

---

## Deployment

### Backend Deployment

**Requirements:**
- Python 3.12+
- PostgreSQL database
- Environment variables

**Docker:**
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY . .
RUN pip install -r requirements.txt
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Environment:**
```env
DATABASE_URL=postgresql+asyncpg://...
SECRET_KEY=...
E2B_API_KEY=...
OPENAI_API_KEY=...
```

### Frontend Deployment

**Build:**
```bash
cd frontend
npm run build
npm start
```

**Vercel/Netlify:**
- Framework: Next.js
- Build command: `npm run build`
- Output directory: `.next`
- Environment: `NEXT_PUBLIC_API_URL`

### Database Migrations

```bash
# Generate migration
alembic revision --autogenerate -m "description"

# Apply migration
alembic upgrade head

# Rollback
alembic downgrade -1
```

---

## Performance Considerations

### Backend
- Connection pooling (5 base + 10 overflow)
- Async I/O throughout
- WebSocket for real-time (no polling)
- Database indexing on frequent queries

### Frontend
- Code splitting
- Lazy loading components
- WebSocket reconnection logic
- Caching API responses

### Sandboxes
- Reuse existing sandboxes (30 min TTL)
- File persistence to avoid rebuilds
- Parallel agent execution where possible

---

## Monitoring & Logging

### Logs
```python
# Agent execution
print(f"[Agent] {node_name}: {status}")

# WebSocket
print(f"[WS] Client connected: {chat_id}")

# Database
echo=True  # SQL logging (development only)
```

### Metrics to Track
- Request latency
- Token usage per user
- Sandbox creation time
- DApp build success rate
- WebSocket connection duration

---

## Future Enhancements

1. **Mainnet Support**
   - Require additional verification
   - Multi-signature deployments
   - Gas estimation

2. **Advanced DApps**
   - Multi-contract systems
   - Subgraph integration
   - Oracle connections

3. **Collaboration**
   - Team projects
   - Shared workspaces
   - Real-time co-editing

4. **Marketplace**
   - Template library
   - Component marketplace
   - Pre-audited contracts

---

## Conclusion

WebBuilder combines cutting-edge AI, blockchain technology, and modern web development to deliver a complete DApp creation platform. The architecture is designed for:

- ⚡ **Performance** - Async everywhere, connection pooling
- 🔐 **Security** - JWT auth, sandboxing, rate limiting
- 📈 **Scalability** - Stateless design, database-backed
- 🛠️ **Maintainability** - Modular components, clear separation

For questions or contributions, see the main README.md.

**Built with ❤️ using FastAPI, LangGraph, and E2B**
