from backend.database import SessionLocal, engine
from backend import models
from backend import crud
from backend.schemas import UserCreate
from backend.models import UserRole

def init_db():
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Create default users if they don't exist
    users = [
        ("admin", "admin123", UserRole.ADMIN),
        ("security", "sec123", UserRole.SECURITY),
        ("officer", "off123", UserRole.OFFICER),
        ("store", "store123", UserRole.STORE_MANAGER),
    ]

    for username, password, role in users:
        user = crud.get_user_by_username(db, username)
        if not user:
            print(f"Creating user: {username}")
            crud.create_user(db, UserCreate(
                username=username,
                password=password,
                role=role,
                is_active=True
            ))
        else:
            print(f"User {username} already exists")

    db.close()

if __name__ == "__main__":
    print("Initializing database...")
    init_db()
    print("Database initialization complete.")
