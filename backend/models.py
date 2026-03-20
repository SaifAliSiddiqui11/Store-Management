from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Enum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func, text
import enum
from datetime import datetime
from zoneinfo import ZoneInfo
from backend.database import Base

# Helper function to get current IST time
def get_ist_now():
    return datetime.now(ZoneInfo("Asia/Kolkata")).replace(tzinfo=None)

# Enums based on the workflow
class UserRole(str, enum.Enum):
    SECURITY = "SECURITY"
    OFFICER = "OFFICER"
    STORE_MANAGER = "STORE_MANAGER"
    ADMIN = "ADMIN"

class ApprovalStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class MaterialCategory(str, enum.Enum):
    CONSUMABLE = "CONSUMABLE"
    SPARE = "SPARE"
    ASSET = "ASSET"
    FIRE_AND_SAFETY = "FIRE_AND_SAFETY"
    AUTOMATION = "AUTOMATION"
    ELECTRICAL = "ELECTRICAL"
    MECHANICAL = "MECHANICAL"
    CHEMICALS = "CHEMICALS"
    OILS_AND_LUBRICANTS = "OILS_AND_LUBRICANTS"
    STATIONARY = "STATIONARY"

# --- Master Data ---

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String)
    role = Column(String) # Storing as string to keep DB simple for now, validated via Pydantic/Enum in app
    is_active = Column(Boolean, default=True)

class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    address = Column(String, nullable=True)
    contact_person = Column(String, nullable=True)
    contact_number = Column(String, nullable=True)

class Material(Base):
    __tablename__ = "materials"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True) # E.g., MAT-001
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    category = Column(String) # Consumable, etc.
    unit = Column(String) # Nos, Kg, Ltr
    min_stock_level = Column(Integer, default=10) # Alert threshold
    
    current_stock = Column(Integer, default=0) # Denormalized for quick access
    
    # Relationship to variants
    variants = relationship("MaterialVariant", back_populates="material")


class MaterialVariant(Base):
    """
    Stores unique combinations of rating, size, and material_make for each material.
    This allows tracking sub-categories and provides autocomplete suggestions.
    """
    __tablename__ = "material_variants"
    
    id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    rating = Column(String, nullable=True)  # Material rating/grade
    size = Column(String, nullable=True)  # Material size/dimensions
    material_make = Column(String, nullable=True)  # Material manufacturer/make
    created_at = Column(DateTime, default=get_ist_now)
    
    # Relationships
    material = relationship("Material", back_populates="variants")
    inward_items = relationship("InwardItem", back_populates="material_variant")

# --- Transactions ---

class GateEntry(Base):
    """
    Step 1: Security Guard creates this.
    """
    __tablename__ = "gate_entries"

    id = Column(Integer, primary_key=True, index=True)
    gate_pass_number = Column(String, unique=True, index=True) # Generated ID
    vendor_name = Column(String) # Text entry if vendor master not linked yet, or fallback
    vendor_location = Column(String, nullable=True) # Origin of vendor
    vehicle_number = Column(String, nullable=True)
    driver_name = Column(String, nullable=True)
    driver_phone = Column(String, nullable=True)
    
    # Who requested it / Initial details
    material_type_desc = Column(String, nullable=True) # General description by Guard
    approx_quantity = Column(Integer, nullable=True) 
    
    created_at = Column(DateTime, default=get_ist_now)
    created_by_id = Column(Integer, ForeignKey("users.id"))
    
    # Workflow Status
    status = Column(String, default="PENDING_OFFICER_APPROVAL_1") # PENDING_OFFICER_APPROVAL_1, APPROVED_STAGE_1, REJECTED, ...
    
    request_officer_id = Column(Integer, ForeignKey("users.id")) # Officer to whom request is raised
    
    # Relationships
    created_by = relationship("User", foreign_keys=[created_by_id])
    officer = relationship("User", foreign_keys=[request_officer_id])
    
    inward_process = relationship("InwardProcess", back_populates="gate_entry", uselist=False)


class InwardProcess(Base):
    """
    Step 2 & 3: Store Manager Verification & Officer Final Approval.
    Linked 1-to-1 with GateEntry.
    """
    __tablename__ = "inward_processes"

    id = Column(Integer, primary_key=True, index=True)
    gate_entry_id = Column(Integer, ForeignKey("gate_entries.id"), unique=True)
    
    # Store Manager Verification Details
    invoice_no = Column(String, nullable=True)
    invoice_date = Column(DateTime, nullable=True)
    physical_check_done = Column(Boolean, default=False)
    
    # Material details verified by Store Manager (could be multiple items ideally, but keeping 1:1 for simplicity if user implied single item entries, OR we can make a child table 'InwardItems'. Let's stick to 1 main item for now as per previous simple schema, but prepared for expansion)
    # Actually, proper store management usually has multiple items per invoice. 
    # Let's create 'InwardItem' table for the actual verified items.
    
    remarks = Column(String, nullable=True)
    
    # Final Approval
    final_approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    final_approved_at = Column(DateTime, nullable=True)
    
    gate_entry = relationship("GateEntry", back_populates="inward_process")
    items = relationship("InwardItem", back_populates="inward_process")


class InwardItem(Base):
    """
    Specific items entered by Store Manager during verification.
    """
    __tablename__ = "inward_items"

    id = Column(Integer, primary_key=True, index=True)
    inward_process_id = Column(Integer, ForeignKey("inward_processes.id"))
    
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=True) # Linked to master
    material_variant_id = Column(Integer, ForeignKey("material_variants.id"), nullable=True) # Linked to variant
    quantity_received = Column(Integer)
    
    # Material details (direct text entry)
    material_description = Column(String, nullable=True)
    material_category = Column(String, nullable=True)
    material_unit = Column(String, nullable=True)
    min_stock_level = Column(Integer, nullable=True)
    
    # Additional Material Specifications
    rating = Column(String, nullable=True)  # Material rating/grade
    size = Column(String, nullable=True)  # Material size/dimensions
    material_make = Column(String, nullable=True)  # Material manufacturer/make
    
    # Storage Location
    store_room = Column(String, nullable=True)
    rack_no = Column(String, nullable=True)
    shelf_no = Column(String, nullable=True)
    
    # Lot Management
    lot_number = Column(String, nullable=True) # Generated Identifier
    expiry_date = Column(DateTime, nullable=True)

    inward_process = relationship("InwardProcess", back_populates="items")
    material = relationship("Material")
    material_variant = relationship("MaterialVariant", back_populates="inward_items")

class InventoryLog(Base):
    __tablename__ = "inventory_logs"

    id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, ForeignKey("materials.id"))
    change_quantity = Column(Integer) # +ve for Inward, -ve for Issue
    balance_after = Column(Integer)
    transaction_type = Column(String) # "INWARD", "ISSUE", "ADJUSTMENT"
    reference_id = Column(String) # Gate Pass No or Issue ID
    created_at = Column(DateTime, default=get_ist_now)
    created_by_id = Column(Integer, ForeignKey("users.id"))
    
class MaterialIssue(Base):
    __tablename__ = "material_issues"

    id = Column(Integer, primary_key=True, index=True)
    
    # Legacy fields (kept for backward compatibility)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=True)
    quantity_requested = Column(Integer, nullable=True)
    
    purpose = Column(String)
    requesting_dept = Column(String)
    created_at = Column(DateTime, default=get_ist_now)
    
    # Workflow
    status = Column(String, default="PENDING_OFFICER_APPROVAL")
    officer_id = Column(Integer, ForeignKey("users.id"))  # Officer who will approve this issue
    requested_by_id = Column(Integer, ForeignKey("users.id"))
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)  # Timestamp of approval
    
    # Issue Note
    issue_note_id = Column(String, unique=True, nullable=True) # Generated upon approval
    
    # Relationships
    material = relationship("Material")
    items = relationship("MaterialIssueItem", back_populates="material_issue")
    officer = relationship("User", foreign_keys=[officer_id])
    
    @property
    def material_name(self):
        return self.material.name if self.material else None
        
    @property
    def material_category(self):
        return self.material.category if self.material else None
        
    @property
    def material_unit(self):
        return self.material.unit if self.material else None


class MaterialIssueItem(Base):
    """
    Detailed items for material issues - mirrors InwardItem structure
    Enables tracking of specific variants and multiple items per issue
    """
    __tablename__ = "material_issue_items"
    
    id = Column(Integer, primary_key=True, index=True)
    material_issue_id = Column(Integer, ForeignKey("material_issues.id"))
    
    # Material Reference
    material_id = Column(Integer, ForeignKey("materials.id"))
    material_variant_id = Column(Integer, ForeignKey("material_variants.id"), nullable=True)
    quantity_issued = Column(Integer)
    
    # Material details (for reference/audit)
    material_description = Column(String, nullable=True)
    material_category = Column(String, nullable=True)
    material_unit = Column(String, nullable=True)
    
    # Variant Specifications
    rating = Column(String, nullable=True)
    size = Column(String, nullable=True)
    material_make = Column(String, nullable=True)
    
    # Storage Location (where picked from)
    store_room = Column(String, nullable=True)
    rack_no = Column(String, nullable=True)
    shelf_no = Column(String, nullable=True)
    
    # Lot tracking
    lot_number = Column(String, nullable=True)
    
    # Relationships
    material_issue = relationship("MaterialIssue", back_populates="items")
    material = relationship("Material")
    material_variant = relationship("MaterialVariant")


class ReturnableStatus(str, enum.Enum):
    PENDING_OFFICER_OUTWARD = "PENDING_OFFICER_OUTWARD"
    REJECTED_OFFICER_OUTWARD = "REJECTED_OFFICER_OUTWARD"
    PENDING_SECURITY_OUTWARD = "PENDING_SECURITY_OUTWARD"
    OUTWARD_COMPLETED = "OUTWARD_COMPLETED"  # Out gate pass generated
    PENDING_SECURITY_INWARD = "PENDING_SECURITY_INWARD" # When vendor returns
    PENDING_OFFICER_INWARD = "PENDING_OFFICER_INWARD"
    PENDING_STORE_MANAGER_FINAL = "PENDING_STORE_MANAGER_FINAL"
    COMPLETED = "COMPLETED"


class ReturnableEntry(Base):
    __tablename__ = "returnable_entries"

    id = Column(Integer, primary_key=True, index=True)
    outward_gate_pass_id = Column(String, unique=True, index=True) # Generated (e.g., RET-OUT-001)
    inward_gate_pass_id = Column(String, unique=True, index=True, nullable=True) # Generated (e.g., RET-IN-001)
    
    material_description = Column(String, nullable=False)
    vendor_name = Column(String, nullable=False)
    reason_for_outward = Column(String, nullable=True) # e.g., Maintenance/Repair
    
    # Timeline
    created_at = Column(DateTime, default=get_ist_now)
    outward_approved_officer_at = Column(DateTime, nullable=True)
    outward_approved_security_at = Column(DateTime, nullable=True)
    inward_received_security_at = Column(DateTime, nullable=True)
    inward_approved_officer_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Roles involved
    initiated_by_id = Column(Integer, ForeignKey("users.id")) # Store Manager
    officer_id = Column(Integer, ForeignKey("users.id")) # Concerned Officer
    
    # Status
    status = Column(String, default=ReturnableStatus.PENDING_OFFICER_OUTWARD)
    
    # Remarks/History (Simplified for now)
    remarks = Column(Text, nullable=True)

    # Relationships
    initiator = relationship("User", foreign_keys=[initiated_by_id])
    officer = relationship("User", foreign_keys=[officer_id])

    @property
    def officer_name(self):
        return self.officer.username if self.officer else None

