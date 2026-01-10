"""
Quick test script to verify login credentials work.
This tests the password hashing and verification without needing the full API.
"""
import sys
sys.path.insert(0, '/Users/saifali/Documents/storeManagement')

from backend.database import SessionLocal
from backend import models, crud

def test_login(username: str, password: str):
    """Test if a username/password combination works"""
    db = SessionLocal()
    
    # Get user
    user = db.query(models.User).filter(models.User.username == username).first()
    
    if not user:
        print(f"❌ User '{username}' not found in database")
        db.close()
        return False
    
    # Verify password
    if crud.verify_password(password, user.hashed_password):
        print(f"✅ Login successful for '{username}' ({user.role})")
        db.close()
        return True
    else:
        print(f"❌ Invalid password for '{username}'")
        db.close()
        return False

def test_all_default_users():
    """Test all default user credentials"""
    print("=" * 60)
    print("TESTING DEFAULT USER CREDENTIALS")
    print("=" * 60)
    print()
    
    default_credentials = [
        ("admin", "admin123"),
        ("security", "sec123"),
        ("officer", "off123"),
        ("store", "store123"),
        ("Rajshekhar", "off123"),
        ("Nikhil", "off123"),
    ]
    
    results = []
    for username, password in default_credentials:
        print(f"Testing: {username} / {password}")
        success = test_login(username, password)
        results.append((username, success))
        print()
    
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    for username, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"  {status} - {username}")
    
    print()
    print(f"Total: {passed}/{total} credentials working")
    print("=" * 60)
    
    return passed == total

if __name__ == "__main__":
    all_passed = test_all_default_users()
    sys.exit(0 if all_passed else 1)
