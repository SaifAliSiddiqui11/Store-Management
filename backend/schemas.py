from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from backend.models import UserRole, ApprovalStatus, MaterialCategory

# --- User Schemas ---
class UserBase(BaseModel):
    username: str
    email: Optional[EmailStr] = None
    role: UserRole
    is_active: Optional[bool] = True

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    
    class Config:
        orm_mode = True

# --- Vendor Schemas ---
class VendorBase(BaseModel):
    name: str
    address: Optional[str] = None
    contact_person: Optional[str] = None
    contact_number: Optional[str] = None

class VendorCreate(VendorBase):
    pass

class VendorResponse(VendorBase):
    id: int
    
    class Config:
        orm_mode = True

# --- Material Schemas ---
class MaterialBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    category: MaterialCategory
    unit: str
    min_stock_level: int = 10

class MaterialCreate(MaterialBase):
    pass

class MaterialResponse(MaterialBase):
    id: int
    current_stock: int
    
    class Config:
        orm_mode = True

# --- Gate Entry Schemas ---
class GateEntryBase(BaseModel):
    vendor_name: str
    vendor_location: Optional[str] = None
    vehicle_number: Optional[str] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    material_type_desc: Optional[str] = None
    approx_quantity: Optional[int] = None
    request_officer_id: int # Officer ID to send approval to

class GateEntryCreate(GateEntryBase):
    pass

class GateEntryResponse(GateEntryBase):
    id: int
    gate_pass_number: str
    created_at: datetime
    created_by_id: int
    status: str
    
    class Config:
        orm_mode = True

# --- Common Response Schemas ---
class ApprovalAction(BaseModel):
    action: ApprovalStatus # APPROVED / REJECTED
    remarks: Optional[str] = None

# --- Inward Process Schemas ---
class InwardItemCreate(BaseModel):
    material_id: Optional[int] = None # Optional for now if master data not fully populated
    quantity_received: int
    store_room: Optional[str] = None
    rack_no: Optional[str] = None
    shelf_no: Optional[str] = None

class InwardProcessCreate(BaseModel):
    invoice_no: str
    invoice_date: datetime
    remarks: Optional[str] = None
    items: List[InwardItemCreate]

# --- Material Issue Schemas ---
class MaterialIssueBase(BaseModel):
    material_id: int
    quantity_requested: int
    purpose: str
    requesting_dept: str

class MaterialIssueCreate(MaterialIssueBase):
    pass

class MaterialIssueResponse(MaterialIssueBase):
    id: int
    status: str
    requested_by_id: int
    issue_note_id: Optional[str]
    
    class Config:
        orm_mode = True
