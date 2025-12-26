# ... imports ...
import sys
import os

# Add current directory to path
sys.path.append(os.getcwd())

def log(msg):
    with open("verification_result.txt", "a") as f:
        f.write(msg + "\n")
    print(msg) # Keep print just in case

try:
    # Clear log file
    with open("verification_result.txt", "w") as f:
        f.write("--- Starting Verification Log ---\n")

    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from backend import models, crud, schemas
    from backend.database import Base, DATABASE_URL
    import datetime
except Exception as e:
    log(f"IMPORT ERROR: {e}")
    sys.exit(1)

# Setup DB - Use a separate test DB to ensure fresh schema
TEST_DB_URL = "sqlite:///./test_store.db"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

# Ensure tables exist
Base.metadata.create_all(bind=engine)

def run_verification():
    log("--- Starting Verification Logic ---")

    # 1. Create Users
    log("1. Setting up Users...")
    try:
        officer = crud.create_user(db, schemas.UserCreate(username="test_officer_v1", email="off_v1@test.com", password="pass", role="OFFICER"))
        log("   Created Officer: test_officer_v1")
    except:
        db.rollback()
        officer = crud.get_user_by_username(db, "test_officer_v1")
        log("   Officer exists")

    try:
        manager = crud.create_user(db, schemas.UserCreate(username="test_manager_v1", email="mgr_v1@test.com", password="pass", role="STORE_MANAGER"))
        log("   Created Manager: test_manager_v1")
    except:
        db.rollback()
        manager = crud.get_user_by_username(db, "test_manager_v1")
        log("   Manager exists")

    try:
        security = crud.create_user(db, schemas.UserCreate(username="test_security_v1", email="sec_v1@test.com", password="pass", role="SECURITY"))
        log("   Created Security: test_security_v1")
    except:
        db.rollback()
        security = crud.get_user_by_username(db, "test_security_v1")
        log("   Security exists")


    # 2. Create Material
    log("2. Creating Material...")
    mat_code = f"MAT-{datetime.datetime.now().strftime('%M%S')}"
    material = crud.create_material(db, schemas.MaterialCreate(
        code=mat_code, name="Test Widget", category="SPARE", unit="Nos", min_stock_level=5
    ))
    log(f"   Created Material: {material.name} ({material.code})")

    # 3. Create Gate Entry
    log("3. Creating Gate Entry...")
    entry = crud.create_gate_entry(db, schemas.GateEntryCreate(
        vendor_name="Test Vendor",
        approx_quantity=10,
        request_officer_id=officer.id,
        material_type_desc="Widgets"
    ), created_by_id=security.id)
    log(f"   Created Entry: {entry.gate_pass_number}")

    # 4. Officer Approve Stage 1
    log("4. Officer Approval Stage 1...")
    entry = crud.update_gate_entry_status(db, entry, "APPROVED_STAGE_1")
    log(f"   Status: {entry.status}")

    # 5. Store Manager Process
    log("5. Store Manager Processing...")
    inward_data = schemas.InwardProcessCreate(
        invoice_no="INV-001",
        invoice_date=datetime.datetime.now(),
        remarks=" Verified",
        items=[
            schemas.InwardItemCreate(
                material_id=material.id,
                quantity_received=10,
                store_room="Room A", rack_no="R1", shelf_no="S1"
            )
        ]
    )
    entry = crud.process_store_entry(db, entry.id, inward_data, manager.id)
    log(f"   Status: {entry.status}")

    # 6. Verify Store View Logic

    # A. Check Officer View (Should see it)
    log(f"6A. Checking View for Officer ({officer.username})...")
    items_officer = crud.get_store_items(db, officer)
    found = False
    for item in items_officer:
        if item.material_code == material.code:
            found = True
            log(f"   [SUCCESS] Found item: {item.material_name}, Qty: {item.quantity}")
            if item.officer_name is not None:
                log("   [FAIL] Officer name should NOT be visible to officer (redundant/null in schema logic for self)")
    
    if not found:
        log("   [FAIL] Officer did not see their item!")

    # B. Check Manager View (Should see it AND officer name)
    log(f"6B. Checking View for Manager ({manager.username})...")
    items_manager = crud.get_store_items(db, manager)
    found = False
    for item in items_manager:
        if item.material_code == material.code:
            found = True
            log(f"   [SUCCESS] Found item: {item.material_name}")
            if item.officer_name == officer.username:
                log(f"   [SUCCESS] Officer Name visible: {item.officer_name}")
            else:
                 log(f"   [FAIL] Officer Name mismatch or missing! Got: {item.officer_name}")
    
    if not found:
        log("   [FAIL] Manager did not see the item!")

if __name__ == "__main__":
    try:
        run_verification()
    except Exception as e:
        log(f"RUNTIME ERROR: {e}")
        sys.exit(1)
