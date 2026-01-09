"""
Migration script to convert existing UTC timestamps to IST (UTC+5:30)
This script adds 5 hours and 30 minutes to all datetime fields in the database.
"""
import sqlite3
from datetime import datetime, timedelta

DATABASE_PATH = './store.db'

def migrate_utc_to_ist():
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    print("Starting UTC to IST migration...")
    
    # Migrate gate_entries.created_at
    print("\n1. Migrating gate_entries.created_at...")
    cursor.execute("""
        UPDATE gate_entries 
        SET created_at = datetime(created_at, '+5 hours', '+30 minutes')
        WHERE created_at IS NOT NULL
    """)
    print(f"   Updated {cursor.rowcount} records in gate_entries")
    
    # Migrate inventory_logs.created_at
    print("\n2. Migrating inventory_logs.created_at...")
    cursor.execute("""
        UPDATE inventory_logs 
        SET created_at = datetime(created_at, '+5 hours', '+30 minutes')
        WHERE created_at IS NOT NULL
    """)
    print(f"   Updated {cursor.rowcount} records in inventory_logs")
    
    # Migrate inward_processes.final_approved_at
    print("\n3. Migrating inward_processes.final_approved_at...")
    cursor.execute("""
        UPDATE inward_processes 
        SET final_approved_at = datetime(final_approved_at, '+5 hours', '+30 minutes')
        WHERE final_approved_at IS NOT NULL
    """)
    print(f"   Updated {cursor.rowcount} records in inward_processes")
    
    # Migrate inward_processes.invoice_date
    print("\n4. Migrating inward_processes.invoice_date...")
    cursor.execute("""
        UPDATE inward_processes 
        SET invoice_date = datetime(invoice_date, '+5 hours', '+30 minutes')
        WHERE invoice_date IS NOT NULL
    """)
    print(f"   Updated {cursor.rowcount} records in inward_processes")
    
    # Migrate inward_items.expiry_date
    print("\n5. Migrating inward_items.expiry_date...")
    cursor.execute("""
        UPDATE inward_items 
        SET expiry_date = datetime(expiry_date, '+5 hours', '+30 minutes')
        WHERE expiry_date IS NOT NULL
    """)
    print(f"   Updated {cursor.rowcount} records in inward_items")
    
    # Migrate material_issues.approved_at
    print("\n6. Migrating material_issues.approved_at...")
    cursor.execute("""
        UPDATE material_issues 
        SET approved_at = datetime(approved_at, '+5 hours', '+30 minutes')
        WHERE approved_at IS NOT NULL
    """)
    print(f"   Updated {cursor.rowcount} records in material_issues")
    
    # Commit changes
    conn.commit()
    
    # Verify a few records
    print("\n\nVerification - Latest gate_entries:")
    cursor.execute("""
        SELECT id, gate_pass_number, vendor_name, created_at 
        FROM gate_entries 
        ORDER BY id DESC 
        LIMIT 3
    """)
    for row in cursor.fetchall():
        print(f"   ID: {row[0]}, Gate Pass: {row[1]}, Vendor: {row[2]}, Created: {row[3]}")
    
    conn.close()
    print("\n✓ Migration completed successfully!")

if __name__ == "__main__":
    migrate_utc_to_ist()
