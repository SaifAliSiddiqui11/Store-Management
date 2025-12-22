from sqlalchemy.orm import Session
from models import GateEntry

def create_gate_entry(db: Session, data):
    entry = GateEntry(
        vendor_name=data.vendor_name,
        invoice_no=data.invoice_no,
        vehicle_no=data.vehicle_no,
        material_desc=data.material_desc,
        quantity=data.quantity,
        created_by=data.created_by,
        status="PENDING_OFFICER_APPROVAL"
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
