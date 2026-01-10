"""
Script to check and fix user accounts in the database.
Run this manually to verify or recreate users with correct password hashes.
"""
from backend.database import SessionLocal
from backend import models, crud
from backend.models import UserRole

def check_and_fix_users():
    db = SessionLocal()
    
    print("=" * 60)
    print("Checking Database Users...")
    print("=" * 60)
    
    # Check existing users
    existing_users = db.query(models.User).all()
    print(f"\n✓ Total Users in Database: {len(existing_users)}")
    
    if existing_users:
        print("\nExisting Users:")
        for user in existing_users:
            print(f"  - Username: {user.username}, Role: {user.role}, Active: {user.is_active}")
    
    # Define default users
    default_users = [
        ("admin", "admin123", UserRole.ADMIN),
        ("security", "sec123", UserRole.SECURITY),
        ("officer", "off123", UserRole.OFFICER),
        ("store", "store123", UserRole.STORE_MANAGER),
        ("Rajshekhar", "off123", UserRole.OFFICER),
        ("Nikhil", "off123", UserRole.OFFICER),
    ]
    
    print("\n" + "=" * 60)
    print("Verifying/Creating Default Users...")
    print("=" * 60)
    
    for username, password, role in default_users:
        user = db.query(models.User).filter(models.User.username == username).first()
        
        if user:
            print(f"\n✓ User '{username}' exists")
            
            # Verify password works
            if crud.verify_password(password, user.hashed_password):
                print(f"  ✓ Password verified successfully")
            else:
                print(f"  ✗ PASSWORD MISMATCH DETECTED!")
                print(f"  → Updating password hash for '{username}'...")
                
                # Fix the password
                user.hashed_password = crud.get_password_hash(password)
                db.commit()
                
                # Verify again
                if crud.verify_password(password, user.hashed_password):
                    print(f"  ✓ Password fixed and verified!")
                else:
                    print(f"  ✗ Still not working - bcrypt issue?")
        else:
            print(f"\n✗ User '{username}' NOT FOUND")
            print(f"  → Creating user '{username}'...")
            
            # Create user
            hashed_password = crud.get_password_hash(password)
            new_user = models.User(
                username=username,
                hashed_password=hashed_password,
                role=role,
                is_active=True
            )
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            
            # Verify
            if crud.verify_password(password, new_user.hashed_password):
                print(f"  ✓ User created and password verified!")
            else:
                print(f"  ✗ User created but password verification failed!")
    
    print("\n" + "=" * 60)
    print("Final User Count:")
    print("=" * 60)
    final_users = db.query(models.User).all()
    print(f"Total Users: {len(final_users)}")
    for user in final_users:
        print(f"  - {user.username} ({user.role})")
    
    db.close()
    print("\n✓ Done!\n")

if __name__ == "__main__":
    check_and_fix_users()
