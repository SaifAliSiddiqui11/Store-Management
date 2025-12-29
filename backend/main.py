from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from backend.database import engine, get_db
from backend import models, schemas, crud, auth
from datetime import timedelta

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Store Management System")

@app.post("/token", response_model=dict)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.get_user_by_username(db, form_data.username)
    if not user or not crud.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
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

@app.get("/officers", response_model=list[schemas.UserListResponse], tags=["User Management"])
def list_officers(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Get all active officers for dropdown (accessible by Security and Admin)"""
    if current_user.role not in [models.UserRole.SECURITY, models.UserRole.ADMIN, models.UserRole.STORE_MANAGER]:
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
    new_status = "APPROVED_STAGE_1" if action.action == models.ApprovalStatus.APPROVED else "REJECTED_STAGE_1"
    
    
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

@app.get("/officer/pending-issues")
def get_pending_issues(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role != models.UserRole.OFFICER and current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only Officers can view pending issues")
    
    issues = crud.get_pending_issues(db, current_user.id)
    
    # Manually construct response with material names
    response = []
    for issue in issues:
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
            "approved_at": issue.approved_at,
            "approver_name": None
        })
    
    return response

def get_pending_issues(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role != models.UserRole.OFFICER and current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only Officers can view pending issues")
        
    return crud.get_pending_issues(db, current_user.id)

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
        
    return result

# --- Master Data: Materials ---

@app.get("/materials", response_model=list[schemas.MaterialResponse])
def get_materials(db: Session = Depends(get_db)):
    # Any authenticated user can view materials? Yes.
    return crud.get_materials(db)

@app.post("/materials", response_model=schemas.MaterialResponse)
def create_material(
    material: schemas.MaterialCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role != models.UserRole.STORE_MANAGER and current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only Store Manager/Admin can create materials")
    return crud.create_material(db, material)

# Utility for checking API status
@app.get("/")
def root():
    return {"message": "Store Management System API is running"}

# Material Issue History and Receipt
@app.get("/store/issue-history")
def get_store_issue_history(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role != models.UserRole.STORE_MANAGER and current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only Store Managers can view issue history")
    
    issues = crud.get_issue_history(db, current_user.id)
    
    # Return as list of dictionaries
    response = []
    for issue in issues:
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
            "approved_at": issue.approved_at.isoformat() if issue.approved_at else None,
            "approver_name": None
        })
    
    return response

def get_store_issue_history(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if current_user.role != models.UserRole.STORE_MANAGER and current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only Store Managers can view issue history")
        
    return crud.get_issue_history(db, current_user.id)

@app.get("/issue/{issue_id}/receipt")
def download_issue_receipt(
    issue_id: int,
    db: Session = Depends(get_db)
):
    from fastapi.responses import PlainTextResponse
    
    receipt = crud.generate_issue_receipt(db, issue_id)
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found or issue not approved")
    
    return PlainTextResponse(content=receipt, headers={"Content-Disposition": f"attachment; filename=receipt_issue_{issue_id}.txt"})
