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

def get_all_officers(db: Session):
    """Get all active officers for dropdown selection"""
    return db.query(models.User).filter(
        models.User.role == models.UserRole.OFFICER,
        models.User.is_active == True
    ).all()

def create_user_by_admin(db: Session, user_data: schemas.UserCreateByAdmin):
    """Admin creates a new user with specified role"""
    hashed_password = get_password_hash(user_data.password)
    db_user = models.User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
        role=user_data.role.value,  # Convert enum to string
        is_active=True
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
        
    # Update Gate Entry Vendor Name if provided
    if data.vendor_name:
        entry.vendor_name = data.vendor_name

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
            shelf_no=item.shelf_no,
            # Save directly to Item
            material_description=item.material_description,
            material_category=item.material_category,
            material_unit=item.material_unit,
            min_stock_level=item.min_stock_level
        )
        db.add(db_item)

        # Update Material Master if linked (Backwards compatibility or if we re-enable linking)
        if item.material_id:
            material = db.query(models.Material).filter(models.Material.id == item.material_id).first()
            if material:
                if item.material_description:
                    material.description = item.material_description
                if item.material_category:
                    material.category = item.material_category
                if item.material_unit:
                    material.unit = item.material_unit
                if item.min_stock_level is not None:
                    material.min_stock_level = item.min_stock_level
    
    # 4. Update Main Entry Status
    entry.status = "PENDING_OFFICER_FINAL_APPROVAL"
    
    db.commit()
    db.refresh(entry)
    return entry

def get_pending_final_approval_entries(db: Session, officer_id: int):
    from sqlalchemy.orm import joinedload
    
    return db.query(GateEntry).options(
        joinedload(GateEntry.inward_process).joinedload(models.InwardProcess.items).joinedload(models.InwardItem.material)
    ).filter(
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
    db.commit()
    return entry

def reject_gate_entry_final(db: Session, entry_id: int, officer_id: int, remarks: str):
    entry = db.query(GateEntry).filter(GateEntry.id == entry_id).first()
    
    if not entry or entry.status != "PENDING_OFFICER_FINAL_APPROVAL":
        return None
    
    # Update Status and Remarks
    entry.status = "REJECTED"
    
    # Add remarks to InwardProcess if exists, or append to gate entry somehow.
    # Prefer updating InwardProcess remarks or GateEntry remarks.
    # GateEntry has 'remarks' field? Let's check models.py lines 60+.
    # Assuming GateEntry doesn't have remarks, or we can use InwardProcess.remarks.
    if entry.inward_process:
        entry.inward_process.remarks = f"{entry.inward_process.remarks} | REJECTED: {remarks}" if entry.inward_process.remarks else f"REJECTED: {remarks}"
        entry.inward_process.final_approved_by_id = officer_id
        entry.inward_process.final_approved_at = datetime.datetime.now() # Though rejected, we track who actioned it.
        
    db.commit()
    db.refresh(entry)
    return entry

def update_inward_process(db: Session, entry_id: int, update_data: schemas.InwardProcessUpdate):
    entry = db.query(GateEntry).filter(GateEntry.id == entry_id).first()
    if not entry or not entry.inward_process:
        return None
    
    inward = entry.inward_process
    
    # Update Inward fields
    if update_data.invoice_no is not None:
        inward.invoice_no = update_data.invoice_no
    if update_data.invoice_date is not None:
        inward.invoice_date = update_data.invoice_date
    if update_data.remarks is not None:
        inward.remarks = update_data.remarks
        
    # Update Items
    for item_update in update_data.items:
        # Find the item
        item = db.query(models.InwardItem).filter(models.InwardItem.id == item_update.id, models.InwardItem.inward_process_id == inward.id).first()
        if item:
            if item_update.quantity_received is not None:
                item.quantity_received = item_update.quantity_received
            if item_update.store_room is not None:
                item.store_room = item_update.store_room
            if item_update.rack_no is not None:
                item.rack_no = item_update.rack_no
            if item_update.shelf_no is not None:
                item.shelf_no = item_update.shelf_no
            if item_update.material_description is not None:
                item.material_description = item_update.material_description
            if item_update.material_category is not None:
                item.material_category = item_update.material_category
            if item_update.material_unit is not None:
                item.material_unit = item_update.material_unit

    db.commit()
    return entry

def request_issue(db: Session, issue: schemas.MaterialIssueCreate, user_id: int):
    db_issue = models.MaterialIssue(
        material_id=issue.material_id,
        quantity_requested=issue.quantity_requested,
        purpose=issue.purpose,
        requesting_dept=issue.requesting_dept,
        officer_id=issue.officer_id,
        requested_by_id=user_id,
        status="PENDING_OFFICER_APPROVAL"
    )
    db.add(db_issue)
    db.commit()
    db.refresh(db_issue)
    return db_issue

def get_pending_issues(db: Session, officer_id: int):
    from sqlalchemy.orm import joinedload
    
    # Explicitly query with joinedload to ensure material is loaded
    results = db.query(models.MaterialIssue).options(
        joinedload(models.MaterialIssue.material)
    ).filter(
        models.MaterialIssue.officer_id == officer_id,
        models.MaterialIssue.status == "PENDING_OFFICER_APPROVAL"
    ).all()
    
    # Force load the material relationship
    for issue in results:
        _ = issue.material  # Access the relationship to ensure it's loaded
    
    return results
    
def get_officer_approved_issues(db: Session, officer_id: int):
    from sqlalchemy.orm import joinedload
    
    # Query executed and approved issues by this officer
    issues = db.query(models.MaterialIssue).options(
        joinedload(models.MaterialIssue.material)
    ).filter(
        models.MaterialIssue.officer_id == officer_id,
        models.MaterialIssue.status == "APPROVED"
    ).order_by(models.MaterialIssue.approved_at.desc()).all()
    
    # Force load relationship
    for issue in issues:
        _ = issue.material
        
    return issues

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
    issue.approved_at = datetime.datetime.now()
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
    
    Only shows items from FINAL_APPROVED gate entries.
    """
    
    # Base Query: Join InwardItem -> InwardProcess -> GateEntry -> Material (LEFT JOIN)
    # Also join Officer (User) via GateEntry.request_officer_id to get officer name
    
    query = db.query(
        models.InwardItem,
        models.Material,
        models.User.username.label("officer_username"),
        models.InwardProcess.invoice_date.label("inward_date"),
        models.GateEntry.status
    ).join(
        models.InwardProcess, models.InwardItem.inward_process_id == models.InwardProcess.id
    ).join(
        models.GateEntry, models.InwardProcess.gate_entry_id == models.GateEntry.id
    ).outerjoin( # LEFT JOIN for Material - may be NULL
        models.Material, models.InwardItem.material_id == models.Material.id
    ).outerjoin( # Outer join in case officer is missing (unlikely but safe)
        models.User, models.GateEntry.request_officer_id == models.User.id
    )
    
    # CRITICAL: Only show items from FINAL_APPROVED entries
    query = query.filter(models.GateEntry.status == "FINAL_APPROVED")
    
    # Filter by Role
    if user.role == models.UserRole.OFFICER:
        query = query.filter(models.GateEntry.request_officer_id == user.id)
    
    # Execute
    results = query.all()
    
    # Transform to Schema
    response = []
    for item, material, officer_name, inward_date, gate_status in results:
        # Use Material Master data if available, otherwise use InwardItem columns
        if material:
            material_name = material.name
            material_code = material.code
            category = material.category
            unit = material.unit
        else:
            # Fallback to InwardItem data when no Material Master link
            material_name = item.material_description or "Unknown"
            material_code = "N/A"
            category = item.material_category or "CONSUMABLE"
            unit = item.material_unit or "Nos"
        
        response.append(schemas.StoreItemResponse(
            id=item.id,
            material_name=material_name,
            material_code=material_code,
            category=category,
            quantity=item.quantity_received,
            unit=unit,
            store_room=item.store_room,
            rack_no=item.rack_no,
            shelf_no=item.shelf_no,
            inward_date=inward_date,
            officer_name=officer_name if user.role == models.UserRole.STORE_MANAGER else None
        ))
        
    return response

def get_issue_history(db: Session, user_id: int):
    """Get all material issues created by the store manager"""
    from sqlalchemy.orm import joinedload
    
    # Get all issues created by this user
    issues = db.query(models.MaterialIssue).options(
        joinedload(models.MaterialIssue.material)
    ).filter(
        models.MaterialIssue.requested_by_id == user_id
    ).order_by(models.MaterialIssue.id.desc()).all()
    
    # Force load material and get approver info
    for issue in issues:
        _ = issue.material
        
    return issues

def generate_issue_receipt(db: Session, issue_id: int):
    """Generate receipt text for an approved issue"""
    from sqlalchemy.orm import joinedload
    
    issue = db.query(models.MaterialIssue).options(
        joinedload(models.MaterialIssue.material)
    ).filter(models.MaterialIssue.id == issue_id).first()
    
    if not issue or issue.status != "APPROVED":
        return None
        
    # Get approver info
    approver = db.query(models.User).filter(models.User.id == issue.approved_by_id).first()
    approver_name = approver.username if approver else "Unknown"
    
    # Generate receipt text
    receipt = f"""
================================================================================
                        MATERIAL ISSUE APPROVAL RECEIPT
================================================================================

Issue ID:           {issue.issue_note_id or f'ISS-{issue.id}'}
Date & Time:        {issue.approved_at.strftime('%d-%m-%Y %I:%M %p') if issue.approved_at else 'N/A'}

MATERIAL DETAILS
--------------------------------------------------------------------------------
Material Name:      {issue.material.name if issue.material else 'Unknown'}
Material Code:      {issue.material.code if issue.material else 'N/A'}
Quantity Issued:    {issue.quantity_requested} {issue.material.unit if issue.material else ''}

REQUEST DETAILS
--------------------------------------------------------------------------------
Purpose:            {issue.purpose}
Requesting Dept:    {issue.requesting_dept}

APPROVAL DETAILS
--------------------------------------------------------------------------------
Approved By:        {approver_name}
Status:             {issue.status}

================================================================================
                    This is a system-generated document
================================================================================
"""
    return receipt
