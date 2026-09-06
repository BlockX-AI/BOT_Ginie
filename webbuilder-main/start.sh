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
if [ -d "/app/alembic" ]; then
    echo "📊 Running database migrations..."
    cd /app
    echo "Current directory: $(pwd)"
    echo "Alembic directory exists: $(ls -la alembic 2>&1 | head -5)"
    if python -m alembic upgrade head; then
        echo "✅ Migrations complete!"
    else
        echo "⚠️  Alembic migrations failed, trying direct table creation..."
        if python create_tables.py; then
            echo "✅ Tables created successfully via direct method!"
        else
            echo "❌ Failed to create tables, but continuing anyway..."
            echo "   The app will try to connect to the database directly"
        fi
    fi
else
    echo "⚠️  No alembic directory found, using direct table creation..."
    if python create_tables.py; then
        echo "✅ Tables created successfully!"
    else
        echo "❌ Failed to create tables"
    fi
fi

# Start the application
echo "🌐 Starting FastAPI server on port ${PORT:-8000}..."
cd /app
echo "Working directory for uvicorn: $(pwd)"
echo "main.py exists: $(test -f main.py && echo 'yes' || echo 'no')"
exec python -m uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
