# Quick Deploy - Your Existing Setup

Based on your Railway environment variables, here's what you need to do to complete the deployment.

## ✅ Backend (Railway) - Already Configured

Your Railway backend is already set up with:
- Database: `postgresql+asyncpg://postgres:...@trolley.proxy.rlwy.net:37463/railway`
- E2B API Key: ✓ Configured
- Google API Key: ✓ Configured
- OpenAI API Key: ✓ Configured
- Vercel Integration: ✓ Token and Team ID set
- Public Domain: `evi-web-production.up.railway.app`

**No changes needed on Railway!** Your backend is ready.

---

## 🔧 Frontend (Vercel) - Action Required

### Step 1: Deploy Frontend to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Set **Root Directory** to `frontend`
5. Click **"Deploy"**

### Step 2: Set Environment Variables on Vercel

In Vercel Project Settings → Environment Variables, add:

```bash
NEXT_PUBLIC_API_URL=https://evi-web-production.up.railway.app
NEXT_PUBLIC_WS_URL=wss://evi-web-production.up.railway.app
NEXT_PUBLIC_APP_NAME=WebBuilder
```

### Step 3: Redeploy

After adding environment variables, go to **Deployments** and click **"Redeploy"**.

---

## 📋 Files Created

I've created the following files to make your deployment ready:

1. **`frontend/vercel.json`** - Vercel deployment configuration
2. **`frontend/.env.production`** - Production environment (points to your Railway backend)
3. **`frontend/.env.example`** - Example for local development
4. **Updated `main.py`** - CORS now supports all Vercel domains (*.vercel.app)

---

## 🚀 That's It!

Your deployment is ready. Just:
1. Push this repo to GitHub
2. Deploy frontend on Vercel
3. Add the 3 environment variables
4. Test your app!

---

## 🔗 Your URLs

- **Backend API**: https://evi-web-production.up.railway.app
- **Frontend**: (will be) https://your-project.vercel.app

---

For detailed instructions, see `DEPLOYMENT_GUIDE.md`.
