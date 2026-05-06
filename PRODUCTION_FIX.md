# Production Dashboard 500 Error Fix

## Problem
Your deployed app on Vercel is showing:
```
500 - Σφάλμα Συστήματος
React error #310
```

## Root Cause
React error #310 ("Element type is invalid") in production is typically caused by:
1. **Missing environment variables** - Components fail when API calls don't work
2. **Build configuration issues**
3. **CSP blocking resources**

## Immediate Fix - Set Environment Variables in Vercel

### Step 1: Go to Vercel Dashboard
1. Open https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**

### Step 2: Add Required Environment Variables

Add these environment variables:

```
VITE_API_BASE_URL=https://backend-l9el.onrender.com/api
```

Optional (if you're using them):
```
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
VITE_SENTRY_DSN=your_sentry_dsn_here
```

### Step 3: Redeploy
After adding environment variables:
1. Go to **Deployments** tab
2. Click the three dots (...) on the latest deployment
3. Click **Redeploy**
4. Select **Use existing Build Cache** (optional, faster)
5. Click **Redeploy**

## Verify Backend is Running

Your backend URL is: `https://backend-l9el.onrender.com`

Check if it's running:
```bash
curl https://backend-l9el.onrender.com/api/health
```

Or visit in browser:
```
https://backend-l9el.onrender.com/api/health
```

If the backend is down or sleeping (Render free tier), you need to:
1. Wake it up by visiting the URL
2. Or upgrade to a paid plan to prevent sleeping

## Check Backend Environment Variables

Make sure your Render backend has these environment variables set:

### Required:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Random 64+ character string
- `DB_ENCRYPTION_KEY` - Random 32+ character string
- `FRONTEND_URL` - Your Vercel frontend URL (e.g., `https://your-app.vercel.app`)
- `NODE_ENV=production`
- `PORT=4000` (or whatever Render assigns)

### For Features:
- `GEMINI_API_KEY` - For AI features
- `VONAGE_API_KEY` & `VONAGE_API_SECRET` - For SMS
- `N8N_WEBHOOK_URL` - For automation
- `REDIS_URL` - For background jobs (or set `DISABLE_REDIS=true`)
- `SMTP_*` - For email notifications

## Additional Checks

### 1. Check Browser Console
Open your deployed app and check the browser console (F12) for detailed error messages.

### 2. Check Network Tab
Look for failed API requests in the Network tab. If you see:
- **CORS errors** → Backend `FRONTEND_URL` is wrong
- **404 errors** → API endpoint doesn't exist
- **500 errors** → Backend is crashing
- **No requests** → `VITE_API_BASE_URL` is not set

### 3. Check Vercel Build Logs
Go to Vercel → Deployments → Click on deployment → View Build Logs
Look for any errors or warnings during build.

### 4. Check Render Logs
Go to Render → Your backend service → Logs
Look for errors when the app tries to start or handle requests.

## Common Production Issues

### Issue: "Failed to fetch" or CORS errors
**Cause:** Backend `FRONTEND_URL` doesn't match your Vercel URL
**Fix:** Update `FRONTEND_URL` in Render to match your Vercel domain exactly

### Issue: Backend returns 500 errors
**Cause:** Missing environment variables or database connection issues
**Fix:** Check Render logs and ensure all required env vars are set

### Issue: App loads but shows "Unauthorized" or redirects to login
**Cause:** JWT/auth issues, possibly due to cookie domain mismatch
**Fix:** Ensure `FRONTEND_URL` in backend matches your frontend domain

### Issue: Components render but data doesn't load
**Cause:** API calls failing silently
**Fix:** Check browser Network tab for failed requests

## CSP (Content Security Policy) Note

Your `vercel.json` has a strict CSP. If you add new external services, you may need to update it:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' https://accounts.google.com https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://backend-l9el.onrender.com https://*.onrender.com https://*.sentry.io; frame-src https://accounts.google.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
        }
      ]
    }
  ]
}
```

If you change your backend URL, update `connect-src` in the CSP.

## Quick Diagnostic Commands

### Test backend health:
```bash
curl https://backend-l9el.onrender.com/api/health
```

### Test backend auth endpoint:
```bash
curl https://backend-l9el.onrender.com/api/auth/status
```

### Check if environment variables are loaded in frontend:
Add this temporarily to your Dashboard component:
```javascript
console.log('API Base:', import.meta.env.VITE_API_BASE_URL);
```

Then check browser console after deployment.

## Still Not Working?

If the issue persists after setting environment variables and redeploying:

1. **Clear Vercel build cache:**
   - Redeploy with "Clear cache and redeploy" option

2. **Check for circular dependencies:**
   - Run `npm run build` locally and check for warnings

3. **Test locally with production build:**
   ```bash
   cd frontend
   npm run build
   npm run preview
   ```
   This runs the production build locally to test.

4. **Enable Sentry or add console logging:**
   - Add more detailed error logging to identify the exact component failing

5. **Simplify Dashboard temporarily:**
   - Comment out components one by one to identify which one is causing the error

## Contact Support

If you need help:
- Vercel Support: https://vercel.com/support
- Render Support: https://render.com/docs/support
- Check Render status: https://status.render.com/
