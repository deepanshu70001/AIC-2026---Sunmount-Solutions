# Deployment & Setup Guide - AIC-2026 Inventory Pro

## Overview
This guide covers deploying the Inventory Pro application to Render (backend) and Vercel (frontend).

---

## 🚀 Critical Setup Steps (Required Before Deployment)

### Step 1: Render Backend Setup

#### 1.1 Connect Repository
1. Go to [https://dashboard.render.com](https://dashboard.render.com)
2. Click **"New" → "Web Service"**
3. Connect your GitHub repository
4. Select the repository branch

#### 1.2 Configure Environment Variables
Click **Environment** and add the following variables:

```
DATABASE_URL = mongodb+srv://username:password@cluster.mongodb.net/inventory
JWT_SECRET = generate-a-random-32-character-secret-string (use: openssl rand -base64 32)
GROQ_API_KEY = your-groq-api-key-from-https://console.groq.com
CORS_ORIGINS = https://aic-2026-sunmount-solutions.vercel.app
```

**Important**: 
- `JWT_SECRET` must be a random 32+ character string (not production hardcoded)
- `CORS_ORIGINS` must match your Vercel frontend URL exactly
- Keep `DATABASE_URL` secret - never commit to git

#### 1.3 Verify Build Settings
- **Build Command**: `npm ci && npm run prisma:generate && npm run prisma:push && npm run build`
- **Start Command**: `npm run start`
- **Root Directory**: `backend`

#### 1.4 Deploy
Click **Deploy** and wait for the build to complete. Once deployed, you'll get a URL like:
```
https://inventory-pro-api.onrender.com
```

#### 1.5 Verify Deployment
Test the health endpoint:
```bash
curl https://inventory-pro-api.onrender.com/health
# Expected response: {"status":"ok"}
```

---

### Step 2: Vercel Frontend Setup

#### 2.1 Connect Repository
1. Go to [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Click **"Add New" → "Project"**
3. Import your GitHub repository
4. Select the repository and main branch

#### 2.2 Configure Build Settings
- **Framework**: **Vite**
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

#### 2.3 Add Environment Variables
Click **Environment Variables** and add:

```
VITE_API_BASE_URL = https://inventory-pro-api.onrender.com
```

**Important**: This must point to your Render backend URL (from Step 1.5)

#### 2.4 Deploy
Click **Deploy** and wait for completion. You'll get a URL like:
```
https://aic-2026-sunmount-solutions.vercel.app
```

#### 2.5 Verify Deployment
1. Open the Vercel URL in browser
2. You should see the Login page
3. Open browser DevTools (F12) → Network tab
4. Try logging in - you should see API calls to the Render backend

---

## 📝 Database Initialization

After deploying to Render, the database will be automatically initialized via the build command `prisma:push`. However, you may need to seed demo data:

### Option 1: Seed via Backend API (Recommended)
```bash
# SSH into Render instance or use curl
curl -X POST https://inventory-pro-api.onrender.com/api/seed \
  -H "Content-Type: application/json"
```

### Option 2: Run Seed Manually
If the API endpoint doesn't exist, SSH into your Render service:
```bash
npm run seed
```

### Default Test Credentials
After seeding:
```
Username: admin
Password: password123

Role: SYSTEM_ADMIN (full access)
```

---

## 🔐 Security Checklist  

Before going to production, ensure:

- [ ] **JWT_SECRET** is a random 32+ character string (not hardcoded)
- [ ] **DATABASE_URL** is kept secret in environment variables
- [ ] **CORS_ORIGINS** is set to your frontend domain only
- [ ] `.env` file is in `.gitignore` (never commit credentials)
- [ ] GROQ API key is rotated if previously exposed
- [ ] Database backups are configured (Render → Database settings)
- [ ] HTTPS is enabled (automatic on both Render and Vercel)

---

## 🧪 Testing After Deployment

### 1. Test Backend Health
```bash
curl https://inventory-pro-api.onrender.com/health
```

### 2. Test Login
1. Visit frontend URL: https://aic-2026-sunmount-solutions.vercel.app
2. Login with: `admin` / `password123`
3. Should redirect to dashboard

### 3. Check Network Requests
1. Open DevTools (F12) → Network tab
2. Login and watch API calls
3. Should see requests to `/api/login` returning `200 OK`
4. Should see Authorization headers with JWT token

### 4. Test Main Features
- [ ] Dashboard loads with widgets and charts
- [ ] Inventory page loads products
- [ ] Can create a new product
- [ ] Sales/Purchases tabs work
- [ ] CRDT sync page accessible
- [ ] Settings page accessible

---

## 🐛 Troubleshooting

### "Login failed" Error
**Possible Causes**:
1. Backend database not initialized
   - Solution: Render will auto-run migrations, but check logs
2. CORS_ORIGINS not set correctly
   - Solution: Verify frontend URL matches CORS_ORIGINS env var
3. Database connection failed
   - Solution: Verify DATABASE_URL is correct in Render environment

**Check Logs**:
```bash
# On Render dashboard, click your service → Logs
# Look for: "Backend APIs running on port 3001"
# Look for: "Prisma Client is already instantiated"
```

### "Network Error" on Frontend
**Possible Causes**:
1. VITE_API_BASE_URL not set on Vercel
   - Solution: Go to Vercel Project → Settings → Environment Variables
2. Backend service is down
   - Solution: Check Render dashboard for errors
3. Frontend deployed before backend ready
   - Solution: Redeploy frontend after backend is running

**Debug**:
```javascript
// Open browser console and check:
console.log(import.meta.env.VITE_API_BASE_URL)
// Should show: https://inventory-pro-api.onrender.com
```

### "Invalid authorization header"
**Cause**: Backend received malformed auth header
- **Solution**: Clear cookies and localStorage, try login again
  ```javascript
  // In browser console:
  localStorage.clear()
  sessionStorage.clear()
  location.reload()
  ```

---

## 📊 Expected Behavior After Setup

### Login Page
- ✅ Loads without errors
- ✅ Can enter username/password
- ✅ Displays error message if credentials wrong
- ✅ Redirects to dashboard on successful login

### Dashboard
- ✅ Shows KPI widgets (Products, Inventory Value, etc.)
- ✅ Displays activity feed
- ✅ Shows risk insights (stockouts, delayed purchases)
- ✅ Charts render properly

### Navigation
- ✅ Sidebar shows all menu items
- ✅ Can navigate between pages
- ✅ Top nav shows current user role
- ✅ Logout button works

---

## 🔄 Redeployment Steps

If you need to deploy updates:

### For Backend
1. Make changes to `backend/` files
2. Commit and push to GitHub
3. Render automatically rebuilds (unless you disabled auto-deploy)
4. Check Render logs to verify deployment success

### For Frontend
1. Make changes to `frontend/` files
2. Commit and push to GitHub
3. Vercel automatically rebuilds (unless you disabled auto-deploy)
4. Check Vercel deployment logs

**Manual Redeploy** (if auto-deploy disabled):
- Render: Dashboard → Service → Manual Deploy
- Vercel: Dashboard → Project → Deployments → Redeploy

---

## 🆘 Getting Help

If you encounter issues:

1. **Check environment variables** - Most issues are missing/incorrect env vars
2. **Check logs** - Render and Vercel both show detailed build/runtime logs
3. **Clear cache** - Browser cache can cause stale code
4. **Check DNS propagation** - If using custom domains
5. **Contact support**:
   - Render Support: https://render.com/support
   - Vercel Support: https://vercel.com/support

---

## 📋 Quick Reference

| Component | URL | Environment |
|-----------|-----|-------------|
| Backend API | https://inventory-pro-api.onrender.com | Render |
| Frontend App | https://aic-2026-sunmount-solutions.vercel.app | Vercel |
| Database | MongoDB Atlas | Cloud Hosted |
| API Docs | Same as backend `/api/*` | Backend |

---

## ✅ Final Verification Checklist

Before considering deployment complete:

- [ ] Backend deployed to Render with all env vars set
- [ ] Database migrations run successfully
- [ ] Database seeded with test data
- [ ] Frontend deployed to Vercel with VITE_API_BASE_URL set
- [ ] Login works with seed credentials
- [ ] Dashboard loads without errors
- [ ] All pages are accessible
- [ ] API calls show 200 status codes
- [ ] No CORS errors in browser console
- [ ] Error Boundary displays gracefully if component crashes
- [ ] All TypeScript builds complete without errors
