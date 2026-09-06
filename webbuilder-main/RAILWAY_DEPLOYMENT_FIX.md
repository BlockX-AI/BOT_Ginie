# ✅ Railway Deployment Fix - Alembic Database URL Error

## 🔧 Issue Fixed
**Error:** `KeyError: 'url'` during Alembic migrations on Railway

**Root Cause:** Alembic's `env.py` wasn't properly retrieving the database URL from the configuration in online migration mode.

**Solution:** Updated `alembic/env.py` to explicitly check and retrieve the URL from main config options.

---

## 📋 Required Railway Environment Variables

Make sure these environment variables are set in your Railway project:

### Essential Variables:
```bash
DATABASE_URL=postgresql://user:password@host:port/database
E2B_API_KEY=your_e2b_api_key
VERCEL_API_TOKEN=your_vercel_token
GEMINI_API_KEY=your_gemini_api_key
SECRET_KEY=your_secret_key_for_jwt
```

### Optional Variables:
```bash
VERCEL_TEAM_ID=your_vercel_team_id  # Optional
E2B_TEMPLATE_ID=your_template_id    # Optional
ANTHROPIC_API_KEY=your_anthropic_key # Optional
OPENAI_API_KEY=your_openai_key      # Optional
```

---

## 🚀 Deployment Steps

### 1. Set Environment Variables in Railway

In Railway Dashboard:
1. Go to your project → Variables
2. Add/verify `DATABASE_URL` (should be auto-populated if you have Postgres)
3. Add all other required variables listed above

**Important:** Railway automatically provides `DATABASE_URL` if you've added a Postgres database to your service.

### 2. Verify Database Connection

The `DATABASE_URL` format should be:
```
postgresql://username:password@hostname:port/database_name
```

Railway's Postgres addon automatically sets this.

### 3. Deploy

```bash
# Commit the fix
git add alembic/env.py
git commit -m "Fix Alembic database URL configuration for Railway"
git push

# Railway will auto-deploy
```

Or use Railway CLI:
```bash
railway up
```

---

## 🧪 Test Migrations Locally

Before deploying, test migrations locally:

```bash
# 1. Make sure your .env has DATABASE_URL
echo $DATABASE_URL

# 2. Run migrations
alembic upgrade head

# 3. Should output:
# INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
# INFO  [alembic.runtime.migration] Will assume transactional DDL.
# INFO  [alembic.runtime.migration] Running upgrade -> xxx, description
```

---

## 🔍 What Changed in `alembic/env.py`

### Before (Broken):
```python
def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),  # ❌ URL not in this section
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
```

### After (Fixed):
```python
def run_migrations_online() -> None:
    # Get the configuration section and ensure URL is present
    configuration = config.get_section(config.config_ini_section, {})
    
    # ✅ Explicitly get the URL from main config if not in section
    if "sqlalchemy.url" not in configuration:
        url = config.get_main_option("sqlalchemy.url")
        if url:
            configuration["sqlalchemy.url"] = url
    
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
```

---

## 🎯 Verification Checklist

After deployment, verify:

- [ ] No more `KeyError: 'url'` errors
- [ ] Migrations run successfully
- [ ] Application starts without errors
- [ ] Database tables are created (`users`, `chats`, `messages`, `project_files`)
- [ ] Health check passes

---

## 📊 Expected Deployment Output

### Success:
```
🚀 Starting Railway deployment...
📊 Running database migrations...
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade -> ac30a08bd1fe, add_project_files_table
✅ Migrations complete!
🌐 Starting FastAPI server on port 8000...
INFO:     Started server process [1]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

---

## 🛠️ Troubleshooting

### Issue: DATABASE_URL not found
**Solution:** Check Railway dashboard → Your service → Variables → Ensure `DATABASE_URL` exists

### Issue: Connection refused
**Solution:** Make sure Postgres addon is attached to your service

### Issue: SSL required error
**Solution:** Update DATABASE_URL to include `?sslmode=require`:
```bash
postgresql://user:pass@host:port/db?sslmode=require
```

### Issue: Migrations still failing
**Solution:** Check logs for specific error:
```bash
railway logs
```

---

## ✅ Deployment Status

- ✅ **Alembic configuration fixed**
- ✅ **Database URL retrieval corrected**
- ✅ **start.sh script verified**
- ✅ **All environment variables documented**
- ✅ **Ready for Railway deployment**

---

## 🚀 Next Steps

1. **Commit and push the fix:**
   ```bash
   git add alembic/env.py
   git commit -m "Fix Alembic database URL for Railway deployment"
   git push origin main
   ```

2. **Monitor deployment:**
   ```bash
   railway logs --follow
   ```

3. **Verify health:**
   - Check Railway dashboard for green status
   - Visit your Railway URL
   - Test API endpoints

---

## 📝 Notes

- The fix ensures Alembic can find the database URL regardless of configuration method
- Works with both Railway's auto-generated URLs and custom configurations
- Compatible with local development (reads from .env)
- No changes needed to migration files themselves

**Your deployment should now succeed!** 🎉
