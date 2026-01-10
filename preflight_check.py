#!/usr/bin/env python3
"""
Deployment Pre-flight Checklist
Run this before deploying to catch common issues
"""
import os
import sys

def check_file_exists(filepath, description):
    """Check if a required file exists"""
    if os.path.exists(filepath):
        print(f"✅ {description}: {filepath}")
        return True
    else:
        print(f"❌ {description} MISSING: {filepath}")
        return False

def check_requirements():
    """Verify requirements.txt has all necessary packages"""
    required_packages = [
        'fastapi',
        'uvicorn',
        'sqlalchemy',
        'pydantic',
        'passlib',
        'bcrypt',
        'python-jose',
        'python-multipart',
        'email-validator'
    ]
    
    print("\n📦 Checking requirements.txt...")
    
    if not os.path.exists('requirements.txt'):
        print("❌ requirements.txt not found!")
        return False
    
    with open('requirements.txt', 'r') as f:
        content = f.read().lower()
    
    all_found = True
    for package in required_packages:
        if package.lower() in content:
            print(f"  ✅ {package}")
        else:
            print(f"  ❌ {package} MISSING")
            all_found = False
    
    return all_found

def check_backend_structure():
    """Verify backend folder structure"""
    print("\n📁 Checking backend structure...")
    
    required_files = [
        ('backend/main.py', 'Main application'),
        ('backend/database.py', 'Database config'),
        ('backend/models.py', 'Database models'),
        ('backend/schemas.py', 'Pydantic schemas'),
        ('backend/crud.py', 'CRUD operations'),
        ('backend/auth.py', 'Authentication'),
        ('backend/init_prod_db.py', 'Production DB init'),
    ]
    
    all_exist = True
    for filepath, description in required_files:
        if not check_file_exists(filepath, description):
            all_exist = False
    
    return all_exist

def check_imports():
    """Check if critical imports work"""
    print("\n🔍 Checking Python imports...")
    
    try:
        sys.path.insert(0, os.getcwd())
        
        print("  Importing backend.database...", end=" ")
        from backend import database
        print("✅")
        
        print("  Importing backend.models...", end=" ")
        from backend import models
        print("✅")
        
        print("  Importing backend.crud...", end=" ")
        from backend import crud
        print("✅")
        
        print("  Importing backend.auth...", end=" ")
        from backend import auth
        print("✅")
        
        return True
    except Exception as e:
        print(f"❌ Import failed: {e}")
        return False

def check_database_init():
    """Check if database initialization works"""
    print("\n🗄️  Checking database...")
    
    try:
        sys.path.insert(0, os.getcwd())
        from backend.database import SessionLocal, engine
        from backend import models
        
        # Try to create tables
        print("  Creating tables...", end=" ")
        models.Base.metadata.create_all(bind=engine)
        print("✅")
        
        # Try to connect
        print("  Testing connection...", end=" ")
        db = SessionLocal()
        user_count = db.query(models.User).count()
        db.close()
        print(f"✅ ({user_count} users)")
        
        return True
    except Exception as e:
        print(f"❌ Database error: {e}")
        return False

def main():
    print("=" * 70)
    print("DEPLOYMENT PRE-FLIGHT CHECKLIST")
    print("=" * 70)
    
    checks = []
    
    # Run all checks
    checks.append(("Requirements", check_requirements()))
    checks.append(("Backend Structure", check_backend_structure()))
    checks.append(("Python Imports", check_imports()))
    checks.append(("Database", check_database_init()))
    
    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    
    passed = 0
    total = len(checks)
    
    for check_name, result in checks:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {check_name}")
        if result:
            passed += 1
    
    print(f"\nResult: {passed}/{total} checks passed")
    
    if passed == total:
        print("\n🎉 All checks passed! Ready to deploy.")
        print("\nNext steps:")
        print("1. Commit your changes")
        print("2. Push to your deployment platform")
        print("3. Run 'python backend/init_prod_db.py' on production")
        print("4. Check /health endpoint")
        return 0
    else:
        print("\n⚠️  Some checks failed. Fix the issues before deploying.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
