from sqlalchemy import Column, Integer, String
from backend.database import Base

class GateEntry(Base):
    __tablename__ = "gate_entries"

    id = Column(Integer, primary_key=True)
    vendor_name = Column(String)
    invoice_no = Column(String)
    material_desc = Column(String)
    quantity = Column(Integer)

    status = Column(String, default="PENDING_OFFICER_APPROVAL")

    store_room = Column(String, nullable=True)
    rack_no = Column(String, nullable=True)
    shelf_no = Column(String, nullable=True)
