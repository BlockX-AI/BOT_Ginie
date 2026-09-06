#!/bin/bash

# WebBuilder Setup Script
# Automated setup for the WebBuilder DApp platform

set -e  # Exit on error

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║         WebBuilder DApp Platform Setup                   ║"
echo "║   AI-powered web and smart contract builder              ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "🔍 Checking prerequisites..."

# Check Python
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    echo -e "${GREEN}✓${NC} Python 3 found: $PYTHON_VERSION"
else
    echo -e "${RED}✗${NC} Python 3 is required but not installed"
    exit 1
fi

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} Node.js found: $NODE_VERSION"
else
    echo -e "${YELLOW}⚠${NC} Node.js not found. Frontend will need manual setup."
fi

# Check PostgreSQL
if command -v psql &> /dev/null; then
    PSQL_VERSION=$(psql --version | cut -d' ' -f3)
    echo -e "${GREEN}✓${NC} PostgreSQL found: $PSQL_VERSION"
else
    echo -e "${YELLOW}⚠${NC} PostgreSQL not found. You'll need to install it manually."
fi

echo ""

# Step 1: Create .env file
echo "📝 Step 1: Setting up environment variables..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${GREEN}✓${NC} Created .env file from template"
    echo -e "${YELLOW}⚠${NC} IMPORTANT: Edit .env and add your API keys:"
    echo "   - DATABASE_URL (PostgreSQL connection string)"
    echo "   - SECRET_KEY (generate with: openssl rand -hex 32)"
    echo "   - E2B_API_KEY (get from https://e2b.dev)"
    echo "   - OPENAI_API_KEY (or other LLM provider)"
    echo ""
    read -p "Press Enter after you've configured .env..."
else
    echo -e "${GREEN}✓${NC} .env file already exists"
fi

# Step 2: Install Python dependencies
echo ""
echo "📦 Step 2: Installing Python dependencies..."
if command -v uv &> /dev/null; then
    echo "Using uv (faster)..."
    uv sync
else
    echo "Using pip..."
    pip3 install -r requirements.txt
fi
echo -e "${GREEN}✓${NC} Python dependencies installed"

# Step 3: Setup database
echo ""
echo "🗄️  Step 3: Setting up database..."
echo "Make sure PostgreSQL is running and you've created the database."
echo ""
read -p "Have you created the PostgreSQL database? (y/n): " DB_CREATED

if [ "$DB_CREATED" = "y" ]; then
    echo "Running Alembic migrations..."
    alembic upgrade head
    echo -e "${GREEN}✓${NC} Database schema created"
else
    echo -e "${YELLOW}⚠${NC} Skipping database migration."
    echo "Create your database with: CREATE DATABASE webbuilder;"
    echo "Then run: alembic upgrade head"
fi

# Step 4: Frontend setup
echo ""
echo "🎨 Step 4: Setting up frontend..."
read -p "Do you want to set up the frontend now? (y/n): " SETUP_FRONTEND

if [ "$SETUP_FRONTEND" = "y" ]; then
    cd frontend
    
    if [ ! -f .env.local ]; then
        echo "Creating frontend .env.local..."
        cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
EOF
        echo -e "${GREEN}✓${NC} Created frontend/.env.local"
    fi
    
    echo "Installing frontend dependencies..."
    npm install
    echo -e "${GREEN}✓${NC} Frontend dependencies installed"
    
    cd ..
else
    echo -e "${YELLOW}⚠${NC} Skipping frontend setup"
fi

# Summary
echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                 Setup Complete! 🎉                        ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "📚 Next Steps:"
echo ""
echo "1️⃣  Start the backend:"
echo "   ${GREEN}uvicorn main:app --reload${NC}"
echo "   or with uv: ${GREEN}uv run uvicorn main:app --reload${NC}"
echo ""
echo "2️⃣  Start the frontend (in a new terminal):"
echo "   ${GREEN}cd frontend && npm run dev${NC}"
echo ""
echo "3️⃣  Access the application:"
echo "   Frontend: ${GREEN}http://localhost:3000${NC}"
echo "   Backend API: ${GREEN}http://localhost:8000${NC}"
echo "   API Docs: ${GREEN}http://localhost:8000/docs${NC}"
echo ""
echo "4️⃣  Run tests:"
echo "   ${GREEN}python3 test_api.py${NC}"
echo ""
echo "📖 Documentation:"
echo "   - README.md - General overview"
echo "   - IMPLEMENTATION_SUMMARY.md - DApp features"
echo "   - DAPP_BUILDER_GUIDE.md - Complete DApp guide"
echo ""
echo "Happy building! 🚀"
