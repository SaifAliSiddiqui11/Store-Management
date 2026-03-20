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

class UserStatusUpdate(BaseModel):
    is_active: bool

class AdminPasswordUpdate(BaseModel):
    new_password: str

class OfficerPasswordUpdate(BaseModel):
    current_password: str
    new_password: str

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
    min_stock_level: int

class MaterialCreate(MaterialBase):
    pass

class MaterialUpdate(BaseModel):
    """Schema for admin to update material properties"""
    code: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[MaterialCategory] = None
    unit: Optional[str] = None
    min_stock_level: Optional[int] = None

class MaterialResponse(MaterialBase):
    id: int
    current_stock: int
    
    class Config:
        from_attributes = True


# --- Material Variant Schemas ---
class MaterialVariantBase(BaseModel):
    rating: Optional[str] = None
    size: Optional[str] = None
    material_make: Optional[str] = None


class MaterialVariantCreate(MaterialVariantBase):
    material_id: int


class MaterialVariantResponse(MaterialVariantBase):
    id: int
    material_id: int
    created_at: datetime
    total_quantity_received: Optional[int] = 0
    current_stock: Optional[int] = 0
    
    class Config:
        from_attributes = True


class MaterialVariantSuggestion(BaseModel):
    """Autocomplete suggestions for variant fields"""
    value: str
    count: int  # How many times this value appears


class MaterialDetail(MaterialBase):
    """Enhanced material response with variants"""
    id: int
    current_stock: int
    variants: List[MaterialVariantResponse] = []
    
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

class GateEntryUpdate(BaseModel):
    """Schema for updating gate entry details (vendor info and material description)"""
    vendor_name: Optional[str] = None
    vendor_location: Optional[str] = None
    material_type_desc: Optional[str] = None
    
    class Config:
        from_attributes = True

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
    material_variant_id: Optional[int] = None  # Link to material variant
    quantity_received: int
    store_room: Optional[str] = None
    rack_no: Optional[str] = None
    shelf_no: Optional[str] = None
    
    # Fields to update Material Master
    material_description: Optional[str] = None
    material_category: Optional[str] = None
    material_unit: Optional[str] = None
    min_stock_level: Optional[int] = None
    
    # Additional Material Specifications
    rating: Optional[str] = None
    size: Optional[str] = None
    material_make: Optional[str] = None

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
    rating: Optional[str] = None
    size: Optional[str] = None
    material_make: Optional[str] = None

class InwardProcessUpdate(BaseModel):
    invoice_no: Optional[str] = None
    invoice_date: Optional[datetime] = None
    remarks: Optional[str] = None
    items: List[InwardItemUpdate]

# --- Material Issue Schemas ---
# --- Material Issue Schemas ---
class MaterialIssueItemBase(BaseModel):
    material_id: int
    material_variant_id: Optional[int] = None
    quantity_issued: int
    material_description: Optional[str] = None
    material_category: Optional[str] = None
    material_unit: Optional[str] = None
    rating: Optional[str] = None
    size: Optional[str] = None
    material_make: Optional[str] = None
    store_room: Optional[str] = None
    rack_no: Optional[str] = None
    shelf_no: Optional[str] = None
    lot_number: Optional[str] = None

class MaterialIssueItemCreate(MaterialIssueItemBase):
    pass

class MaterialIssueItemResponse(MaterialIssueItemBase):
    id: int
    material_issue_id: int
    
    class Config:
        from_attributes = True


class MaterialIssueBase(BaseModel):
    purpose: str
    requesting_dept: str
    officer_id: int  # Officer to approve this issue
    # Legacy fields (optional for backward compatibility)
    material_id: Optional[int] = None
    quantity_requested: Optional[int] = None

class MaterialIssueCreate(MaterialIssueBase):
    items: Optional[List[MaterialIssueItemCreate]] = []  # New: support multiple items

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
    items: List[MaterialIssueItemResponse] = []  # New: include items
    
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
    material_id: Optional[int] = None  # Material ID for autocomplete
    material_code: Optional[str] = None  # From Material Master if linked
    material_description: Optional[str]
    material_category: Optional[str]
    material_unit: Optional[str]
    quantity_received: int
    store_room: Optional[str]
    rack_no: Optional[str]
    shelf_no: Optional[str]
    min_stock_level: Optional[int]
    rating: Optional[str] = None
    size: Optional[str] = None
    material_make: Optional[str] = None
    
    class Config:
        from_attributes = True
        
    @classmethod
    def from_orm(cls, obj):
        # Populate material_code from Material relationship if exists
        data = {
            'id': obj.id,
            'material_id': obj.material_id,
            'material_code': obj.material.code if obj.material else None,
            'material_description': obj.material_description,
            'material_category': obj.material_category,
            'material_unit': obj.material_unit,
            'quantity_received': obj.quantity_received,
            'store_room': obj.store_room,
            'rack_no': obj.rack_no,
            'shelf_no': obj.shelf_no,
            'min_stock_level': obj.min_stock_level,
            'rating': obj.rating,
            'size': obj.size,
            'material_make': obj.material_make
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

# --- Report Schemas ---
class InwardReportItem(BaseModel):
    id: int
    gate_pass_number: str
    date: datetime
    vendor_name: str
    vendor_location: Optional[str] = None
    material_description: Optional[str] = None
    quantity: Optional[int] = None
    officer_name: str
    status: str
    invoice_no: Optional[str] = None
    invoice_date: Optional[datetime] = None
    final_approved_at: Optional[datetime] = None
    remarks: Optional[str] = None

    class Config:
        from_attributes = True

class InwardReportResponse(BaseModel):
    data: List[InwardReportItem]
    total_count: int

# --- Inventory Report Schemas ---
class InventoryReportItem(BaseModel):
    material_code: str
    material_name: str
    category: str
    unit: str
    rating: Optional[str] = None
    size: Optional[str] = None
    material_make: Optional[str] = None
    store_room: Optional[str] = None
    rack_no: Optional[str] = None
    shelf_no: Optional[str] = None
    quantity: int

class InventoryReportResponse(BaseModel):
    data: List[InventoryReportItem]
    total_count: int

# --- Issue Report Schemas ---
class IssueReportItem(BaseModel):
    id: int
    issue_note_id: Optional[str] = None
    date: datetime
    material_code: str
    material_name: str
    category: str
    unit: str
    quantity: int
    rating: Optional[str] = None
    size: Optional[str] = None
    material_make: Optional[str] = None
    department: str
    purpose: str
    status: str
    officer_name: str
    approved_at: Optional[datetime] = None

class IssueReportResponse(BaseModel):
    data: List[IssueReportItem]
    total_count: int


# --- Returnables Schemas ---
class ReturnableEntryBase(BaseModel):
    material_description: str
    vendor_name: str
    reason_for_outward: Optional[str] = None
    officer_id: int

class ReturnableEntryCreate(ReturnableEntryBase):
    pass

class ReturnableEntryResponse(ReturnableEntryBase):
    id: int
    outward_gate_pass_id: Optional[str] = None
    inward_gate_pass_id: Optional[str] = None
    status: str
    created_at: datetime
    initiated_by_id: int
    outward_approved_officer_at: Optional[datetime] = None
    outward_approved_security_at: Optional[datetime] = None
    inward_received_security_at: Optional[datetime] = None
    inward_approved_officer_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    remarks: Optional[str] = None
    officer_name: Optional[str] = None

    class Config:
        from_attributes = True

class ReturnableAction(BaseModel):
    remarks: Optional[str] = None

class ReturnableEntryUpdate(BaseModel):
    material_description: Optional[str] = None
    vendor_name: Optional[str] = None
    reason_for_outward: Optional[str] = None
