from fastapi import FastAPI
from sqlalchemy.orm import Session
from backend.database import engine, SessionLocal
from backend.models import Base, GateEntry

app = FastAPI(title="Store Management System")

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        return db
    finally:
        db.close()

@app.get("/")
def root():
    return {"message": "Server running"}

@app.post("/gate-entry/")
def create_gate_entry(
    vendor_name: str,
    invoice_no: str,
    material_desc: str,
    quantity: int
):
    db: Session = SessionLocal()

    entry = GateEntry(
        vendor_name=vendor_name,
        invoice_no=invoice_no,
        material_desc=material_desc,
        quantity=quantity,
        status="PENDING_OFFICER_APPROVAL"
    )

    db.add(entry)
    db.commit()
    db.refresh(entry)
    db.close()

    return {
        "message": "Gate entry created, pending officer approval",
        "entry_id": entry.id,
        "status": entry.status
    }

@app.post("/gate-entry/{entry_id}/approve")
def approve_gate_entry(entry_id: int, officer_name: str):
    db: Session = SessionLocal()

    entry = db.query(GateEntry).filter(GateEntry.id == entry_id).first()

    if not entry:
        db.close()
        return {"error": "Gate entry not found"}

    if entry.status != "PENDING_OFFICER_APPROVAL":
        db.close()
        return {
            "error": "Entry cannot be approved in current state",
            "current_status": entry.status
        }

    entry.status = "APPROVED_BY_OFFICER"

    db.commit()
    db.refresh(entry)
    db.close()

    return {
        "message": "Gate entry approved by officer",
        "entry_id": entry.id,
        "status": entry.status,
        "approved_by": officer_name
    }

@app.post("/gate-entry/{entry_id}/reject")
def reject_gate_entry(entry_id: int, officer_name: str, reason: str):
    db: Session = SessionLocal()

    entry = db.query(GateEntry).filter(GateEntry.id == entry_id).first()

    if not entry:
        db.close()
        return {"error": "Gate entry not found"}

    if entry.status != "PENDING_OFFICER_APPROVAL":
        db.close()
        return {
            "error": "Entry cannot be rejected in current state",
            "current_status": entry.status
        }

    entry.status = "REJECTED_BY_OFFICER"

    db.commit()
    db.refresh(entry)
    db.close()

    return {
        "message": "Gate entry rejected by officer",
        "entry_id": entry.id,
        "status": entry.status,
        "rejected_by": officer_name,
        "reason": reason
    }

@app.get("/gate-entry/pending")
def get_pending_gate_entries():
    db: Session = SessionLocal()

    entries = db.query(GateEntry).filter(
        GateEntry.status == "PENDING_OFFICER_APPROVAL"
    ).all()

    db.close()

    return entries


@app.get("/store/pending")
def get_store_pending_entries():
    db: Session = SessionLocal()

    entries = db.query(GateEntry).filter(
        GateEntry.status == "APPROVED_BY_OFFICER"
    ).all()

    db.close()
    return entries




@app.post("/store/{entry_id}/update-location")
def update_store_location(
    entry_id: int,
    store_room: str,
    rack_no: str,
    shelf_no: str
):
    db: Session = SessionLocal()

    entry = db.query(GateEntry).filter(GateEntry.id == entry_id).first()

    if not entry:
        db.close()
        return {"error": "Entry not found"}

    if entry.status != "APPROVED_BY_OFFICER":
        db.close()
        return {
            "error": "Entry not ready for store update",
            "current_status": entry.status
        }

    entry.store_room = store_room
    entry.rack_no = rack_no
    entry.shelf_no = shelf_no
    entry.status = "PENDING_OFFICER_FINAL_APPROVAL"

    db.commit()
    db.refresh(entry)
    db.close()

    return {
        "message": "Store details updated",
        "entry_id": entry.id,
        "status": entry.status
    }


@app.get("/officer/final-pending")
def officer_final_pending():
    db: Session = SessionLocal()

    entries = db.query(GateEntry).filter(
        GateEntry.status == "PENDING_OFFICER_FINAL_APPROVAL"
    ).all()

    db.close()
    return entries




@app.post("/officer/{entry_id}/final-approve")
def officer_final_approve(entry_id: int, officer_name: str):
    db: Session = SessionLocal()

    entry = db.query(GateEntry).filter(GateEntry.id == entry_id).first()

    if not entry:
        db.close()
        return {"error": "Entry not found"}

    if entry.status != "PENDING_OFFICER_FINAL_APPROVAL":
        db.close()
        return {
            "error": "Entry not eligible for final approval",
            "current_status": entry.status
        }

    entry.status = "FINAL_APPROVED"

    db.commit()
    db.refresh(entry)
    db.close()

    return {
        "message": "Final approval completed",
        "entry_id": entry.id,
        "status": entry.status,
        "approved_by": officer_name
    }

