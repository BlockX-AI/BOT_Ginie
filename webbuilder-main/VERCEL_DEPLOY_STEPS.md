# Deploy Frontend to Vercel - Step by Step

## 🚀 Quick Deployment via Vercel Dashboard

### Step 1: Go to Vercel Dashboard
Visit: [https://vercel.com/new](https://vercel.com/new)

### Step 2: Import GitHub Repository
1. Click **"Import Git Repository"**
2. Find and select: `Satyam-10124/webbuilder-main`
3. Click **"Import"**

### Step 3: Configure Project
1. **Project Name**: `webbuilder-frontend` (or your choice)
2. **Framework Preset**: Next.js (should auto-detect)
3. **Root Directory**: Click **"Edit"** → Select `frontend` folder
4. **Build Command**: `npm run build` (default is fine)
5. **Output Directory**: `.next` (default is fine)

### Step 4: Add Environment Variables
Click **"Environment Variables"** and add these 3 variables:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_API_URL` | `https://evi-web-production.up.railway.app` |
| `NEXT_PUBLIC_WS_URL` | `wss://evi-web-production.up.railway.app` |
| `NEXT_PUBLIC_APP_NAME` | `WebBuilder` |

**Important**: Add these for **Production** environment

### Step 5: Deploy
1. Click **"Deploy"**
2. Wait 2-3 minutes for build to complete
3. You'll get a URL like: `https://webbuilder-frontend.vercel.app`

---

## ✅ After Deployment

### Test Your Frontend
1. Visit your Vercel URL
2. Try to sign up / login
3. Create a test project to verify backend connection

### Expected Result
- Frontend loads ✅
- Can create account ✅
- Can create projects ✅
- WebSocket connection works (real-time updates) ✅

---

## 🔧 If You Need to Update Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Edit variables
5. **Redeploy** from Deployments tab

---

## 📊 Your URLs

- **Backend (Railway)**: https://evi-web-production.up.railway.app
- **Frontend (Vercel)**: https://[your-project].vercel.app

---

## 🆘 Troubleshooting

**Problem**: Frontend can't connect to backend
- Check environment variables are set correctly
- Verify Railway backend is running
- Check CORS allows your Vercel URL (already configured to allow *.vercel.app)

**Problem**: Build fails
- Check if all dependencies are in package.json
- Look at build logs in Vercel dashboard

---

That's it! Your WebBuilder is now fully deployed! 🎉
