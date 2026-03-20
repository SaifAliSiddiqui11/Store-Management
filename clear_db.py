from backend.database import SessionLocal, engine, Base
from backend.models import User, Vendor, Material, MaterialVariant, GateEntry, InwardProcess, InwardItem, InventoryLog, MaterialIssue, MaterialIssueItem, ReturnableEntry
import sqlalchemy as sa

def clear_data():
    db = SessionLocal()
    try:
        # Tables to clear in order (considering foreign keys)
        # We'll clear transaction tables first, then master data
        
        print("Clearing transaction tables...")
        db.query(InventoryLog).delete()
        db.query(MaterialIssueItem).delete()
        db.query(MaterialIssue).delete()
        db.query(InwardItem).delete()
        db.query(InwardProcess).delete()
        db.query(GateEntry).delete()
        db.query(ReturnableEntry).delete()
        
        print("Clearing master data (except users)...")
        db.query(MaterialVariant).delete()
        db.query(Material).delete()
        db.query(Vendor).delete()
        
        # If you want to keep users, we don't delete from User table.
        # But if you want a TRULY fresh start including users, uncomment below:
        # db.query(User).delete()
        
        db.commit()
        print("Database cleared successfully (Users preserved).")
    except Exception as e:
        db.rollback()
        print(f"Error clearing database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    clear_data()
