# 🚨 DEPLOYMENT LOGIN FIX GUIDE

## Problem Diagnosis

Your deployment login is failing because:
1. ❌ Users may not be created in the production database
2. ❌ Password hashes might not be compatible due to bcrypt version issues
3. ❌ The startup seeding may not be running properly

## Solution: Step-by-Step Fix

### Step 1: Check Your Deployment Health

Visit your deployed API and check the health endpoint:
```
https://your-deployment-url.com/health
```

This will show you:
- How many users exist in the database
- Which users are created
- If the database is connected

### Step 2: Run Database Initialization Script

On your deployment platform (e.g., Render, Heroku, etc.), run this command **ONCE**:

```bash
python backend/init_prod_db.py
```

This will:
- ✅ Create all database tables
- ✅ Create default users with correct password hashes
- ✅ Verify users are properly set up

### Step 3: Verify Users Were Created

After running the initialization, check the `/health` endpoint again to confirm users exist.

### Step 4: If Still Not Working - Manual Fix

If you can access your production database directly, run:

```bash
python backend/fix_users.py
```

This will:
- Check all existing users
- Verify passwords work correctly
- Fix any password hash mismatches
- Create missing users

## Default User Credentials

After initialization, these users should work:

| Username    | Password   | Role          |
|-------------|------------|---------------|
| admin       | admin123   | ADMIN         |
| security    | sec123     | SECURITY      |
| officer     | off123     | OFFICER       |
| store       | store123   | STORE_MANAGER |
| Rajshekhar  | off123     | OFFICER       |
| Nikhil      | off123     | OFFICER       |

## Deployment Platform Specific Instructions

### For Render:

1. Go to your service dashboard
2. Go to "Shell" tab
3. Run:
   ```bash
   python backend/init_prod_db.py
   ```

### For Heroku:

```bash
heroku run python backend/init_prod_db.py --app your-app-name
```

### For Railway:

```bash
railway run python backend/init_prod_db.py
```

### For Docker/Generic:

```bash
docker exec -it your-container-name python backend/init_prod_db.py
```

## Debugging Tips

### 1. Check Server Logs
Look for errors during startup, especially:
- Database connection errors
- Import errors
- User seeding errors

### 2. Verify Database File Exists
For SQLite deployments, ensure `store.db` is persisted and not wiped on each deploy.

### 3. Check Requirements
Ensure all dependencies in `requirements.txt` are installed:
```bash
pip install -r requirements.txt
```

### 4. Test Password Hashing Locally
Run this to test if bcrypt is working:
```python
from backend import crud
pwd = "admin123"
hashed = crud.get_password_hash(pwd)
print(f"Hash: {hashed}")
print(f"Verify: {crud.verify_password(pwd, hashed)}")
```

## Common Deployment Mistakes

❌ **Database is ephemeral** - SQLite file gets deleted on redeploy
   ✅ Use a persistent volume or PostgreSQL

❌ **Wrong Python version** - Using different Python version locally vs production
   ✅ Specify Python version in deployment config

❌ **Dependencies missing** - requirements.txt not complete
   ✅ Ensure all packages listed in `/Users/saifali/Documents/storeManagement/requirements.txt`

❌ **Startup script not running** - App starts before seeding completes
   ✅ The seed runs in `@app.on_event("startup")` - verify it executes

## Quick Test

After fixing, test the login endpoint:

```bash
curl -X POST "https://your-deployment-url.com/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin123"
```

You should get back a token like:
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer"
}
```

## Still Not Working?

1. Share your deployment platform (Render/Heroku/etc.)
2. Share the output from `/health` endpoint
3. Share any error logs from deployment
4. Share your deployment configuration (Dockerfile, render.yaml, etc.)

## Need Help?

Run these diagnostics and share the output:
```bash
# Check health
curl https://your-deployment-url.com/health

# Try login
curl -X POST "https://your-deployment-url.com/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin123"
```
