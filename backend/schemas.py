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
        from_attributes = True

class UserCreateByAdmin(BaseModel):
    """Schema for admin to create users"""
    username: str
    email: EmailStr
    password: str
    role: UserRole

class UserListResponse(BaseModel):
    """Simplified user info for listings"""
    id: int
    username: str
    email: Optional[str]
    role: str
    is_active: bool
    
    class Config:
        from_attributes = True

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
        from_attributes = True

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
        from_attributes = True

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
        from_attributes = True

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
    
    # Fields to update Material Master
    material_description: Optional[str] = None
    material_category: Optional[str] = None
    material_unit: Optional[str] = None
    min_stock_level: Optional[int] = None

class InwardProcessCreate(BaseModel):
    invoice_no: str
    invoice_date: datetime
    remarks: Optional[str] = None
    vendor_name: Optional[str] = None # To update Gate Entry
    items: List[InwardItemCreate]

class InwardItemUpdate(BaseModel):
    id: int
    quantity_received: Optional[int] = None
    store_room: Optional[str] = None
    rack_no: Optional[str] = None
    shelf_no: Optional[str] = None
    material_description: Optional[str] = None
    material_category: Optional[str] = None
    material_unit: Optional[str] = None

class InwardProcessUpdate(BaseModel):
    invoice_no: Optional[str] = None
    invoice_date: Optional[datetime] = None
    remarks: Optional[str] = None
    items: List[InwardItemUpdate]

# --- Material Issue Schemas ---
class MaterialIssueBase(BaseModel):
    material_id: int
    quantity_requested: int
    purpose: str
    requesting_dept: str
    officer_id: int  # Officer to approve this issue

class MaterialIssueCreate(MaterialIssueBase):
    pass

class MaterialIssueResponse(MaterialIssueBase):
    id: int
    status: str
    requested_by_id: int
    issue_note_id: Optional[str]
    material_name: Optional[str] = None  # From Material relationship
    material_unit: Optional[str] = None
    approved_at: Optional[datetime] = None
    approver_name: Optional[str] = None
    material_category: Optional[str] = None
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# --- Store View Schemas ---
class StoreItemResponse(BaseModel):
    id: int # InwardItem ID (unique stock entry)
    material_name: str
    material_code: str
    category: str
    quantity: int
    unit: str
    store_room: Optional[str]
    rack_no: Optional[str]
    shelf_no: Optional[str]
    inward_date: Optional[datetime]
    officer_name: Optional[str] = None # For Store Manager view
    
    class Config:
        from_attributes = True

# --- Enhanced Schemas for Officer Stage 2 View ---
class InwardItemDetail(BaseModel):
    """Detailed inward item info for Officer review"""
    id: int
    material_code: Optional[str] = None  # From Material Master if linked
    material_description: Optional[str]
    material_category: Optional[str]
    material_unit: Optional[str]
    quantity_received: int
    store_room: Optional[str]
    rack_no: Optional[str]
    shelf_no: Optional[str]
    min_stock_level: Optional[int]
    
    class Config:
        from_attributes = True
        
    @classmethod
    def from_orm(cls, obj):
        # Populate material_code from Material relationship if exists
        data = {
            'id': obj.id,
            'material_code': obj.material.code if obj.material else None,
            'material_description': obj.material_description,
            'material_category': obj.material_category,
            'material_unit': obj.material_unit,
            'quantity_received': obj.quantity_received,
            'store_room': obj.store_room,
            'rack_no': obj.rack_no,
            'shelf_no': obj.shelf_no,
            'min_stock_level': obj.min_stock_level
        }
        return cls(**data)

class InwardProcessDetail(BaseModel):
    """Store Manager verification details"""
    invoice_no: Optional[str]
    invoice_date: Optional[datetime]
    remarks: Optional[str]
    items: List[InwardItemDetail]
    
    class Config:
        from_attributes = True

class GateEntryDetailedResponse(GateEntryBase):
    """Enhanced response with inward process details for Stage 2"""
    id: int
    gate_pass_number: str
    created_at: datetime
    created_by_id: int
    status: str
    inward_process: Optional[InwardProcessDetail] = None
    
    class Config:
        from_attributes = True
