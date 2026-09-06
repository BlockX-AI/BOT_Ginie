# WebBuilder

An AI-powered web application builder that generates React applications through natural language descriptions using multi-agent orchestration with LangGraph.

## 🎯 User-Facing Features

| Feature | Description | User Benefit | Typical Time |
|---------|-------------|--------------|--------------|
| **🔐 User Authentication** | Sign up, login, and secure account management with JWT tokens | Protect your projects and track your work | 30 seconds |
| **💬 Natural Language Prompts** | Describe what you want in plain English | No coding knowledge required | 1 minute |
| **⚛️ Web App Generation** | AI creates full React applications from your description | Get working apps (todo lists, calculators, dashboards) instantly | 2-5 minutes |
| **⛓️ Smart Contract Creation** | Generate and deploy Solidity contracts (ERC20, NFT, DAO, etc.) | Launch blockchain projects without writing Solidity | 2-3 minutes |
| **🚀 Full DApp Builder** | Complete blockchain apps with smart contract + Web3 UI | End-to-end DApp in one request | 5-10 minutes |
| **🔄 Real-Time Progress Updates** | Live WebSocket streaming of build status | Watch your app being built step-by-step | Continuous |
| **📁 File Explorer** | Browse all generated files (components, styles, config) | Understand project structure | Instant |
| **💻 Code Viewer** | Syntax-highlighted code with Monaco Editor | Review and learn from generated code | Instant |
| **👁️ Live Preview** | Instantly preview your app in embedded iframe | Test functionality without deployment | Instant |
| **🔌 Wallet Connection** | Automatic Web3 wallet integration (RainbowKit) for DApps | Users can connect MetaMask, WalletConnect, etc. | Pre-configured |
| **📊 Project Dashboard** | View all your projects in one place | Manage multiple apps easily | Instant |
| **💾 Auto-Save** | Projects automatically persist to database | Never lose your work | Automatic |
| **📜 Message History** | Complete chat log of all interactions | Review past conversations and changes | Instant |
| **⬇️ Project Download** | Download entire project as ZIP file | Take your code anywhere | Few seconds |
| **🌐 Multi-Network Support** | Deploy contracts to 10+ testnets (Sepolia, Base, Polygon, etc.) | Test on your preferred blockchain | Configurable |
| **🎨 Modern UI/UX** | Beautiful TailwindCSS styling pre-configured | Professional-looking apps by default | Built-in |
| **🔁 Iterative Development** | Chat with AI to modify and improve apps | Refine your project with follow-up requests | 2-5 min/iteration |
| **💰 Token System** | 2 free project creations per day | Fair usage with daily resets | 24-hour reset |
| **📝 Contract Verification** | Smart contracts auto-verified on block explorers | Transparency and trust for DApps | Automatic |
| **📊 Contract Dashboard** | View all deployed contracts with addresses and ABIs | Track your blockchain deployments | Instant |
| **🔍 Error Recovery** | AI automatically fixes compilation and runtime errors | Fewer failures, higher success rate | Automatic |
| **📱 Responsive Design** | All generated apps work on mobile and desktop | Reach users on any device | Built-in |

### What You Can Build

| Category | Examples | Time Required |
|----------|----------|---------------|
| **Productivity Apps** | Todo lists, note-taking, timers, calculators | 2-3 minutes |
| **Data Apps** | Dashboards, analytics, charts, forms | 3-5 minutes |
| **Creative Apps** | Drawing tools, image editors, markdown editors | 3-5 minutes |
| **ERC20 Tokens** | Governance tokens, utility tokens, meme coins | 2 minutes |
| **NFT Collections** | Art collections, gaming NFTs, membership passes | 3 minutes |
| **DeFi Protocols** | Staking platforms, lending, token swaps | 5-8 minutes |
| **DAOs** | Voting systems, treasury management, proposals | 5-10 minutes |
| **Full DApps** | NFT marketplaces, token launchpads, games | 8-12 minutes |

## Architecture

### Backend
- FastAPI server with WebSocket support for real-time communication
- Multi-agent system using LangGraph for workflow orchestration
- E2B sandboxes for isolated code execution and validation
- PostgreSQL database for user authentication and chat persistence
- JWT-based authentication with token-based rate limiting
- Multi-provider LLM integration (OpenAI, Google Gemini, Anthropic, HuggingFace)

### Frontend
- Next.js application with TypeScript
- Real-time WebSocket communication for build progress
- File viewer and preview panel for generated applications
- Chat interface for iterative development

### Agent System
- Planner Node: Creates implementation plan from user prompt
- Builder Node: Generates React code and components
- Import Checker: Validates import statements
- Code Validator: Checks for syntax errors
- Application Checker: Verifies runtime execution
- Retry mechanism with error categorization and limits

## Project Structure

```
lovable-clone/
├── agent/              # Multi-agent system
│   ├── agent.py        # LLM configuration
│   ├── graph_builder.py # LangGraph workflow
│   ├── graph_nodes.py   # Agent node implementations
│   ├── graph_state.py   # State management
│   ├── prompts.py       # System prompts
│   ├── service.py       # Sandbox lifecycle management
│   └── tools.py         # File and command tools
├── auth/               # Authentication system
├── db/                 # Database models and configuration
├── alembic/            # Database migrations
├── frontend/           # Next.js application
│   ├── app/            # Next.js pages
│   ├── components/     # React components
│   ├── api/            # API client
│   └── lib/            # Utilities and types
├── main.py             # FastAPI application entry point
├── pyproject.toml      # Python dependencies (uv)
└── requirements.txt    # Python dependencies (pip)
```

## Prerequisites

- Python 3.12 or higher
- Node.js 18 or higher
- PostgreSQL database
- E2B account and API key
- OpenAI API key (or other LLM provider)

## Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/webbuilder
DIRECT_URL=postgresql://username:password@localhost:5432/webbuilder

# Authentication
SECRET_KEY=your-secret-key-here

# E2B Sandbox
E2B_API_KEY=your-e2b-api-key

# LLM Providers (at least one required)
OPENAI_API_KEY=your-openai-api-key
GOOGLE_API_KEY=your-google-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
HUGGINGFACE_API_KEY=your-huggingface-api-key
```

## Setup

### Backend (Python/FastAPI)

1. Install dependencies using uv (recommended) or pip:
```bash
# Using uv (faster, recommended)
uv sync

# Or using pip
pip install -r requirements.txt
```

2. Run database migrations:
```bash
alembic upgrade head
```

3. Start the backend server:
```bash
uv run uvicorn main:app --reload

# Or without uv
uvicorn main:app --reload
```

The API server will be available at `http://localhost:8000`

### Frontend (Next.js)

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env.local` file in frontend directory:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

4. Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

## Database Setup

1. Install PostgreSQL if not already installed

2. Create database:
```sql
CREATE DATABASE webbuilder;
```

3. The application will automatically create tables on first migration run

## E2B Sandbox Configuration

1. Sign up at https://e2b.dev
2. Create a new template or use existing template ID: `9jwfe1bxhxidt50x0a6o`
3. Add E2B_API_KEY to your `.env` file
4. Template is configured in `e2b.toml` with Node.js and React support

## API Endpoints

### Authentication
- `POST /auth/signup` - Create new user account
- `POST /auth/login` - Login and get JWT token
- `GET /auth/me` - Get current user profile

### Chat/Projects
- `POST /chat` - Create new project and start agent
- `GET /chats/{id}/messages` - Get chat message history
- `GET /projects` - List all user projects
- `WS /ws/{id}?token={jwt}` - WebSocket for real-time updates

### Files
- `GET /projects/{id}/files` - List project files
- `GET /projects/{id}/files/{path}` - Get file content
- `GET /projects/{id}/download` - Download project as ZIP

## Token System

- Each user gets 2 tokens per 24 hours
- Tokens reset automatically after 24 hours
- Each project creation or chat message consumes 1 token
- Token usage is tracked per user in the database

## Development

### Running Backend
```bash
# Run with auto-reload
uv run uvicorn main:app --reload

# Run database migrations
alembic revision --autogenerate -m "description"
alembic upgrade head

# Format code
black .
```

### Running Frontend
```bash
cd frontend
npm run dev      # Development server
npm run build    # Production build
npm run lint     # Lint code
```

## Deployment Considerations

### Backend
- Set proper CORS origins in `main.py`
- Use production-grade database connection pooling
- Configure proper WebSocket timeout values
- Set up nginx with WebSocket support:
  - `proxy_http_version 1.1`
  - Upgrade and Connection headers
  - Increased `proxy_read_timeout` for long operations

### Frontend
- Update API URLs in environment variables
- Build for production: `npm run build`
- Serve with proper CDN for static assets

### Database
- Use connection pooling
- Regular backups
- Monitor for idle connections

## Troubleshooting

### Backend won't start
- Verify all environment variables are set
- Check database connection
- Ensure port 8000 is available: `lsof -i:8000`

### Frontend can't connect
- Verify backend is running
- Check CORS settings in `main.py`
- Verify API URL in frontend `.env.local`

### WebSocket disconnects
- Check nginx configuration for WebSocket support
- Increase timeout values
- Verify JWT token is being sent correctly

### Database connection errors
- Verify PostgreSQL is running
- Check DATABASE_URL format
- Ensure database exists

## License

MIT
