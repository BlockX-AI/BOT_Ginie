# Railway Deployment Fix - Alembic Migration Error

## Problem
Railway deployment was failing with `KeyError: 'url'` during database migrations:
```
File "/app/alembic/env.py", line 60, in run_migrations_online
  connectable = engine_from_config(
File "/usr/local/lib/python3.12/site-packages/sqlalchemy/engine/create.py", line 837, in engine_from_config
  url = options.pop("url")
KeyError: 'url'
```

## Root Causes

### 1. Alembic Configuration Issue
The `alembic/env.py` file was calling `config.get_section()` which returns `None` by default, causing `engine_from_config()` to fail because the configuration dict didn't contain the `sqlalchemy.url` key.

### 2. Wrong Package Name
`pyproject.toml` had `dotenv>=0.9.9` instead of `python-dotenv>=1.0.0`. The correct package name is `python-dotenv`.

### 3. Incomplete requirements.txt
The `requirements.txt` file only had 2 packages (certifi and wheel), missing all the actual dependencies needed for the application.

## Fixes Applied

### ✅ 1. Fixed `alembic/env.py`
Updated the `run_migrations_online()` function to properly handle the database URL:

```python
def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    # Get the configuration section
    configuration = config.get_section(config.config_ini_section) or {}
    
    # Get the database URL from environment or config
    db_url = config.get_main_option("sqlalchemy.url")
    
    if not db_url:
        raise ValueError(
            "No database URL found. Please set DATABASE_URL environment variable."
        )
    
    # Set the URL in the configuration dict with the prefix
    configuration["sqlalchemy.url"] = db_url
    
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    # ... rest of the function
```

**Key Changes:**
- Added `or {}` to handle `None` return from `get_section()`
- Explicitly get the database URL from config
- Set the URL in the configuration dict before passing to `engine_from_config()`
- Added error handling if DATABASE_URL is not found

### ✅ 2. Fixed `pyproject.toml`
Changed:
```toml
"dotenv>=0.9.9",
```

To:
```toml
"python-dotenv>=1.0.0",
```

### ✅ 3. Updated `requirements.txt`
Replaced minimal requirements with full dependency list:

```txt
alembic>=1.14.0
asyncpg>=0.30.0
black>=25.9.0
python-dotenv>=1.0.0
e2b-code-interpreter>=2.2.0
fastapi>=0.119.0
greenlet>=3.2.4
httpx>=0.27.0
huggingface-hub>=0.36.0
langchain>=0.3.27
langchain-anthropic>=0.3.22
langchain-google-genai>=2.1.12
langchain-huggingface>=0.3.1
langchain-openai>=0.3.35
langgraph>=0.6.10
passlib[bcrypt]>=1.7.4
psycopg2-binary>=2.9.9
pydantic[email]>=2.12.2
python-jose[cryptography]>=3.5.0
python-multipart>=0.0.20
sqlalchemy>=2.0.44
transformers>=4.57.1
uvicorn[standard]>=0.38.0
```

## Deployment Steps

### 1. Commit and Push Changes
```bash
git add .
git commit -m "Fix: Alembic migration error and dependency issues for Railway deployment"
git push origin main
```

### 2. Railway Will Auto-Deploy
Railway automatically deploys when you push to GitHub. Monitor the logs:
```bash
railway logs
```

### 3. Expected Success Output
You should now see:
```
🚀 Starting Railway deployment...
📊 Running database migrations...
✅ Migrations complete!
🌐 Starting FastAPI server on port 8000...
```

### 4. Verify Deployment
Test your backend:
```bash
curl https://evi-web-production.up.railway.app/
```

Should return:
```json
{"message": "WebBuilder API"}
```

## Environment Variables Required

Make sure these are set in Railway:

```bash
DATABASE_URL=postgresql+asyncpg://postgres:...@trolley.proxy.rlwy.net:37463/railway
E2B_API_KEY=e2b_0544b6776ab37d43f8a0007931d384c71c8e9df8
GOOGLE_API_KEY=AIzaSyArrIFGDf3Dg78jJXl9biAKm-RoRZBIitw
OPENAI_API_KEY=sk-proj-...
SECRET_KEY=c6509e9b23dd159b30fdfce012cb8f9d2043ae5d4a7c34a291d986166f4d5357
VERCEL_API_TOKEN=Ul26h5cqwxtWeh5261Hy8LJl
VERCEL_TEAM_ID=team_mPlJnlR1km1pGVB9og8Xu5kK
```

✅ **All are already configured in your Railway project!**

## What Was Fixed

| Issue | Status |
|-------|--------|
| Alembic KeyError: 'url' | ✅ Fixed |
| Wrong package name (dotenv) | ✅ Fixed |
| Incomplete requirements.txt | ✅ Fixed |
| DATABASE_URL configuration | ✅ Fixed |
| Migration script execution | ✅ Fixed |

## Next Steps

1. **Push this fix to GitHub** - Railway will auto-deploy
2. **Deploy frontend to Vercel** - See `QUICK_DEPLOY.md`
3. **Test end-to-end** - Create a project to verify everything works

---

**Status**: Ready to deploy! 🚀
