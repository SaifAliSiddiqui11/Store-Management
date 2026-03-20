from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, Form, BackgroundTasks, Response
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import Optional
from backend.database import engine, get_db
from backend import models, schemas, crud, auth
from datetime import timedelta, datetime
from backend import seed
import os
from dotenv import load_dotenv

load_dotenv()

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="My BPCL Store Management System")

# CORS Configuration - Dynamic for production
cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,https://store-management-nine-sand.vercel.app")
allow_origins = [origin.strip() for origin in cors_origins_str.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    db = next(get_db())
    seed.seed_default_users(db)

@app.post("/token", response_model=dict)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.get_user_by_username(db, form_data.username)
    if not user or not crud.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(auth.get_current_active_user)):
    return current_user

# --- Admin: User Management ---

@app.post("/admin/users", response_model=schemas.UserResponse, tags=["Admin"])
def create_user_admin(
    user_data: schemas.UserCreateByAdmin,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Admin endpoint to create new users"""
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if username already exists
    existing = crud.get_user_by_username(db, user_data.username)
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    return crud.create_user_by_admin(db, user_data)

@app.get("/admin/users", response_model=list[schemas.UserResponse], tags=["Admin"])
def list_all_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Admin endpoint to get all users"""
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return crud.get_all_users(db)

@app.put("/admin/users/{user_id}/status", response_model=schemas.UserResponse, tags=["Admin"])
def toggle_user_status(
    user_id: int,
    status_data: schemas.UserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Admin endpoint to activate/deactivate users"""
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Prevent admin from deactivating themselves just in case
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot change your own status")
        
    updated_user = crud.update_user_status(db, user_id, status_data.is_active)
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    return updated_user

@app.put("/admin/users/{user_id}/password", response_model=schemas.UserResponse, tags=["Admin"])
def admin_change_user_password(
    user_id: int,
    password_data: schemas.AdminPasswordUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Admin endpoint to change a user's password (except OFFICER's password)"""
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Prevent changing OFFICER password as per requirements
    if target_user.role == models.UserRole.OFFICER.value:
         raise HTTPException(status_code=400, detail="Admins cannot change passwords for Officers")
         
    hashed_password = crud.get_password_hash(password_data.new_password)
    updated_user = crud.update_user_password(db, user_id, hashed_password)
    
    return updated_user

@app.put("/users/me/password", response_model=schemas.UserResponse, tags=["User Management"])
def change_my_password(
    password_data: schemas.OfficerPasswordUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Allow any active user (like an Officer) to change their own password"""
    if not crud.verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect current password")
        
    hashed_password = crud.get_password_hash(password_data.new_password)
    updated_user = crud.update_user_password(db, current_user.id, hashed_password)
    
    return updated_user

@app.get("/officers", response_model=list[schemas.UserListResponse], tags=["User Management"])
def list_officers(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Get all active officers for dropdown (accessible by Security, Officer, Store Manager and Admin)"""
    if current_user.role not in [models.UserRole.SECURITY, models.UserRole.OFFICER, models.UserRole.ADMIN, models.UserRole.STORE_MANAGER]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return crud.get_all_officers(db)


# --- Phase 1: Security Guard / Gate Entry ---

@app.post("/gate-entry/", response_model=schemas.GateEntryResponse)
def create_gate_entry(
    entry: schemas.GateEntryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role != models.UserRole.SECURITY and current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only Security Guard can create Gate Entries")
        
    
    return crud.create_gate_entry(db=db, entry=entry, created_by_id=current_user.id)

@app.get("/gate-entry/{entry_id}/pdf")
def download_gate_pass_pdf(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    from fastapi.responses import StreamingResponse
    
    pdf_buffer = crud.generate_gate_pass_pdf(db, entry_id)
    if not pdf_buffer:
        raise HTTPException(status_code=404, detail="Gate entry not found")
    
    return StreamingResponse(
        pdf_buffer, 
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=gate_pass_{entry_id}.pdf"}
    )

@app.get("/security/history", response_model=list[schemas.GateEntryResponse])
def get_security_history(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role != models.UserRole.SECURITY and current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only Security Guards can view their history")
    
    return crud.get_security_history(db, current_user.id)

@app.put("/gate-entry/{entry_id}", response_model=schemas.GateEntryResponse)
def update_gate_entry(
    entry_id: int,
    update_data: schemas.GateEntryUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """
    Update gate entry details (vendor name, location, material description).
    Security guards can edit their own entries, officers can edit entries assigned to them.
    Only pending entries can be edited.
    """
    if current_user.role not in [models.UserRole.SECURITY, models.UserRole.OFFICER, models.UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only Security Guards and Officers can edit gate entries")
    
    try:
        result = crud.update_gate_entry(db, entry_id, update_data, current_user.id)
        if not result:
            raise HTTPException(status_code=404, detail="Gate entry not found")
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- Phase 2: Officer Approval (Stage 1) ---

@app.get("/officer/pending-stage-1", response_model=list[schemas.GateEntryResponse])
def get_officer_pending_entries(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role != models.UserRole.OFFICER and current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only Officers can view pending approvals")
        
    return crud.get_pending_gate_entries_for_officer(db, current_user.id)

@app.post("/gate-entry/{entry_id}/approve-stage-1", response_model=schemas.GateEntryResponse)
def approve_gate_entry_stage_1(
    entry_id: int,
    action: schemas.ApprovalAction,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role != models.UserRole.OFFICER and current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only Officers can approve")
    
    # 1. Get Entry
    entry = db.query(models.GateEntry).filter(models.GateEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
        
    # 2. Verify assigned officer
    if entry.request_officer_id != current_user.id and current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not assigned to this officer")
        
    # 3. Verify Status
    if entry.status != "PENDING_OFFICER_APPROVAL_1":
        raise HTTPException(status_code=400, detail="Entry not pending stage 1 approval")
        
    # 4. Update Status based on Action
    if action.action == models.ApprovalStatus.APPROVED or action.action == "APPROVED":
        new_status = "APPROVED_STAGE_1"
    elif action.action == models.ApprovalStatus.REJECTED or action.action == "REJECTED":
        new_status = "REJECTED_STAGE_1"
    else:
        raise HTTPException(status_code=400, detail=f"Invalid action: {action.action}")
    
    # Note: In a real system we would likely log remarks in a separate history table
    
    return crud.update_gate_entry_status(db, entry, new_status)

# --- Phase 3: Store Manager Entry & Enrichment ---

@app.get("/store/pending", response_model=list[schemas.GateEntryResponse])
def get_store_pending_entries(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role != models.UserRole.STORE_MANAGER and current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only Store Manager can view pending entries")
        
    return crud.get_pending_store_entries(db)

@app.post("/store/{entry_id}/process", response_model=schemas.GateEntryResponse)
def process_store_entry(
    entry_id: int,
    data: schemas.InwardProcessCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role != models.UserRole.STORE_MANAGER and current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only Store Manager can process entries")
        
    result = crud.process_store_entry(db, entry_id, data, current_user.id)
    
    if not result:
        raise HTTPException(status_code=400, detail="Entry not found or not in correct status")
        
    if not result:
        raise HTTPException(status_code=400, detail="Entry not found or not in correct status")
        
    return result

# --- Store Inventory View ---

@app.get("/store/items", response_model=list[schemas.StoreItemResponse], tags=["Store Operations"])
def get_store_items(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """
    Get inventory items with role-based visibility.
    """
    if current_user.role not in [models.UserRole.STORE_MANAGER, models.UserRole.OFFICER, models.UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    return crud.get_store_items(db, user=current_user)

# --- Phase 4: Officer Final Approval & Inventory Update ---

@app.get("/officer/final-pending", response_model=list[schemas.GateEntryDetailedResponse])
def get_officer_final_pending(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role != models.UserRole.OFFICER and current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only Officers can view final pending approvals")
        
    return crud.get_pending_final_approval_entries(db, current_user.id)

@app.put("/officer/{entry_id}/verification-details", response_model=schemas.GateEntryResponse)
def update_verification_details(
    entry_id: int,
    update_data: schemas.InwardProcessUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role != models.UserRole.OFFICER and current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only Officers can update verification details")
        
    result = crud.update_inward_process(db, entry_id, update_data)
    
    if not result:
        raise HTTPException(status_code=400, detail="Update failed. Entry not found or invalid.")
        
    return result

@app.post("/officer/{entry_id}/final-approve", response_model=schemas.GateEntryResponse)
def final_approve_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role != models.UserRole.OFFICER and current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only Officers can final approve")
        
    result = crud.final_approve_gate_entry(db, entry_id, current_user.id)
    
    if not result:
        raise HTTPException(status_code=400, detail="Entry not found or not in correct status")
        
    return result

@app.post("/officer/{entry_id}/final-reject", response_model=schemas.GateEntryResponse)
def final_reject_entry(
    entry_id: int,
    approval_action: schemas.ApprovalAction, # Reusing ApprovalAction to get remarks
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role != models.UserRole.OFFICER and current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only Officers can final reject")
    
    if approval_action.action != schemas.ApprovalStatus.REJECTED:
         raise HTTPException(status_code=400, detail="Invalid action")

    result = crud.reject_gate_entry_final(db, entry_id, current_user.id, approval_action.remarks or "Rejected by Officer")
    
    if not result:
        raise HTTPException(status_code=400, detail="Entry not found or not in correct status")
        
    return result

# --- Phase 5: Material Issue Workflow ---

@app.post("/issue/request", response_model=schemas.MaterialIssueResponse)
def request_material_issue(
    issue: schemas.MaterialIssueCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role != models.UserRole.STORE_MANAGER and current_user.role != models.UserRole.ADMIN:
        # Assuming Store Manager requests issues on behalf of depts. 
        # (Or maybe any user could, but spec says Store Manager initiates "Material Issue Request by Store Manager")
        raise HTTPException(status_code=403, detail="Only Store Manager can raise issue requests")
        
    return crud.request_issue(db, issue, current_user.id)

@app.get("/officer/pending-issues", response_model=list[schemas.MaterialIssueResponse])
def get_pending_issues(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role != models.UserRole.OFFICER and current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only Officers can view pending issues")
    
    return crud.get_pending_issues(db, current_user.id)

@app.get("/officer/approved-issues", response_model=list[schemas.MaterialIssueResponse])
def get_officer_approved_issues(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role != models.UserRole.OFFICER and current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only Officers can view approved issues")
        
    return crud.get_officer_approved_issues(db, current_user.id)

@app.post("/officer/issue/{issue_id}/approve")
def approve_material_issue(
    issue_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role != models.UserRole.OFFICER and current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only Officers can approve issues")
    
    result = crud.approve_issue(db, issue_id, current_user.id)
    
    if not result:
        # Could be not found, already approved, or low stock
        raise HTTPException(status_code=400, detail="Issue approval failed (check stock or status)")
    
    # Return as dictionary like in pending-issues
    return {
        "id": result.id,
        "material_id": result.material_id,
        "quantity_requested": result.quantity_requested,
        "purpose": result.purpose,
        "requesting_dept": result.requesting_dept,
        "officer_id": result.officer_id,
        "status": result.status,
        "requested_by_id": result.requested_by_id,
        "issue_note_id": result.issue_note_id,
        "material_name": result.material.name if result.material else None,
        "approved_at": result.approved_at,
        "approver_name": current_user.username
    }

@app.post("/officer/issue/{issue_id}/reject")
def reject_material_issue(
    issue_id: int,
    approval_action: schemas.ApprovalAction,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role != models.UserRole.OFFICER and current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only Officers can reject issues")
    
    result = crud.reject_issue(db, issue_id, current_user.id, approval_action.remarks or "Rejected by Officer")
    
    if not result:
        raise HTTPException(status_code=400, detail="Issue not found or not in correct status")
    
    return {
        "id": result.id,
        "material_id": result.material_id,
        "quantity_requested": result.quantity_requested,
        "purpose": result.purpose,
        "requesting_dept": result.requesting_dept,
        "officer_id": result.officer_id,
        "status": result.status,
        "requested_by_id": result.requested_by_id,
        "issue_note_id": result.issue_note_id,
        "material_name": result.material.name if result.material else None,
        "approved_at": result.approved_at,
        "approver_name": current_user.username
    }

# --- Master Data: Materials ---

@app.get("/materials", response_model=list[schemas.MaterialDetail])
def get_materials(db: Session = Depends(get_db)):
    # Any authenticated user can view materials? Yes.
    return crud.get_materials(db)

@app.post("/materials", response_model=schemas.MaterialResponse)
def create_material(
    material: schemas.MaterialCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role not in [models.UserRole.OFFICER, models.UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only Officers can create materials")
    return crud.create_material(db, material)

@app.put("/admin/materials/{material_id}", response_model=schemas.MaterialResponse, tags=["Admin"])
def update_material(
    material_id: int,
    update_data: schemas.MaterialUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Admin endpoint to update material properties"""
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only Admin can edit materials")
    
    try:
        result = crud.update_material(db, material_id, update_data)
        if not result:
            raise HTTPException(status_code=404, detail="Material not found")
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Material Variant Endpoints ---

@app.get("/materials/{material_id}/variant-suggestions", tags=["Material Variants"])
def get_variant_suggestions(
    material_id: int,
    field: str,
    search: str = "",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """
    Get autocomplete suggestions for variant fields (rating, size, material_make).
    Query params:
    - field: 'rating', 'size', or 'material_make'
    - search: optional partial text to filter suggestions
    """
    if field not in ['rating', 'size', 'material_make']:
        raise HTTPException(status_code=400, detail="Invalid field. Must be 'rating', 'size', or 'material_make'")
    
    return crud.get_variant_suggestions(db, material_id, field, search)


@app.get("/materials/{material_id}/variants", response_model=list[schemas.MaterialVariantResponse], tags=["Material Variants"])
def get_material_variants(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Get all variants for a specific material"""
    return crud.get_material_variants(db, material_id)


@app.get("/materials/{material_id}/details", response_model=schemas.MaterialDetail, tags=["Material Variants"])
def get_material_details(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Get material with all its variants"""
    material = crud.get_material_with_variants(db, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    return material

# Utility for checking API status
@app.get("/")
def root():
    return {"message": "Store Management System API is running"}

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    """Health check endpoint to verify database and users"""
    try:
        # Check database connectivity
        user_count = db.query(models.User).count()
        
        # Get user details
        users = db.query(models.User).all()
        user_details = [
            {
                "username": u.username,
                "role": u.role,
                "is_active": u.is_active
            }
            for u in users
        ]
        
        return {
            "status": "healthy",
            "database": "connected",
            "user_count": user_count,
            "users": user_details,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "error",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }

# Material Issue History and Receipt
@app.get("/store/issue-history")
def get_store_issue_history(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role != models.UserRole.STORE_MANAGER and current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only Store Managers can view issue history")
    
    issues = crud.get_issue_history(db, current_user.id)
    
    # Return as list of dictionaries with items
    response = []
    for issue in issues:
        # Build items array
        items_list = []
        if issue.items:
            for item in issue.items:
                items_list.append({
                    "material_description": item.material.name if item.material else "Unknown",
                    "material_category": item.material.category if item.material else None,
                    "material_unit": item.material.unit if item.material else None,
                    "quantity_issued": item.quantity_issued,
                    "rating": item.rating,
                    "size": item.size,
                    "material_make": item.material_make
                })
        
        response.append({
            "id": issue.id,
            "material_id": issue.material_id,
            "quantity_requested": issue.quantity_requested,
            "purpose": issue.purpose,
            "requesting_dept": issue.requesting_dept,
            "officer_id": issue.officer_id,
            "status": issue.status,
            "requested_by_id": issue.requested_by_id,
            "issue_note_id": issue.issue_note_id,
            "material_name": issue.material.name if issue.material else None,
            "material_unit": issue.material.unit if issue.material else None,
            "created_at": issue.created_at.isoformat() if issue.created_at else None,
            "approved_at": issue.approved_at.isoformat() if issue.approved_at else None,
            "approver_name": None,
            "items": items_list  # Add items array
        })
    
    return response



@app.get("/issue/{issue_id}/receipt")
def get_issue_receipt(
    issue_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Get text receipt for approved issue"""
    receipt = crud.generate_issue_receipt(db, issue_id)
    if not receipt:
        raise HTTPException(status_code=404, detail="Issue not found or not approved")
    
    return Response(content=receipt, media_type="text/plain")


@app.get("/issue/{issue_id}/approval-note", tags=["Material Issues"])
def download_issue_approval_pdf(
    issue_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Download PDF approval note for an approved material issue"""
    # Generate PDF
    pdf_bytes = crud.generate_issue_approval_pdf(db, issue_id)
    
    if not pdf_bytes:
        raise HTTPException(status_code=404, detail="Issue not found or not approved")
    
    # Get issue for filename
    issue = db.query(models.MaterialIssue).filter(models.MaterialIssue.id == issue_id).first()
    filename = f"Approval_Note_{issue.issue_note_id or f'ISS-{issue.id}'}.pdf"
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )

# --- Returnables Workflow ---

@app.post("/returnables", response_model=schemas.ReturnableEntryResponse, tags=["Returnables"])
def create_returnable(
    entry: schemas.ReturnableEntryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role not in [models.UserRole.STORE_MANAGER, models.UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only Store Managers can initiate returnables")
    return crud.create_returnable_entry(db, entry, current_user.id)

@app.get("/returnables/officer/pending-outward", response_model=list[schemas.ReturnableEntryResponse], tags=["Returnables"])
def get_pending_outward_officer(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role not in [models.UserRole.OFFICER, models.UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    return crud.get_returnable_pending_officer_outward(db, current_user.id)

@app.post("/returnables/{entry_id}/approve-outward-officer", response_model=schemas.ReturnableEntryResponse, tags=["Returnables"])
def approve_outward_officer(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role not in [models.UserRole.OFFICER, models.UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    result = crud.approve_returnable_outward_officer(db, entry_id, current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Entry not found or already processed")
    return result

@app.get("/returnables/security/pending-outward", response_model=list[schemas.ReturnableEntryResponse], tags=["Returnables"])
def get_pending_outward_security(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role not in [models.UserRole.SECURITY, models.UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    return crud.get_returnable_pending_security_outward(db)

@app.post("/returnables/{entry_id}/approve-outward-security", response_model=schemas.ReturnableEntryResponse, tags=["Returnables"])
def approve_outward_security(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role not in [models.UserRole.SECURITY, models.UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    result = crud.approve_returnable_outward_security(db, entry_id)
    if not result:
        raise HTTPException(status_code=404, detail="Entry not found")
    return result

@app.get("/returnables/security/pending-inward", response_model=list[schemas.ReturnableEntryResponse], tags=["Returnables"])
def get_security_pending_inward(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """All items currently with vendors (OUTWARD_COMPLETED) — security receives these back."""
    if current_user.role not in [models.UserRole.SECURITY, models.UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    return crud.get_returnable_pending_security_inward(db)

@app.get("/returnables/search/{outward_id}", response_model=schemas.ReturnableEntryResponse, tags=["Returnables"])
def search_returnable(
    outward_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role not in [models.UserRole.SECURITY, models.UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    result = crud.get_returnable_by_outward_id(db, outward_id)
    if not result:
        raise HTTPException(status_code=404, detail="Outward Gate Pass not found or not in correct status")
    return result

@app.post("/returnables/{entry_id}/receive-inward-security", response_model=schemas.ReturnableEntryResponse, tags=["Returnables"])
def receive_inward_security(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role not in [models.UserRole.SECURITY, models.UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    result = crud.receive_returnable_inward_security(db, entry_id)
    if not result:
        raise HTTPException(status_code=404, detail="Entry not found")
    return result

@app.get("/returnables/officer/pending-inward", response_model=list[schemas.ReturnableEntryResponse], tags=["Returnables"])
def get_pending_inward_officer(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role not in [models.UserRole.OFFICER, models.UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    return crud.get_returnable_pending_officer_inward(db, current_user.id)

@app.post("/returnables/{entry_id}/approve-inward-officer", response_model=schemas.ReturnableEntryResponse, tags=["Returnables"])
def approve_inward_officer(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role not in [models.UserRole.OFFICER, models.UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    result = crud.approve_returnable_inward_officer(db, entry_id, current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Entry not found")
    return result

@app.post("/returnables/{entry_id}/reject-outward-officer", response_model=schemas.ReturnableEntryResponse, tags=["Returnables"])
def reject_outward_officer(
    entry_id: int,
    action: schemas.ReturnableAction = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role not in [models.UserRole.OFFICER, models.UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    remarks = action.remarks if action else None
    result = crud.reject_returnable_outward_officer(db, entry_id, current_user.id, remarks)
    if not result:
        raise HTTPException(status_code=404, detail="Entry not found or not in correct status")
    return result

@app.post("/returnables/{entry_id}/reject-inward-officer", response_model=schemas.ReturnableEntryResponse, tags=["Returnables"])
def reject_inward_officer(
    entry_id: int,
    action: schemas.ReturnableAction = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role not in [models.UserRole.OFFICER, models.UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    remarks = action.remarks if action else None
    result = crud.reject_returnable_inward_officer(db, entry_id, current_user.id, remarks)
    if not result:
        raise HTTPException(status_code=404, detail="Entry not found or not in correct status")
    return result

@app.patch("/returnables/{entry_id}", response_model=schemas.ReturnableEntryResponse, tags=["Returnables"])
def update_returnable(
    entry_id: int,
    data: schemas.ReturnableEntryUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role not in [models.UserRole.OFFICER, models.UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only Officers can edit returnable entries")
    result = crud.update_returnable_entry(db, entry_id, current_user.id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Entry not found, not assigned to you, or not in editable status")
    return result

@app.get("/returnables/store/pending-final", response_model=list[schemas.ReturnableEntryResponse], tags=["Returnables"])
def get_pending_final_store(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role not in [models.UserRole.STORE_MANAGER, models.UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    return crud.get_returnable_pending_store_manager_final(db)

@app.post("/returnables/{entry_id}/finalize", response_model=schemas.ReturnableEntryResponse, tags=["Returnables"])
def finalize_returnable(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role not in [models.UserRole.STORE_MANAGER, models.UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    result = crud.finalize_returnable_store_manager(db, entry_id, current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Entry not found")
    return result

@app.get("/returnables/history", response_model=list[schemas.ReturnableEntryResponse], tags=["Returnables"])
def get_returnable_history(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    return crud.get_returnable_history(db, current_user.role, current_user.id)


@app.get("/returnables/{entry_id}/pdf/{type}", tags=["Returnables"])
def download_returnable_pdf(
    entry_id: int,
    type: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Download PDF: outward_pass, inward_pass, handover_receipt"""
    if type not in ['outward', 'inward', 'handover']:
        raise HTTPException(status_code=400, detail="Invalid PDF type")
    
    from fastapi.responses import StreamingResponse
    
    pdf_buffer = crud.generate_returnable_pdf(db, entry_id, type)
    if not pdf_buffer:
        raise HTTPException(status_code=404, detail="Returnable entry not found")
    
    filename = f"Returnable_{type}_{entry_id}.pdf"
    
    return StreamingResponse(
        pdf_buffer, 
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={filename}"}
    )


# --- Reports: Material Inward Report ---

@app.get("/reports/material-inward", response_model=schemas.InwardReportResponse, tags=["Reports"])
def get_material_inward_report(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    officer_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Get filtered material inward report data"""
    if current_user.role not in [models.UserRole.OFFICER, models.UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only Officers and Admins can access reports")
    
    # Normalize dates to naive if they are aware (strip UTC offset)
    if start_date and start_date.tzinfo:
        start_date = start_date.replace(tzinfo=None)
    if end_date and end_date.tzinfo:
        end_date = end_date.replace(tzinfo=None)

    data = crud.get_inward_report_data(
        db=db,
        start_date=start_date,
        end_date=end_date,
        officer_id=officer_id,
        search=search
    )
    
    return {"data": data, "total_count": len(data)}

@app.get("/reports/material-inward/pdf", tags=["Reports"])
def download_material_inward_report_pdf(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    officer_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Download filtered material inward report as PDF"""
    if current_user.role not in [models.UserRole.OFFICER, models.UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only Officers and Admins can access reports")
    
    # Normalize dates to naive if they are aware
    if start_date and start_date.tzinfo:
        start_date = start_date.replace(tzinfo=None)
    if end_date and end_date.tzinfo:
        end_date = end_date.replace(tzinfo=None)

    data = crud.get_inward_report_data(
        db=db,
        start_date=start_date,
        end_date=end_date,
        officer_id=officer_id,
        search=search
    )
    
    title = "Material Inward Report"
    if start_date and end_date and start_date.date() == end_date.date():
        title = f"Daily Material Inward Activity - {start_date.strftime('%d-%m-%Y')}"
    elif start_date or end_date:
        date_str = ""
        if start_date: date_str += f"From {start_date.strftime('%d-%m-%Y')} "
        if end_date: date_str += f"To {end_date.strftime('%d-%m-%Y')}"
        title = f"Material Inward Report ({date_str.strip()})"
        
    pdf_bytes = crud.generate_inward_report_pdf(data, title=title)
    
    filename = f"Material_Inward_Report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )

# --- Inventory Report Endpoints ---

@app.get("/reports/inventory", response_model=schemas.InventoryReportResponse, tags=["Reports"])
def get_inventory_report(
    category: Optional[str] = None,
    search: Optional[str] = None,
    make: Optional[str] = None,
    size: Optional[str] = None,
    rating: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Get live inventory report data"""
    if current_user.role not in [models.UserRole.OFFICER, models.UserRole.ADMIN, models.UserRole.STORE_MANAGER]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    data = crud.get_inventory_report_data(
        db=db,
        category=category,
        search=search,
        make=make,
        size=size,
        rating=rating
    )
    
    return {"data": data, "total_count": len(data)}

@app.get("/reports/inventory/pdf", tags=["Reports"])
def download_inventory_report_pdf(
    category: Optional[str] = None,
    search: Optional[str] = None,
    make: Optional[str] = None,
    size: Optional[str] = None,
    rating: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Download live inventory report as PDF"""
    if current_user.role not in [models.UserRole.OFFICER, models.UserRole.ADMIN, models.UserRole.STORE_MANAGER]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    data = crud.get_inventory_report_data(
        db=db,
        category=category,
        search=search,
        make=make,
        size=size,
        rating=rating
    )
    
    pdf_bytes = crud.generate_inventory_report_pdf(data)
    
    filename = f"Live_Inventory_Report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )

# --- Material Issue Report Endpoints ---

@app.get("/reports/material-issue", response_model=schemas.IssueReportResponse, tags=["Reports"])
def get_material_issue_report(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    officer_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Get filtered material issue report data"""
    if current_user.role not in [models.UserRole.OFFICER, models.UserRole.ADMIN, models.UserRole.STORE_MANAGER]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Normalize dates
    if start_date and start_date.tzinfo:
        start_date = start_date.replace(tzinfo=None)
    if end_date and end_date.tzinfo:
        end_date = end_date.replace(tzinfo=None)

    data = crud.get_issue_report_data(
        db=db,
        start_date=start_date,
        end_date=end_date,
        category=category,
        status=status,
        officer_id=officer_id,
        search=search
    )
    
    return {"data": data, "total_count": len(data)}

@app.get("/reports/material-issue/pdf", tags=["Reports"])
def download_material_issue_report_pdf(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    officer_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Download filtered material issue report as PDF"""
    if current_user.role not in [models.UserRole.OFFICER, models.UserRole.ADMIN, models.UserRole.STORE_MANAGER]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Normalize dates
    if start_date and start_date.tzinfo:
        start_date = start_date.replace(tzinfo=None)
    if end_date and end_date.tzinfo:
        end_date = end_date.replace(tzinfo=None)

    data = crud.get_issue_report_data(
        db=db,
        start_date=start_date,
        end_date=end_date,
        category=category,
        status=status,
        officer_id=officer_id,
        search=search
    )
    
    title = "Material Issue & Consumption Report"
    if start_date and end_date and start_date.date() == end_date.date():
        title = f"Daily Material Consumption - {start_date.strftime('%d-%m-%Y')}"
        
    pdf_bytes = crud.generate_issue_report_pdf(data, title=title)
    
    filename = f"Material_Issue_Report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )
