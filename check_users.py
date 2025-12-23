from backend.database import SessionLocal
from backend.models import User

db = SessionLocal()
users = db.query(User).all()
print(f"Total Users: {len(users)}")
for u in users:
    print(f"User: {u.username}, Role: {u.role}")
db.close()
