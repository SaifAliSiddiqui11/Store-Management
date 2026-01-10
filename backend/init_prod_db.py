"""
Production database initialization script.
This script should be run once during deployment to ensure the database 
schema is created and default users are seeded.
"""
from backend.database import SessionLocal, engine
from backend import models, crud
from backend.models import UserRole

def init_production_database():
    """Initialize database with schema and default users"""
    
    print("=" * 70)
    print("PRODUCTION DATABASE INITIALIZATION")
    print("=" * 70)
    
    # Step 1: Create all tables
    print("\n[1/3] Creating database tables...")
    models.Base.metadata.create_all(bind=engine)
    print("✓ Database tables created")
    
    # Step 2: Create database session
    print("\n[2/3] Opening database session...")
    db = SessionLocal()
    print("✓ Database session opened")
    
    # Step 3: Seed default users
    print("\n[3/3] Seeding default users...")
    
    default_users = [
        ("admin", "admin123", UserRole.ADMIN),
        ("security", "sec123", UserRole.SECURITY),
        ("officer", "off123", UserRole.OFFICER),
        ("store", "store123", UserRole.STORE_MANAGER),
        ("Rajshekhar", "off123", UserRole.OFFICER),
        ("Nikhil", "off123", UserRole.OFFICER),
    ]
    
    users_created = 0
    users_existing = 0
    
    for username, password, role in default_users:
        user = db.query(models.User).filter(models.User.username == username).first()
        
        if not user:
            print(f"  → Creating user: {username} ({role})")
            hashed_password = crud.get_password_hash(password)
            new_user = models.User(
                username=username,
                hashed_password=hashed_password,
                role=role,
                is_active=True
            )
            db.add(new_user)
            users_created += 1
        else:
            print(f"  ✓ User already exists: {username}")
            users_existing += 1
    
    # Commit all new users
    if users_created > 0:
        db.commit()
        print(f"\n✓ Successfully created {users_created} new user(s)")
    
    if users_existing > 0:
        print(f"✓ Found {users_existing} existing user(s)")
    
    # Verify
    total_users = db.query(models.User).count()
    print(f"\n{'=' * 70}")
    print(f"INITIALIZATION COMPLETE - Total users in database: {total_users}")
    print(f"{'=' * 70}\n")
    
    db.close()

if __name__ == "__main__":
    try:
        init_production_database()
    except Exception as e:
        print(f"\n✗ ERROR during initialization: {str(e)}")
        import traceback
        traceback.print_exc()
        exit(1)
