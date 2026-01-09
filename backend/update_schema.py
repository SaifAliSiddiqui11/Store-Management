from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

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
