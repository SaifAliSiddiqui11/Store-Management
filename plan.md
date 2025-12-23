# 

STORE MANAGEMENT AUTOMATION SYSTEM

---

## Software Requirement Specification (SRS)

**Project Name:**

Digital Store, Gate Pass & Inventory Management System

**Location:**

BPCL – Manmad Installation (Store & Security Gate)

**Objective:**

To digitize and automate all manual store operations including **material inward, approvals, storage, issue, inventory tracking, and audit trail**, while maintaining strict PSU-grade control and approvals.

---

## 1️⃣ CURRENT PROBLEM STATEMENT

- All store and gate activities are done manually using registers.
- No real-time visibility of inventory.
- Approval process is manual and non-trackable.
- High risk of data mismatch, audit issues, and human error.
- No automated low-stock alerts.
- Partial issue of materials is difficult to track accurately.

---

## 2️⃣ PROPOSED SOLUTION OVERVIEW

A **web-based + mobile-friendly application** with **role-based access** and **multi-level approval workflow** for:

- Material IN (Gate → Officer → Store → Officer → Inventory)
- Material OUT (Store → Officer → Store → Record Update)
- Inventory & stock management

---

## 3️⃣ USER ROLES & PERMISSIONS

### 3.1 Security Guard

- Create material inward request
- Cannot approve or edit after submission
- Can view status of submitted entries

### 3.2 Officer (Approving Authority)

- Approve / reject material inward (two stages)
- Approve / reject material issue
- View inventory & reports (read-only)

### 3.3 Store Manager

- Verify material physically
- Enter storage details
- Initiate material issue requests
- Print approval notes
- View & manage inventory

### 3.4 Admin

- User management
- Master data (materials, vendors)
- Reports
- Audit logs

---

## 4️⃣ MATERIAL IN (INWARD) WORKFLOW – DETAILED

### STEP 1: Gate Entry (Security Guard)

Security Guard enters:

- Vendor Name
- Location from which he has arrived
- Concerned Officer

**Action:**

👉 Click “Send for Approval”

**System Action:**

- Generate unique Gate Entry ID
- Status: `Pending Officer Approval – Stage 1`

---

### STEP 2: Officer Approval – Stage 1 (Mobile/Web)

Officer receives notification and can:

- Approve
- Reject (with reason)
- Send back for correction

**On Approval:**

- Entry moves to Store Manager dashboard
- Status: `Approved by Officer – Awaiting Store Entry`

---

### STEP 3: Store Manager Verification & Enrichment

Store Manager:

- Physically verifies material
- Confirms actual quantity received
- Adds:
- Vendor Name
- Invoice Number
- Invoice Date
- Material Description
- Quantity (as per invoice)
- Unit (Nos / Kg / Ltr)
- Store Room
- Rack Number
- Shelf / Bin
- Material Category (Consumable / Spare / Asset)
- Minimum Stock Level (Reorder point)

**Action:**

👉 Send back to Officer for final approval

**Status:**

`Pending Officer Approval – Final`

---

### STEP 4: Officer Approval – Stage 2 (Final)

Officer reviews final details and:

- Approves
- Rejects (with reason)

**On Final Approval:**

- Material entry is committed to database
- Inventory stock is updated
- Lot ID is generated

**Important Rule:**

❗ **No inventory entry is created before final approval**

---

## 5️⃣ INVENTORY & LOT MANAGEMENT LOGIC

### 5.1 Lot-Based Inventory

Each material inward creates:

- Material Code
- Total Quantity
- Location details

### 5.2 Partial Issue Handling

If:

- Lot Quantity = 100
- Issue = 8

System updates:

- Available Quantity = 92
- Lot remains open until quantity becomes 0
- All issues linked to the same Lot ID

---

## 6️⃣ MATERIAL OUT (ISSUE) WORKFLOW

### STEP 1: Issue Request by Store Manager

Store Manager enters:

- Material Name
- Quantity Required
- Purpose
- Requesting Person / Department

**Action:**

👉 Send for Officer Approval

**Status:**

`Pending Issue Approval`

---

### STEP 2: Officer Approval

Officer reviews:

- Available stock
- Requested quantity
- Purpose

Officer can:

- Approve
- Reject
- Modify quantity (with reason)

---

### STEP 3: Approval Note Generation

On approval:

- System generates **Issue Approval Note (PDF)**
- Contains:
    - Issue ID
    - Material details
    - Quantity
    - Purpose
    - Approved by
    - Date & Time
    - Reference number / QR code

Store Manager:

- Prints approval
- Hands over material

---

### STEP 4: Stock Update

System deducts issued quantity from inventory and updates:

- Lot quantity
- Total available stock
- Issue history

---

## 7️⃣ LOW STOCK & ALERT SYSTEM

- Each material has a minimum stock threshold
- When stock ≤ threshold:
    - Dashboard alert
    - Email notification to Store Manager & Officer

---

## 8️⃣ REPORTS REQUIRED

- Current inventory report
- Material inward report (date/vendor-wise)
- Material issue report (department/officer-wise)
- Low stock report
- Audit trail report
- Monthly & yearly consumption report

---

---

## 🔟 NON-FUNCTIONAL REQUIREMENTS

- Mobile responsive UI (Officer approvals)
- Simple & fast UI (Security & Store)
- Backup & restore facility
- Printable PDF outputs
- Scalable architecture (future SAP integration possible)

---

## 1️⃣1️⃣ TECHNOLOGY PREFERENCE (Flexible)

- Backend: Node.js / Python (FastAPI / Flask)
- Database: PostgreSQL / MySQL
- Frontend: React / HTML + Bootstrap
- Hosting: On-prem / Cloud (as approved)
- Notifications: Email (mandatory), WhatsApp (optiona)