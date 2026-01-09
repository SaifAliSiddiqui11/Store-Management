from sqlalchemy import create_engine, text
from backend.database import DATABASE_URL

def fix_schema():
    print(f"Connecting to {DATABASE_URL}...")
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        print("Checking if 'vendor_location' needs to be added...")
        try:
            # Try to add the column. 
            # Note: SQLite does not support IF NOT EXISTS for ADD COLUMN directly in all versions or via simple syntax wrapper,
            # but running it blindly will fail safely if it exists (or we can catch it).
            # Actually, let's just try to add it.
            conn.execute(text("ALTER TABLE gate_entries ADD COLUMN vendor_location VARCHAR"))
            print("Successfully added 'vendor_location' column.")
        except Exception as e:
            if "duplicate column name" in str(e):
                print("Column 'vendor_location' already exists.")
            else:
                print(f"Error adding column: {e}")

        # Add columns to inward_items
        new_columns = [
            ("material_description", "VARCHAR"),
            ("material_category", "VARCHAR"),
            ("material_unit", "VARCHAR"),
            ("min_stock_level", "INTEGER")
        ]
        
        for col_name, col_type in new_columns:
            try:
                print(f"Adding column '{col_name}' to 'inward_items'...")
                conn.execute(text(f"ALTER TABLE inward_items ADD COLUMN {col_name} {col_type}"))
                print(f"Successfully added '{col_name}'.")
            except Exception as e:
                if "duplicate column name" in str(e):
                    print(f"Column '{col_name}' already exists.")
                else:
                    print(f"Error adding column {col_name}: {e}")

        # Check for other potential missing columns based on models.py (just in case)
        # InwardProcess.created_at was missing in verification? No, it was just not in model.
        # But wait, verification script failed earlier saying InwardProcess has no attribute created_at.
        # Check if InwardProcess table needs patching? Implementation plan didn't change it much.
        # Let's stick to the reported user error first.

fix_schema()
