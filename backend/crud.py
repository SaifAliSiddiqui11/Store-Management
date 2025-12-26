from sqlalchemy.orm import Session
from backend.models import User, GateEntry, UserRole, InwardProcess, InwardItem
from backend import schemas
from backend import models
from passlib.context import CryptContext
import uuid
import datetime

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_user_by_username(db: Session, username: str):
    return db.query(User).filter(User.username == username).first()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = get_password_hash(user.password)
    db_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        role=user.role,
        is_active=user.is_active
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def create_gate_entry(db: Session, entry: schemas.GateEntryCreate, created_by_id: int):
    # Generate a simple Gate Pass Number (e.g., GP-UUID-Prefix or similar)
    # For simplicity, using a random UUID based string or timestamp could work, 
    # but let's stick to a simple prefix + random for now.
    gate_pass_no = f"GP-{str(uuid.uuid4())[:8].upper()}"
    
    db_entry = GateEntry(
        gate_pass_number=gate_pass_no,
        vendor_name=entry.vendor_name,
        vendor_location=entry.vendor_location,
        vehicle_number=entry.vehicle_number,
        driver_name=entry.driver_name,
        driver_phone=entry.driver_phone,
        material_type_desc=entry.material_type_desc,
        approx_quantity=entry.approx_quantity,
        created_by_id=created_by_id,
        request_officer_id=entry.request_officer_id,
        status="PENDING_OFFICER_APPROVAL_1"
    )
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry

def get_pending_gate_entries_for_officer(db: Session, officer_id: int):
    return db.query(GateEntry).filter(
        GateEntry.request_officer_id == officer_id,
        GateEntry.status == "PENDING_OFFICER_APPROVAL_1"
    ).all()

def update_gate_entry_status(db: Session, entry: GateEntry, status: str):
    entry.status = status
    db.commit()
    db.refresh(entry)
    return entry

def get_pending_store_entries(db: Session):
    return db.query(GateEntry).filter(
        GateEntry.status == "APPROVED_STAGE_1"
    ).all()

def process_store_entry(db: Session, entry_id: int, data: schemas.InwardProcessCreate, user_id: int):
    # 1. Verify Entry
    entry = db.query(GateEntry).filter(GateEntry.id == entry_id).first()
    if not entry or entry.status != "APPROVED_STAGE_1":
        return None # Or raise Error
        
    # 2. Create Inward Process
    inward_process = models.InwardProcess(
        gate_entry_id=entry.id,
        invoice_no=data.invoice_no,
        invoice_date=data.invoice_date,
        physical_check_done=True,
        remarks=data.remarks
    )
    db.add(inward_process)
    db.flush() # Get ID
    
    # 3. Add Items
    for item in data.items:
        db_item = models.InwardItem(
            inward_process_id=inward_process.id,
            material_id=item.material_id,
            quantity_received=item.quantity_received,
            store_room=item.store_room,
            rack_no=item.rack_no,
            shelf_no=item.shelf_no
        )
        db.add(db_item)
    
    # 4. Update Main Entry Status
    entry.status = "PENDING_OFFICER_FINAL_APPROVAL"
    
    db.commit()
    db.refresh(entry)
    return entry

def get_pending_final_approval_entries(db: Session, officer_id: int):
    return db.query(GateEntry).filter(
        GateEntry.request_officer_id == officer_id,
        GateEntry.status == "PENDING_OFFICER_FINAL_APPROVAL"
    ).all()

def final_approve_gate_entry(db: Session, entry_id: int, officer_id: int):
    entry = db.query(GateEntry).filter(GateEntry.id == entry_id).first()
    
    if not entry or entry.status != "PENDING_OFFICER_FINAL_APPROVAL":
        return None
    
    # 1. Update InwardProcess
    inward = entry.inward_process
    if inward:
        inward.final_approved_by_id = officer_id
        inward.final_approved_at = datetime.datetime.now()
        
        # 2. Update Stock & Create Logs
        for item in inward.items:
            # Update Material Stock
            material = db.query(models.Material).filter(models.Material.id == item.material_id).first()
            if material:
                material.current_stock += item.quantity_received
                
                # Create Log
                log = models.InventoryLog(
                    material_id=material.id,
                    change_quantity=item.quantity_received,
                    balance_after=material.current_stock,
                    transaction_type="INWARD",
                    reference_id=entry.gate_pass_number,
                    created_by_id=officer_id
                )
                db.add(log)
    
    # 3. Update Status
    entry.status = "FINAL_APPROVED"
    
    db.commit()
    db.refresh(entry)
    return entry

def request_issue(db: Session, issue: schemas.MaterialIssueCreate, user_id: int):
    db_issue = models.MaterialIssue(
        material_id=issue.material_id,
        quantity_requested=issue.quantity_requested,
        purpose=issue.purpose,
        requesting_dept=issue.requesting_dept,
        requested_by_id=user_id,
        status="PENDING_OFFICER_APPROVAL"
    )
    db.add(db_issue)
    db.commit()
    db.refresh(db_issue)
    return db_issue

def get_pending_issues(db: Session):
    return db.query(models.MaterialIssue).filter(models.MaterialIssue.status == "PENDING_OFFICER_APPROVAL").all()

def approve_issue(db: Session, issue_id: int, officer_id: int):
    issue = db.query(models.MaterialIssue).filter(models.MaterialIssue.id == issue_id).first()
    if not issue or issue.status != "PENDING_OFFICER_APPROVAL":
        return None
        
    material = db.query(models.Material).filter(models.Material.id == issue.material_id).first()
    if not material:
        return None # Error
        
    # Check Stock
    if material.current_stock < issue.quantity_requested:
         # In real app, might reject or partial approve. Here let's assume strict check.
         # For MVP, we might want to return a specific error, but keeping it simple.
         return None # Or raise specific error for low stock
         
    # Deduct Stock
    material.current_stock -= issue.quantity_requested
    
    # Create Log
    log = models.InventoryLog(
        material_id=material.id,
        change_quantity=-issue.quantity_requested,
        balance_after=material.current_stock,
        transaction_type="ISSUE",
        reference_id=f"ISS-{issue.id}",
        created_by_id=officer_id
    )
    db.add(log)
    
    # Update Issue
    issue.status = "APPROVED"
    issue.approved_by_id = officer_id
    issue.issue_note_id = f"NOTE-{uuid.uuid4().hex[:8].upper()}"
    
    db.commit()
    db.refresh(issue)
    return issue

def get_materials(db: Session):
    return db.query(models.Material).all()

def create_material(db: Session, material: schemas.MaterialCreate):
    db_material = models.Material(
        code=material.code,
        name=material.name,
        description=material.description,
        category=material.category,
        unit=material.unit,
        min_stock_level=material.min_stock_level,
        current_stock=0
    )
    db.add(db_material)
    db.commit()
    db.refresh(db_material)
    return db_material

# --- Store View Logic ---
def get_store_items(db: Session, user: models.User):
    """
    Get inventory items with role-based visibility.
    - Officer: Only items where they were the requesting officer.
    - Store Manager: All items, showing the requesting officer's name.
    """
    
    # Base Query: Join InwardItem -> InwardProcess -> GateEntry -> Material
    # Also join Officer (User) via GateEntry.request_officer_id to get officer name
    
    query = db.query(
        models.InwardItem,
        models.Material,
        models.User.username.label("officer_username"),
        models.InwardProcess.invoice_date.label("inward_date") # Using invoice_date
    ).join(
        models.InwardProcess, models.InwardItem.inward_process_id == models.InwardProcess.id
    ).join(
        models.GateEntry, models.InwardProcess.gate_entry_id == models.GateEntry.id
    ).join(
        models.Material, models.InwardItem.material_id == models.Material.id
    ).outerjoin( # Outer join in case officer is missing (unlikely but safe)
        models.User, models.GateEntry.request_officer_id == models.User.id
    )
    
    # Filter by Role
    if user.role == models.UserRole.OFFICER:
        query = query.filter(models.GateEntry.request_officer_id == user.id)
    
    # Execute
    results = query.all()
    
    # Transform to Schema
    response = []
    for item, material, officer_name, inward_date in results:
        response.append(schemas.StoreItemResponse(
            id=item.id,
            material_name=material.name,
            material_code=material.code,
            category=material.category,
            quantity=item.quantity_received, # Showing original inward qty as per item record. NOTE: Current stock is on Material level, but request asked for "whatever is storing... corresponding to that material". If they want *current* stock filtered by officer, that's complex because stock is pooled. Assuming they want to see the *inward entries* they are responsible for.
            unit=material.unit,
            store_room=item.store_room,
            rack_no=item.rack_no,
            shelf_no=item.shelf_no,
            inward_date=inward_date, # Or InwardProcess.created_at (not defined in model yet, need check)
            officer_name=officer_name if user.role == models.UserRole.STORE_MANAGER else None
        ))
        
    return response
