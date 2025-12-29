from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Enum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from backend.database import Base

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
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
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
    quantity_received = Column(Integer)
    
    # Material details (direct text entry)
    material_description = Column(String, nullable=True)
    material_category = Column(String, nullable=True)
    material_unit = Column(String, nullable=True)
    min_stock_level = Column(Integer, nullable=True)
    
    # Storage Location
    store_room = Column(String, nullable=True)
    rack_no = Column(String, nullable=True)
    shelf_no = Column(String, nullable=True)
    
    # Lot Management
    lot_number = Column(String, nullable=True) # Generated Identifier
    expiry_date = Column(DateTime, nullable=True)

    inward_process = relationship("InwardProcess", back_populates="items")
    material = relationship("Material")

class InventoryLog(Base):
    __tablename__ = "inventory_logs"

    id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, ForeignKey("materials.id"))
    change_quantity = Column(Integer) # +ve for Inward, -ve for Issue
    balance_after = Column(Integer)
    transaction_type = Column(String) # "INWARD", "ISSUE", "ADJUSTMENT"
    reference_id = Column(String) # Gate Pass No or Issue ID
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by_id = Column(Integer, ForeignKey("users.id"))
    
class MaterialIssue(Base):
    __tablename__ = "material_issues"

    id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, ForeignKey("materials.id"))
    quantity_requested = Column(Integer)
    purpose = Column(String)
    requesting_dept = Column(String)
    
    # Workflow
    status = Column(String, default="PENDING_OFFICER_APPROVAL")
    officer_id = Column(Integer, ForeignKey("users.id"))  # Officer who will approve this issue
    requested_by_id = Column(Integer, ForeignKey("users.id"))
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)  # Timestamp of approval
    
    # Issue Note
    issue_note_id = Column(String, unique=True, nullable=True) # Generated upon approval
    
    material = relationship("Material")
