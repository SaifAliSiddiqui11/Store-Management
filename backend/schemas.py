from pydantic import BaseModel

class GateEntryCreate(BaseModel):
    vendor_name: str
    invoice_no: str
    vehicle_no: str
    material_desc: str
    quantity: int
    created_by: int
