#!/bin/bash

echo "🚀 Starting Railway deployment..."

# Debug: Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  WARNING: DATABASE_URL is not set!"
    echo "📋 Available environment variables:"
    env | grep -E "(DATABASE|RAILWAY)" || echo "No DATABASE or RAILWAY vars found"
else
    echo "✅ DATABASE_URL is set"
fi

# Run database migrations if alembic exists (non-fatal)
if [ -d "/app/webbuilder-main/alembic" ] || [ -d "/app/alembic" ]; then
    echo "📊 Running database migrations..."
    cd /app/webbuilder-main 2>/dev/null || cd /app
    if python -m alembic upgrade head; then
        echo "✅ Migrations complete!"
    else
        echo "⚠️  Migrations failed, but continuing anyway..."
        echo "   The app will try to connect to the database directly"
    fi
else
    echo "⚠️  No alembic directory found, skipping migrations"
fi

# Start the application
echo "🌐 Starting FastAPI server on port ${PORT:-8000}..."
exec python -m uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
