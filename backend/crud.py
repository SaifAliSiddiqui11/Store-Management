from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_
from typing import List, Optional
from datetime import datetime, timedelta
from backend.models import User, GateEntry, UserRole, InwardProcess, InwardItem
from backend import schemas, models
from passlib.context import CryptContext
import uuid
import datetime as dt
from io import BytesIO
from reportlab.lib.pagesizes import letter, A4, A5, landscape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

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
    """Get all users who can be assigned as officers (OFFICER and ADMIN)"""
    return db.query(models.User).filter(
        models.User.role.in_([models.UserRole.OFFICER, models.UserRole.ADMIN]),
        models.User.is_active == True
    ).all()

def get_all_users(db: Session):
    """Get all users (for Admin Dashboard)"""
    return db.query(models.User).all()

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

def update_user_status(db: Session, user_id: int, is_active: bool):
    """Admin toggles a user's active status"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        return None
    user.is_active = is_active
    db.commit()
    db.refresh(user)
    return user

def update_user_password(db: Session, user_id: int, new_password_hashed: str):
    """Update a user's password"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        return None
    user.hashed_password = new_password_hashed
    db.commit()
    db.refresh(user)
    return user

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
        # Get or create material variant if rating/size/material_make are provided
        variant_id = None
        if item.material_id and (item.rating or item.size or item.material_make):
            variant = get_or_create_material_variant(
                db=db,
                material_id=item.material_id,
                rating=item.rating,
                size=item.size,
                material_make=item.material_make
            )
            variant_id = variant.id
        
        db_item = models.InwardItem(
            inward_process_id=inward_process.id,
            material_id=item.material_id,
            material_variant_id=variant_id,
            quantity_received=item.quantity_received,
            store_room=item.store_room,
            rack_no=item.rack_no,
            shelf_no=item.shelf_no,
            # Save directly to Item
            material_description=item.material_description,
            material_category=item.material_category,
            material_unit=item.material_unit,
            min_stock_level=item.min_stock_level,
            rating=item.rating,
            size=item.size,
            material_make=item.material_make
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
        inward.final_approved_at = datetime.now()
        
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
        entry.inward_process.final_approved_at = datetime.now() # Though rejected, we track who actioned it.
        
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
            # Check if variant fields changed
            variant_changed = False
            if item_update.rating is not None and item_update.rating != item.rating:
                item.rating = item_update.rating
                variant_changed = True
            if item_update.size is not None and item_update.size != item.size:
                item.size = item_update.size
                variant_changed = True
            if item_update.material_make is not None and item_update.material_make != item.material_make:
                item.material_make = item_update.material_make
                variant_changed = True
            
            # Update or create variant if needed
            if variant_changed and item.material_id:
                variant = get_or_create_material_variant(
                    db=db,
                    material_id=item.material_id,
                    rating=item.rating,
                    size=item.size,
                    material_make=item.material_make
                )
                item.material_variant_id = variant.id
            
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
    # Create main MaterialIssue
    db_issue = models.MaterialIssue(
        material_id=issue.material_id,  # Legacy field
        quantity_requested=issue.quantity_requested,  # Legacy field
        purpose=issue.purpose,
        requesting_dept=issue.requesting_dept,
        officer_id=issue.officer_id,
        requested_by_id=user_id,
        status="PENDING_OFFICER_APPROVAL"
    )
    db.add(db_issue)
    db.flush()  # Get the ID without committing
    
    # Create MaterialIssueItems if provided
    if issue.items:
        for item_data in issue.items:
            # Get material details for audit
            material = db.query(models.Material).filter(models.Material.id == item_data.material_id).first()
            
            issue_item = models.MaterialIssueItem(
                material_issue_id=db_issue.id,
                material_id=item_data.material_id,
                material_variant_id=item_data.material_variant_id,
                quantity_issued=item_data.quantity_issued,
                material_description=item_data.material_description or (material.description if material else None),
                material_category=item_data.material_category or (material.category if material else None),
                material_unit=item_data.material_unit or (material.unit if material else None),
                rating=item_data.rating,
                size=item_data.size,
                material_make=item_data.material_make,
                store_room=item_data.store_room,
                rack_no=item_data.rack_no,
                shelf_no=item_data.shelf_no,
                lot_number=item_data.lot_number
            )
            db.add(issue_item)
    
    db.commit()
    db.refresh(db_issue)
    return db_issue

def get_pending_issues(db: Session, officer_id: int):
    from sqlalchemy.orm import joinedload
    
    # Explicitly query with joinedload to ensure material and items are loaded
    results = db.query(models.MaterialIssue).options(
        joinedload(models.MaterialIssue.material),
        joinedload(models.MaterialIssue.items)
    ).filter(
        models.MaterialIssue.officer_id == officer_id,
        models.MaterialIssue.status == "PENDING_OFFICER_APPROVAL"
    ).all()
    
    # Force load the relationships
    for issue in results:
        _ = issue.material  # Access the relationship to ensure it's loaded
        _ = issue.items  # Load items
    
    return results
    
def get_officer_approved_issues(db: Session, officer_id: int):
    from sqlalchemy.orm import joinedload
    
    # Query executed and approved issues by this officer
    issues = db.query(models.MaterialIssue).options(
        joinedload(models.MaterialIssue.material),
        joinedload(models.MaterialIssue.items)
    ).filter(
        models.MaterialIssue.officer_id == officer_id,
        models.MaterialIssue.status == "APPROVED"
    ).order_by(models.MaterialIssue.approved_at.desc()).all()
    
    # Force load relationships
    for issue in issues:
        _ = issue.material
        _ = issue.items
        
    return issues

def approve_issue(db: Session, issue_id: int, officer_id: int):
    from sqlalchemy.orm import joinedload
    
    issue = db.query(models.MaterialIssue).options(
        joinedload(models.MaterialIssue.items)
    ).filter(models.MaterialIssue.id == issue_id).first()
    
    if not issue or issue.status != "PENDING_OFFICER_APPROVAL":
        return None
    
    # Handle new item-based issues
    if issue.items:
        for item in issue.items:
            material = db.query(models.Material).filter(models.Material.id == item.material_id).first()
            if not material:
                continue
            
            # Check Stock
            if material.current_stock < item.quantity_issued:
                # Insufficient stock
                return None
            
            # Deduct Stock
            material.current_stock -= item.quantity_issued
            
            # Create detailed inventory log
            log = models.InventoryLog(
                material_id=material.id,
                change_quantity=-item.quantity_issued,
                balance_after=material.current_stock,
                transaction_type="ISSUE",
                reference_id=f"ISS-{issue.id}-ITEM-{item.id}",
                created_by_id=officer_id
            )
            db.add(log)
    
    # Handle legacy single-material issues (backward compatibility)
    elif issue.material_id and issue.quantity_requested:
        material = db.query(models.Material).filter(models.Material.id == issue.material_id).first()
        if not material:
            return None
        
        # Check Stock
        if material.current_stock < issue.quantity_requested:
            return None
        
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
    
    # Update Issue Status
    issue.status = "APPROVED"
    issue.approved_by_id = officer_id
    issue.approved_at = datetime.now()
    issue.issue_note_id = f"NOTE-{uuid.uuid4().hex[:8].upper()}"
    
    db.commit()
    db.refresh(issue)
    return issue

def reject_issue(db: Session, issue_id: int, officer_id: int, remarks: str = "Rejected by Officer"):
    """Reject a pending material issue request"""
    issue = db.query(models.MaterialIssue).filter(models.MaterialIssue.id == issue_id).first()
    
    if not issue or issue.status != "PENDING_OFFICER_APPROVAL":
        return None
    
    issue.status = "REJECTED"
    issue.approved_by_id = officer_id
    issue.approved_at = datetime.now()
    
    db.commit()
    db.refresh(issue)
    return issue

def get_materials(db: Session):
    materials = db.query(models.Material).all()
    # Calculate total quantity for each variant and the material itself
    for material in materials:
        total_variant_stock = 0
        
        for variant in material.variants:
            # Sum quantity_received from linked inward items regarding this variant
            total_received = sum(item.quantity_received for item in variant.inward_items)
            
            # Sum quantity_issued for this variant from approved material issues
            total_issued = db.query(func.sum(models.MaterialIssueItem.quantity_issued))\
                .join(models.MaterialIssue)\
                .filter(
                    models.MaterialIssueItem.material_variant_id == variant.id,
                    models.MaterialIssue.status == "APPROVED"
                ).scalar() or 0
                
            current_stock = total_received - total_issued
            total_variant_stock += current_stock
            
            # set the attribute on the Pydantic model response
            setattr(variant, 'total_quantity_received', total_received) 
            setattr(variant, 'current_stock', current_stock)
            
        # To find stock that is NOT tied to any variant but IS tied to this material
        non_variant_received = db.query(func.sum(models.InwardItem.quantity_received))\
            .join(models.InwardProcess)\
            .join(models.GateEntry)\
            .filter(
                models.InwardItem.material_id == material.id,
                models.InwardItem.material_variant_id == None,
                models.GateEntry.status == "FINAL_APPROVED"
            ).scalar() or 0
            
        non_variant_issued = db.query(func.sum(models.MaterialIssueItem.quantity_issued))\
            .join(models.MaterialIssue)\
            .filter(
                models.MaterialIssueItem.material_id == material.id,
                models.MaterialIssueItem.material_variant_id == None,
                models.MaterialIssue.status == "APPROVED"
            ).scalar() or 0
            
        non_variant_stock = non_variant_received - non_variant_issued
        
        # Overall material stock = variant stock + non-variant stock
        material.current_stock = total_variant_stock + non_variant_stock
            
    return materials

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

def update_material(db: Session, material_id: int, update_data: schemas.MaterialUpdate):
    """Update material properties (admin only). Only updates provided fields."""
    material = db.query(models.Material).filter(models.Material.id == material_id).first()
    if not material:
        return None
    
    update_dict = update_data.model_dump(exclude_unset=True, exclude_none=True)
    
    # Check code uniqueness if code is being changed
    if 'code' in update_dict and update_dict['code'] != material.code:
        existing = db.query(models.Material).filter(
            models.Material.code == update_dict['code'],
            models.Material.id != material_id
        ).first()
        if existing:
            raise ValueError(f"Material code '{update_dict['code']}' is already in use")
    
    for field, value in update_dict.items():
        setattr(material, field, value)
    
    db.commit()
    db.refresh(material)
    return material


# --- Material Variant CRUD ---
def get_or_create_material_variant(db: Session, material_id: int, rating: str = None, size: str = None, material_make: str = None):
    """
    Get existing material variant or create new one.
    Prevents duplicate variants with unique constraint.
    """
    # Normalize None values to empty strings for consistent comparison
    rating = rating or None
    size = size or None
    material_make = material_make or None
    
    # Try to find existing variant
    variant = db.query(models.MaterialVariant).filter(
        models.MaterialVariant.material_id == material_id,
        models.MaterialVariant.rating == rating,
        models.MaterialVariant.size == size,
        models.MaterialVariant.material_make == material_make
    ).first()
    
    if variant:
        return variant
    
    # Create new variant
    new_variant = models.MaterialVariant(
        material_id=material_id,
        rating=rating,
        size=size,
        material_make=material_make
    )
    db.add(new_variant)
    db.commit()
    db.refresh(new_variant)
    return new_variant


def get_variant_suggestions(db: Session, material_id: int, field: str, search: str = ""):
    """
    Get autocomplete suggestions for a specific field (rating, size, or material_make).
    Returns distinct values with count of usage.
    """
    from sqlalchemy import func, distinct
    
    # Map field name to column
    field_map = {
        'rating': models.MaterialVariant.rating,
        'size': models.MaterialVariant.size,
        'material_make': models.MaterialVariant.material_make
    }
    
    if field not in field_map:
        return []
    
    column = field_map[field]
    
    # Query distinct values with count
    query = db.query(
        column.label('value'),
        func.count(models.InwardItem.id).label('count')
    ).join(
        models.InwardItem, models.MaterialVariant.id == models.InwardItem.material_variant_id
    ).filter(
        models.MaterialVariant.material_id == material_id,
        column.isnot(None),
        column != ''
    )
    
    # Add search filter if provided
    if search:
        query = query.filter(column.like(f'%{search}%'))
    
    query = query.group_by(column).order_by(func.count(models.InwardItem.id).desc()).limit(10)
    
    results = query.all()
    
    return [{'value': r.value, 'count': r.count} for r in results]


def get_material_variants(db: Session, material_id: int):
    """Get all variants for a specific material"""
    return db.query(models.MaterialVariant).filter(
        models.MaterialVariant.material_id == material_id
    ).all()


def get_material_with_variants(db: Session, material_id: int):
    """Get material with all its variants"""
    from sqlalchemy.orm import joinedload
    
    material = db.query(models.Material).options(
        joinedload(models.Material.variants)
    ).filter(models.Material.id == material_id).first()
    
    return material

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
    
    # Sort by inward date - latest first
    query = query.order_by(models.InwardProcess.invoice_date.desc())
    
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
    
    # Get all issues created by this user with items eagerly loaded
    issues = db.query(models.MaterialIssue).options(
        joinedload(models.MaterialIssue.material),
        joinedload(models.MaterialIssue.items).joinedload(models.MaterialIssueItem.material)
    ).filter(
        models.MaterialIssue.requested_by_id == user_id
    ).order_by(models.MaterialIssue.id.desc()).all()
    
    # Force load relationships
    for issue in issues:
        _ = issue.material
        _ = issue.items
        
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
    return receipt.encode('utf-8')


def generate_gate_pass_pdf(db: Session, entry_id: int):
    """Generate a printable PDF for a gate entry"""
    # Import inside to avoid circular or heavy load if not needed
    entry = db.query(models.GateEntry).filter(models.GateEntry.id == entry_id).first()
    if not entry:
        return None

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(A5), rightMargin=20, leftMargin=20, topMargin=20, bottomMargin=20)
    elements = []
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontSize=18,
        alignment=1, # Center
        spaceAfter=14
    )
    
    label_style = ParagraphStyle(
        'LabelStyle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.grey
    )
    
    value_style = ParagraphStyle(
        'ValueStyle',
        parent=styles['Normal'],
        fontSize=12,
        fontWeight='bold'
    )

    # Header
    elements.append(Paragraph("<b>STORE MANAGEMENT SYSTEM</b>", title_style))
    elements.append(Paragraph("<b>OFFICIAL GATE PASS</b>", styles['Heading2']))
    elements.append(Spacer(1, 0.5 * cm))

    # Info Table
    data = [
        [Paragraph("<b>Pass No:</b>", label_style), Paragraph(entry.gate_pass_number, value_style), 
         Paragraph("<b>Date:</b>", label_style), Paragraph(entry.created_at.strftime("%d-%m-%Y"), value_style)],
        
        [Paragraph("<b>Vendor:</b>", label_style), Paragraph(entry.vendor_name, value_style),
         Paragraph("<b>Location:</b>", label_style), Paragraph(entry.vendor_location or "N/A", value_style)],
        
        [Paragraph("<b>Material:</b>", label_style), Paragraph(entry.material_type_desc or "General", value_style),
         Paragraph("<b>Status:</b>", label_style), Paragraph(entry.status.replace("_", " "), value_style)]
    ]
    
    if entry.vehicle_number:
         data.append([Paragraph("<b>Vehicle:</b>", label_style), Paragraph(entry.vehicle_number, value_style), "", ""])

    t = Table(data, colWidths=[3*cm, 6*cm, 3*cm, 6*cm])
    t.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 1 * cm))

    # Footer
    elements.append(Paragraph(f"Created By: {entry.created_by.username} | Officer Assigned: {entry.officer.username}", styles['Normal']))
    elements.append(Spacer(1, 1 * cm))
    elements.append(Paragraph("__________________________", styles['Normal']))
    elements.append(Paragraph("Authorized Signature", styles['Normal']))

    doc.build(elements)
    buffer.seek(0)
    return buffer

def get_security_history(db: Session, security_user_id: int):
    """Get all gate entries created by a specific security guard"""
    from sqlalchemy.orm import joinedload
    
    entries = db.query(models.GateEntry).options(
        joinedload(models.GateEntry.officer),
        joinedload(models.GateEntry.created_by)
    ).filter(
        models.GateEntry.created_by_id == security_user_id
    ).order_by(models.GateEntry.created_at.desc()).all()
    
    return entries

def update_gate_entry(db: Session, entry_id: int, update_data: schemas.GateEntryUpdate, user_id: int):
    """
    Update gate entry details (vendor name, location, material description).
    Only allows updates if:
    - The entry exists
    - The current user is the creator OR the assigned officer
    - The entry is in PENDING_OFFICER_APPROVAL_1 status
    """
    entry = db.query(models.GateEntry).filter(models.GateEntry.id == entry_id).first()
    
    if not entry:
        return None
    
    # Verify the user is either the creator or the assigned officer
    if entry.created_by_id != user_id and entry.request_officer_id != user_id:
        raise ValueError("Only the creator or assigned officer can edit this entry")
    
    # Verify the entry is still pending (not yet approved/rejected)
    if entry.status != "PENDING_OFFICER_APPROVAL_1":
        raise ValueError("Cannot edit entry after it has been reviewed")
    
    # Update fields if provided
    if update_data.vendor_name is not None:
        entry.vendor_name = update_data.vendor_name
    if update_data.vendor_location is not None:
        entry.vendor_location = update_data.vendor_location
    if update_data.material_type_desc is not None:
        entry.material_type_desc = update_data.material_type_desc
    
    db.commit()
    db.refresh(entry)
    return entry


def generate_issue_approval_pdf(db: Session, issue_id: int):
    """
    Generate a professional PDF approval note for an approved material issue.
    Returns PDF as bytes.
    """
    # Fetch issue details
    issue = db.query(models.MaterialIssue).filter(models.MaterialIssue.id == issue_id).first()
    if not issue or issue.status != "APPROVED":
        return None
    
    # Get approver details
    approver = db.query(models.User).filter(models.User.id == issue.approved_by_id).first()
    approver_name = approver.username if approver else "Unknown"
    
    # Create PDF in memory
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.75*inch, bottomMargin=0.75*inch)
    
    # Container for PDF elements
    elements = []
    
    # Styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#1a1a2e'),
        spaceAfter=6,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Normal'],
        fontSize=12,
        textColor=colors.HexColor('#666666'),
        spaceAfter=20,
        alignment=TA_CENTER,
        fontName='Helvetica'
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#1a1a2e'),
        spaceAfter=10,
        spaceBefore=15,
        fontName='Helvetica-Bold'
    )
    
    # Header
    elements.append(Paragraph("MATERIAL ISSUE APPROVAL NOTE", title_style))
    elements.append(Paragraph("My BPCL Store Management System", subtitle_style))
    elements.append(Spacer(1, 0.2*inch))
    
    # Issue Information Table
    issue_data = [
        ['Issue ID:', issue.issue_note_id or f'ISS-{issue.id}'],
        ['Approval Date:', issue.approved_at.strftime('%d %B %Y, %I:%M %p') if issue.approved_at else 'N/A'],
        ['Status:', issue.status],
    ]
    
    issue_table = Table(issue_data, colWidths=[2*inch, 4*inch])
    issue_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f0f0f0')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(issue_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # Material Details
    elements.append(Paragraph("Material Details", heading_style))
    
    material_data = [
        ['Material Name:', issue.material.name if issue.material else 'Unknown'],
        ['Material Code:', issue.material.code if issue.material else 'N/A'],
        ['Category:', issue.material.category if issue.material else 'N/A'],
        ['Quantity Issued:', f"{issue.quantity_requested} {issue.material.unit if issue.material else ''}"],
    ]
    
    material_table = Table(material_data, colWidths=[2*inch, 4*inch])
    material_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f0f0f0')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(material_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # Request Details
    elements.append(Paragraph("Request Details", heading_style))
    
    request_data = [
        ['Purpose:', issue.purpose or 'N/A'],
        ['Requesting Department:', issue.requesting_dept or 'N/A'],
    ]
    
    request_table = Table(request_data, colWidths=[2*inch, 4*inch])
    request_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f0f0f0')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(request_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # Approval Details
    elements.append(Paragraph("Approval Details", heading_style))
    
    approval_data = [
        ['Approved By:', approver_name],
        ['Officer Role:', approver.role if approver else 'N/A'],
    ]
    
    approval_table = Table(approval_data, colWidths=[2*inch, 4*inch])
    approval_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f0f0f0')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(approval_table)
    elements.append(Spacer(1, 0.5*inch))
    
    # Footer
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.grey,
        alignment=TA_CENTER,
        fontName='Helvetica-Oblique'
    )
    
    import datetime as dt
    elements.append(Paragraph(f"This is a system-generated document | Generated on: {dt.datetime.now().strftime('%d %B %Y, %I:%M %p')}", footer_style))
    
    # Build PDF
    doc.build(elements)
    
    # Get PDF bytes
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes

def get_inventory_report_data(
    db: Session,
    category: Optional[str] = None,
    search: Optional[str] = None,
    make: Optional[str] = None,
    size: Optional[str] = None,
    rating: Optional[str] = None
):
    """Fetch and filter live inventory data with location details"""
    from sqlalchemy.orm import joinedload
    from sqlalchemy import func

    # 1. Get all InwardItems from FINAL_APPROVED gate entries to establish locations and initial quantities
    inward_query = db.query(models.InwardItem).join(
        models.InwardProcess
    ).join(
        models.GateEntry
    ).filter(
        models.GateEntry.status == "FINAL_APPROVED"
    ).options(
        joinedload(models.InwardItem.material)
    )

    # Apply filters
    if category:
        inward_query = inward_query.filter(
            or_(
                models.InwardItem.material_category == category,
                db.query(models.Material.category).filter(models.Material.id == models.InwardItem.material_id).as_scalar() == category
            )
        )
    if search:
        search_filter = f"%{search}%"
        inward_query = inward_query.filter(
            or_(
                models.InwardItem.material_description.ilike(search_filter),
                models.InwardItem.rating.ilike(search_filter),
                models.InwardItem.size.ilike(search_filter),
                models.InwardItem.material_make.ilike(search_filter),
                db.query(models.Material.name).filter(models.Material.id == models.InwardItem.material_id).as_scalar().ilike(search_filter),
                db.query(models.Material.code).filter(models.Material.id == models.InwardItem.material_id).as_scalar().ilike(search_filter)
            )
        )
    if make:
        inward_query = inward_query.filter(models.InwardItem.material_make.ilike(f"%{make}%"))
    if size:
        inward_query = inward_query.filter(models.InwardItem.size.ilike(f"%{size}%"))
    if rating:
        inward_query = inward_query.filter(models.InwardItem.rating.ilike(f"%{rating}%"))

    inward_items = inward_query.all()

    # 2. Group by (Material, Variant Details, Location) to get current stock
    inventory_map = {} # Key: (material_id, rating, size, material_make, store_room, rack_no, shelf_no)

    for item in inward_items:
        # Resolve Material Info
        m_code = item.material.code if item.material else "N/A"
        m_name = item.material.name if item.material else (item.material_description or "Unknown")
        m_cat = item.material.category if item.material else (item.material_category or "CONSUMABLE")
        m_unit = item.material.unit if item.material else (item.material_unit or "Nos")

        key = (
            item.material_id, 
            item.rating, 
            item.size, 
            item.material_make, 
            item.store_room, 
            item.rack_no, 
            item.shelf_no
        )

        if key not in inventory_map:
            inventory_map[key] = {
                "material_code": m_code,
                "material_name": m_name,
                "category": m_cat,
                "unit": m_unit,
                "rating": item.rating,
                "size": item.size,
                "material_make": item.material_make,
                "store_room": item.store_room,
                "rack_no": item.rack_no,
                "shelf_no": item.shelf_no,
                "quantity": 0
            }
        
        inventory_map[key]["quantity"] += item.quantity_received

    # 3. Deduct Issued Quantities
    # We need to find issues that match these specific criteria
    for key, data in inventory_map.items():
        m_id, rating, size, make, room, rack, shelf = key
        
        # Query issued items matching these exact details
        issued_qty = db.query(func.sum(models.MaterialIssueItem.quantity_issued)).join(
            models.MaterialIssue
        ).filter(
            models.MaterialIssue.status == "APPROVED",
            models.MaterialIssueItem.material_id == m_id,
            models.MaterialIssueItem.rating == rating,
            models.MaterialIssueItem.size == size,
            models.MaterialIssueItem.material_make == make,
            models.MaterialIssueItem.store_room == room,
            models.MaterialIssueItem.rack_no == rack,
            models.MaterialIssueItem.shelf_no == shelf
        ).scalar() or 0
        
        data["quantity"] -= issued_qty

    # 4. Filter out zero stock items and convert to list
    final_data = [schemas.InventoryReportItem(**item) for item in inventory_map.values() if item["quantity"] > 0]
    
    # Sort by code
    final_data.sort(key=lambda x: x.material_code)
    
    return final_data

def generate_inventory_report_pdf(report_data: List[schemas.InventoryReportItem]):
    """Generate a premium PDF for the live inventory report"""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(A4), topMargin=0.5*inch, bottomMargin=0.5*inch, leftMargin=0.5*inch, rightMargin=0.5*inch)
    elements = []
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'ReportTitle',
        parent=styles['Heading1'],
        fontSize=20,
        alignment=TA_CENTER,
        spaceAfter=20,
        textColor=colors.HexColor('#1e1b4b') # Premium Dark Indigo
    )
    
    # Header
    elements.append(Paragraph("LIVE INVENTORY STATUS REPORT", title_style))
    elements.append(Paragraph(f"Generated on: {datetime.now().strftime('%d-%m-%Y %H:%M')}", styles['Normal']))
    elements.append(Spacer(1, 0.3*inch))
    
    # Table Data
    data = [
        ["Code", "Material Name", "Category", "Variant (Rating/Size/Make)", "Location", "Qty", "Unit"]
    ]
    
    for item in report_data:
        variant_str = " / ".join(filter(None, [item.rating, item.size, item.material_make])) or "-"
        location_str = " / ".join(filter(None, [item.store_room, item.rack_no, item.shelf_no])) or "-"
        
        data.append([
            item.material_code,
            item.material_name[:30] + "..." if len(item.material_name) > 30 else item.material_name,
            item.category,
            variant_str[:40] + "..." if len(variant_str) > 40 else variant_str,
            location_str,
            str(item.quantity),
            item.unit
        ])
    
    # Create Table
    t = Table(data, colWidths=[1*inch, 2.2*inch, 1.5*inch, 2.5*inch, 2*inch, 0.7*inch, 0.7*inch], repeatRows=1)
    
    # Premium Style
    style = TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e1b4b')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.whitesmoke),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.whitesmoke, colors.HexColor('#f3f4f6')]),
        ('ALIGN', (5, 1), (5, -1), 'RIGHT'), # Qty right aligned
    ])
    t.setStyle(style)
    
    elements.append(t)
    
    # Build PDF
    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes

def get_inward_report_data(
    db: Session, 
    start_date: Optional[datetime] = None, 
    end_date: Optional[datetime] = None, 
    officer_id: Optional[int] = None, 
    search: Optional[str] = None
):
    """Fetch and filter inward material data for reporting"""
    from sqlalchemy.orm import joinedload
    
    query = db.query(models.GateEntry).join(
        models.InwardProcess, isouter=True
    ).outerjoin(
        models.InwardItem, models.InwardProcess.id == models.InwardItem.inward_process_id
    ).options(
        joinedload(models.GateEntry.officer),
        joinedload(models.GateEntry.inward_process).joinedload(models.InwardProcess.items)
    )
    
    if start_date:
        query = query.filter(models.GateEntry.created_at >= start_date)
    if end_date:
        # Adjust end_date to include the full day
        adjusted_end_date = end_date + timedelta(days=1)
        query = query.filter(models.GateEntry.created_at < adjusted_end_date)
    if officer_id:
        query = query.filter(models.GateEntry.request_officer_id == officer_id)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                models.GateEntry.gate_pass_number.ilike(search_filter),
                models.GateEntry.vendor_name.ilike(search_filter),
                models.GateEntry.material_type_desc.ilike(search_filter),
                models.InwardItem.material_description.ilike(search_filter),
                models.InwardItem.rating.ilike(search_filter),
                models.InwardItem.size.ilike(search_filter),
                models.InwardItem.material_make.ilike(search_filter),
                db.query(models.Material.name).filter(models.Material.id == models.InwardItem.material_id).as_scalar().ilike(search_filter),
                db.query(models.Material.code).filter(models.Material.id == models.InwardItem.material_id).as_scalar().ilike(search_filter)
            )
        )
        
    # Sort by date
    query = query.order_by(models.GateEntry.created_at.desc())
    
    results = query.all()
    
    report_data = []
    for entry in results:
        if entry.inward_process and entry.inward_process.items:
            for item in entry.inward_process.items:
                report_data.append(schemas.InwardReportItem(
                    id=entry.id,
                    gate_pass_number=entry.gate_pass_number,
                    date=entry.created_at,
                    vendor_name=entry.vendor_name,
                    vendor_location=entry.vendor_location,
                    material_description=item.material_description or entry.material_type_desc,
                    quantity=item.quantity_received,
                    officer_name=entry.officer.username if entry.officer else "N/A",
                    status=entry.status,
                    invoice_no=entry.inward_process.invoice_no,
                    invoice_date=entry.inward_process.invoice_date,
                    final_approved_at=entry.inward_process.final_approved_at,
                    remarks=entry.inward_process.remarks
                ))
        else:
            report_data.append(schemas.InwardReportItem(
                id=entry.id,
                gate_pass_number=entry.gate_pass_number,
                date=entry.created_at,
                vendor_name=entry.vendor_name,
                vendor_location=entry.vendor_location,
                material_description=entry.material_type_desc,
                quantity=entry.approx_quantity,
                officer_name=entry.officer.username if entry.officer else "N/A",
                status=entry.status,
                remarks=None
            ))
            
    return report_data

def generate_inward_report_pdf(report_data: List[schemas.InwardReportItem], title: str = "Material Inward Report"):
    """Generate a PDF for the filtered inward material report"""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(A4), topMargin=0.5*inch, bottomMargin=0.5*inch, leftMargin=0.5*inch, rightMargin=0.5*inch)
    elements = []
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'ReportTitle',
        parent=styles['Heading1'],
        fontSize=18,
        alignment=TA_CENTER,
        spaceAfter=20,
        textColor=colors.HexColor('#1a1a2e')
    )
    
    # Header
    elements.append(Paragraph(title.upper(), title_style))
    elements.append(Paragraph(f"Generated on: {datetime.now().strftime('%d-%m-%Y %H:%M')}", styles['Normal']))
    elements.append(Spacer(1, 0.2*inch))
    
    # Table Data
    data = [
        ["Date", "Gate Pass", "Vendor", "Material Description", "Officer", "Status"]
    ]
    
    for item in report_data:
        data.append([
            item.date.strftime("%d-%m-%Y"),
            item.gate_pass_number,
            item.vendor_name,
            item.material_description[:40] + "..." if item.material_description and len(item.material_description) > 40 else (item.material_description or "-"),
            item.officer_name,
            item.status.replace("_", " ")
        ])
    
    # Create Table
    # Adjusted colWidths for fewer columns
    t = Table(data, colWidths=[1.2*inch, 1.5*inch, 2*inch, 3.5*inch, 1.5*inch, 1.5*inch], repeatRows=1)
    
    # Style the table
    style = TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a1a2e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.whitesmoke),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.whitesmoke, colors.lightgrey])
    ])
    t.setStyle(style)
    
    elements.append(t)
    
    # Build PDF
    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes

def get_issue_report_data(
    db: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    officer_id: Optional[int] = None,
    search: Optional[str] = None
):
    """Fetch and filter material issue data for reporting"""
    from sqlalchemy.orm import joinedload
    
    try:
        query = db.query(models.MaterialIssueItem).join(
            models.MaterialIssue
        ).options(
            joinedload(models.MaterialIssueItem.material_issue).joinedload(models.MaterialIssue.officer),
            joinedload(models.MaterialIssueItem.material)
        )
        
        # Apply Filters
        if start_date:
            query = query.filter(models.MaterialIssue.created_at >= start_date)
        if end_date:
            adjusted_end_date = end_date + timedelta(days=1)
            query = query.filter(models.MaterialIssue.created_at < adjusted_end_date)
        if category:
            query = query.filter(models.MaterialIssueItem.material_category == category)
        if status:
            query = query.filter(models.MaterialIssue.status == status)
        if officer_id:
            query = query.filter(models.MaterialIssue.officer_id == officer_id)
        if search:
            search_filter = f"%{search}%"
            query = query.filter(
                or_(
                    models.MaterialIssue.issue_note_id.ilike(search_filter),
                    models.MaterialIssue.requesting_dept.ilike(search_filter),
                    models.MaterialIssueItem.material_description.ilike(search_filter),
                    models.MaterialIssueItem.rating.ilike(search_filter),
                    models.MaterialIssueItem.size.ilike(search_filter),
                    models.MaterialIssueItem.material_make.ilike(search_filter),
                    db.query(models.Material.code).filter(models.Material.id == models.MaterialIssueItem.material_id).as_scalar().ilike(search_filter)
                )
            )
            
        query = query.order_by(models.MaterialIssue.created_at.desc())
        results = query.all()
        
        report_data = []
        for item in results:
            issue = item.material_issue
            if not issue:
                continue
                
            report_data.append(schemas.IssueReportItem(
                id=issue.id,
                issue_note_id=issue.issue_note_id,
                date=issue.created_at,
                material_code=item.material.code if item.material else "N/A",
                material_name=item.material_description or (item.material.name if item.material else "Unknown"),
                category=item.material_category or "CONSUMABLE",
                unit=item.material_unit or "Nos",
                quantity=item.quantity_issued,
                rating=item.rating,
                size=item.size,
                material_make=item.material_make,
                department=issue.requesting_dept or "N/A",
                purpose=issue.purpose or "N/A",
                status=issue.status,
                officer_name=issue.officer.username if issue.officer else "N/A",
                approved_at=issue.approved_at
            ))
            
        return report_data
    except Exception as e:
        print(f"Error in get_issue_report_data: {str(e)}")
        import traceback
        traceback.print_exc()
        raise e

def generate_issue_report_pdf(report_data: List[schemas.IssueReportItem], title: str = "Material Issue Report"):
    """Generate a premium landscape PDF for the material issue report"""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(A4), topMargin=0.5*inch, bottomMargin=0.5*inch, leftMargin=0.5*inch, rightMargin=0.5*inch)
    elements = []
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'ReportTitle',
        parent=styles['Heading1'],
        fontSize=18,
        alignment=TA_CENTER,
        spaceAfter=20,
        textColor=colors.HexColor('#1a1a2e')
    )
    
    # Header
    elements.append(Paragraph(title.upper(), title_style))
    elements.append(Paragraph(f"Generated on: {datetime.now().strftime('%d-%m-%Y %H:%M')}", styles['Normal']))
    elements.append(Spacer(1, 0.2*inch))
    
    # Table Data
    data = [
        ["Date", "Issue ID", "Material", "Variant Details", "Dept", "Qty", "Officer", "Status"]
    ]
    
    for item in report_data:
        variant_str = " / ".join(filter(None, [item.rating, item.size, item.material_make])) or "-"
        data.append([
            item.date.strftime("%d-%m-%Y"),
            item.issue_note_id or f"ISS-{item.id}",
            item.material_name[:25] + "..." if len(item.material_name) > 25 else item.material_name,
            variant_str[:30] + "..." if len(variant_str) > 30 else variant_str,
            item.department[:20],
            f"{item.quantity} {item.unit}",
            item.officer_name,
            item.status
        ])
    
    # Create Table
    t = Table(data, colWidths=[0.9*inch, 1.2*inch, 2*inch, 2*inch, 1.5*inch, 0.8*inch, 1*inch, 1.1*inch], repeatRows=1)
    
    # Style
    style = TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a1a2e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.whitesmoke, colors.HexColor('#f9fafb')])
    ])
    t.setStyle(style)
    
    elements.append(t)
    
    # Build PDF
    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


# --- Returnables CRUD ---

def create_returnable_entry(db: Session, entry: schemas.ReturnableEntryCreate, initiator_id: int):
    """Store Manager initiates a returnable entry"""
    db_entry = models.ReturnableEntry(
        material_description=entry.material_description,
        vendor_name=entry.vendor_name,
        reason_for_outward=entry.reason_for_outward,
        officer_id=entry.officer_id,
        initiated_by_id=initiator_id,
        status=models.ReturnableStatus.PENDING_OFFICER_OUTWARD
    )
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry

def get_returnable_pending_officer_outward(db: Session, officer_id: int):
    from sqlalchemy.orm import joinedload
    return db.query(models.ReturnableEntry).options(
        joinedload(models.ReturnableEntry.officer)
    ).filter(
        models.ReturnableEntry.officer_id == officer_id,
        models.ReturnableEntry.status == models.ReturnableStatus.PENDING_OFFICER_OUTWARD
    ).all()

def approve_returnable_outward_officer(db: Session, entry_id: int, officer_id: int):
    entry = db.query(models.ReturnableEntry).filter(
        models.ReturnableEntry.id == entry_id,
        models.ReturnableEntry.officer_id == officer_id
    ).first()
    if not entry: return None
    
    entry.status = models.ReturnableStatus.PENDING_SECURITY_OUTWARD
    entry.outward_approved_officer_at = datetime.now()
    db.commit()
    db.refresh(entry)
    return entry

def get_returnable_pending_security_outward(db: Session):
    from sqlalchemy.orm import joinedload
    return db.query(models.ReturnableEntry).options(
        joinedload(models.ReturnableEntry.officer)
    ).filter(
        models.ReturnableEntry.status == models.ReturnableStatus.PENDING_SECURITY_OUTWARD
    ).all()

def approve_returnable_outward_security(db: Session, entry_id: int):
    entry = db.query(models.ReturnableEntry).filter(models.ReturnableEntry.id == entry_id).first()
    if not entry: return None
    
    # Generate Outward Gate Pass ID
    entry.outward_gate_pass_id = f"RET-OUT-{str(uuid.uuid4())[:6].upper()}"
    entry.status = models.ReturnableStatus.OUTWARD_COMPLETED
    entry.outward_approved_security_at = datetime.now()
    db.commit()
    db.refresh(entry)
    return entry

def get_returnable_by_outward_id(db: Session, outward_id: str):
    return db.query(models.ReturnableEntry).filter(
        models.ReturnableEntry.outward_gate_pass_id == outward_id,
        models.ReturnableEntry.status == models.ReturnableStatus.OUTWARD_COMPLETED
    ).first()

def get_returnable_pending_security_inward(db: Session):
    """All items with OUTWARD_COMPLETED status — security needs to receive these back from vendors."""
    from sqlalchemy.orm import joinedload
    return db.query(models.ReturnableEntry).options(
        joinedload(models.ReturnableEntry.officer)
    ).filter(
        models.ReturnableEntry.status == models.ReturnableStatus.OUTWARD_COMPLETED
    ).order_by(models.ReturnableEntry.outward_approved_security_at.asc()).all()

def receive_returnable_inward_security(db: Session, entry_id: int):
    entry = db.query(models.ReturnableEntry).filter(models.ReturnableEntry.id == entry_id).first()
    if not entry: return None
    
    # Generate Inward Gate Pass ID
    entry.inward_gate_pass_id = f"RET-IN-{str(uuid.uuid4())[:6].upper()}"
    entry.status = models.ReturnableStatus.PENDING_OFFICER_INWARD
    entry.inward_received_security_at = datetime.now()
    db.commit()
    db.refresh(entry)
    return entry

def get_returnable_pending_officer_inward(db: Session, officer_id: int):
    from sqlalchemy.orm import joinedload
    return db.query(models.ReturnableEntry).options(
        joinedload(models.ReturnableEntry.officer)
    ).filter(
        models.ReturnableEntry.officer_id == officer_id,
        models.ReturnableEntry.status == models.ReturnableStatus.PENDING_OFFICER_INWARD
    ).all()

def approve_returnable_inward_officer(db: Session, entry_id: int, officer_id: int):
    entry = db.query(models.ReturnableEntry).filter(
        models.ReturnableEntry.id == entry_id,
        models.ReturnableEntry.officer_id == officer_id
    ).first()
    if not entry: return None
    
    entry.status = models.ReturnableStatus.PENDING_STORE_MANAGER_FINAL
    entry.inward_approved_officer_at = datetime.now()
    db.commit()
    db.refresh(entry)
    return entry

def reject_returnable_outward_officer(db: Session, entry_id: int, officer_id: int, remarks: str = None):
    from sqlalchemy.orm import joinedload
    entry = db.query(models.ReturnableEntry).options(
        joinedload(models.ReturnableEntry.officer)
    ).filter(
        models.ReturnableEntry.id == entry_id,
        models.ReturnableEntry.officer_id == officer_id,
        models.ReturnableEntry.status == models.ReturnableStatus.PENDING_OFFICER_OUTWARD
    ).first()
    if not entry: return None

    entry.status = models.ReturnableStatus.REJECTED_OFFICER_OUTWARD
    if remarks:
        entry.remarks = remarks
    db.commit()
    db.refresh(entry)
    return entry

def reject_returnable_inward_officer(db: Session, entry_id: int, officer_id: int, remarks: str = None):
    from sqlalchemy.orm import joinedload
    entry = db.query(models.ReturnableEntry).options(
        joinedload(models.ReturnableEntry.officer)
    ).filter(
        models.ReturnableEntry.id == entry_id,
        models.ReturnableEntry.officer_id == officer_id,
        models.ReturnableEntry.status == models.ReturnableStatus.PENDING_OFFICER_INWARD
    ).first()
    if not entry: return None

    # Reject inward: device stays with vendor (revert to OUTWARD_COMPLETED)
    entry.status = models.ReturnableStatus.OUTWARD_COMPLETED
    if remarks:
        entry.remarks = remarks
    db.commit()
    db.refresh(entry)
    return entry

def update_returnable_entry(db: Session, entry_id: int, officer_id: int, data: schemas.ReturnableEntryUpdate):
    from sqlalchemy.orm import joinedload
    entry = db.query(models.ReturnableEntry).options(
        joinedload(models.ReturnableEntry.officer)
    ).filter(
        models.ReturnableEntry.id == entry_id,
        models.ReturnableEntry.officer_id == officer_id,
        models.ReturnableEntry.status.in_([
            models.ReturnableStatus.PENDING_OFFICER_OUTWARD,
            models.ReturnableStatus.PENDING_OFFICER_INWARD
        ])
    ).first()
    if not entry: return None

    if data.material_description is not None:
        entry.material_description = data.material_description
    if data.vendor_name is not None:
        entry.vendor_name = data.vendor_name
    if data.reason_for_outward is not None:
        entry.reason_for_outward = data.reason_for_outward

    db.commit()
    db.refresh(entry)
    return entry

def get_returnable_pending_store_manager_final(db: Session):
    from sqlalchemy.orm import joinedload
    return db.query(models.ReturnableEntry).options(
        joinedload(models.ReturnableEntry.officer)
    ).filter(
        models.ReturnableEntry.status == models.ReturnableStatus.PENDING_STORE_MANAGER_FINAL
    ).all()

def finalize_returnable_store_manager(db: Session, entry_id: int, store_manager_id: int):
    entry = db.query(models.ReturnableEntry).filter(models.ReturnableEntry.id == entry_id).first()
    if not entry: return None
    
    entry.status = models.ReturnableStatus.COMPLETED
    entry.completed_at = datetime.now()
    db.commit()
    db.refresh(entry)
    return entry

def get_returnable_history(db: Session, user_role: str, user_id: int):
    from sqlalchemy.orm import joinedload
    query = db.query(models.ReturnableEntry).options(
        joinedload(models.ReturnableEntry.officer)
    )
    if user_role == models.UserRole.OFFICER:
        query = query.filter(models.ReturnableEntry.officer_id == user_id)
    elif user_role == models.UserRole.STORE_MANAGER:
        query = query.filter(models.ReturnableEntry.initiated_by_id == user_id)
    
    return query.order_by(models.ReturnableEntry.created_at.desc()).all()


def generate_returnable_pdf(db: Session, entry_id: int, type: str):
    """
    Generate PDF for Returnables: 'outward', 'inward', or 'handover'.
    """
    from sqlalchemy.orm import joinedload
    entry = db.query(models.ReturnableEntry).options(
        joinedload(models.ReturnableEntry.officer)
    ).filter(models.ReturnableEntry.id == entry_id).first()
    if not entry:
        return None

    buffer = BytesIO()
    # A5 Landscape is good for gate passes
    doc = SimpleDocTemplate(buffer, pagesize=landscape(A5), rightMargin=20, leftMargin=20, topMargin=20, bottomMargin=20)
    elements = []
    
    styles = getSampleStyleSheet()
    header_style = ParagraphStyle(
        'HeaderStyle',
        parent=styles['Heading1'],
        fontSize=16,
        alignment=TA_CENTER,
        spaceAfter=10,
        textColor=colors.HexColor('#1e1b4b')
    )
    
    title_map = {
        'outward': "OUTWARD GATE PASS (RETURNABLE)",
        'inward': "INWARD GATE PASS (RETURNABLE)",
        'handover': "MATERIAL HANDOVER RECEIPT"
    }
    
    elements.append(Paragraph("<b>My BPCL Store Management System</b>", header_style))
    elements.append(Paragraph(f"<b>{title_map.get(type, 'DOCUMENT')}</b>", styles['Heading2']))
    elements.append(Spacer(1, 0.3 * cm))

    # Basic Info
    pass_id = entry.outward_gate_pass_id if type == 'outward' else (entry.inward_gate_pass_id if type == 'inward' else f"REC-{entry.id}")
    date_val = entry.outward_approved_security_at if type == 'outward' else (entry.inward_received_security_at if type == 'inward' else entry.completed_at)
    
    officer_display = entry.officer.username if entry.officer else f"ID #{entry.officer_id}"

    data = [
        [Paragraph("<b>Pass/Doc ID:</b>", styles['Normal']), Paragraph(str(pass_id), styles['Normal']),
         Paragraph("<b>Date:</b>", styles['Normal']), Paragraph(date_val.strftime("%d-%m-%Y %H:%M") if date_val else "N/A", styles['Normal'])],
        
        [Paragraph("<b>Material:</b>", styles['Normal']), Paragraph(entry.material_description, styles['Normal']),
         Paragraph("<b>Vendor:</b>", styles['Normal']), Paragraph(entry.vendor_name, styles['Normal'])],
        
        [Paragraph("<b>Officer:</b>", styles['Normal']), Paragraph(officer_display, styles['Normal']),
         Paragraph("<b>Reason:</b>", styles['Normal']), Paragraph(entry.reason_for_outward or "N/A", styles['Normal'])],

        [Paragraph("<b>Status:</b>", styles['Normal']), Paragraph(entry.status.replace("_", " "), styles['Normal']),
         Paragraph("", styles['Normal']), Paragraph("", styles['Normal'])],
    ]

    t = Table(data, colWidths=[3*cm, 6*cm, 3*cm, 6*cm])
    t.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.8 * cm))

    # Signatures
    sig_data = [
        ["________________________", "________________________", "________________________"],
        ["Initiated By", f"Concerned Officer: {officer_display}", "Security / Receiver"]
    ]
    sig_table = Table(sig_data, colWidths=[6*cm, 6*cm, 6*cm])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('FONTSIZE', (0,1), (-1,1), 8),
    ]))
    elements.append(sig_table)

    doc.build(elements)
    buffer.seek(0)
    return buffer
