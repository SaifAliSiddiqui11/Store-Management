from sqlalchemy.orm import Session
from backend import models, auth, crud
from backend.models import UserRole

def seed_default_users(db: Session):
    # Dictionary of default users: username -> (password, role)
    default_users = {
        "admin": ("admin123", UserRole.ADMIN),
        "security": ("sec123", UserRole.SECURITY),
        "store": ("store123", UserRole.STORE_MANAGER),
        "officer": ("off123", UserRole.OFFICER),
        "Rajshekhar": ("off123", UserRole.OFFICER),
        "Nikhil": ("off123", UserRole.OFFICER)
    }

    for username, (password, role) in default_users.items():
        user = db.query(models.User).filter(models.User.username == username).first()
        if not user:
            print(f"Seeding user: {username}")
            hashed_pwd = crud.get_password_hash(password)
            new_user = models.User(
                username=username,
                hashed_password=hashed_pwd,
                role=role,
                is_active=True
            )
            db.add(new_user)
    
    db.commit()
