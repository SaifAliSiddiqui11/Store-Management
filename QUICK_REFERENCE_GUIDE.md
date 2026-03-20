# Store Management System - Quick Reference Guide

## 🎯 System Purpose
**Digital warehouse management system** that tracks materials from gate entry through storage to distribution, replacing manual paper-based processes.

---

## 👥 User Roles & Responsibilities

| Role | Primary Function | Access Level |
|------|-----------------|--------------|
| **Security Guard** 🛡️ | Create gate entries for incoming deliveries | Gate entry forms only |
| **Officer** 👨‍💼 | Approve deliveries and material issues | Approval dashboards, inventory view |
| **Store Manager** 📦 | Verify deliveries, manage inventory, request issues | Store operations, full inventory |
| **Admin** ⚙️ | Manage users and system settings | Full system access |

---

## 🔄 Main Workflows

### Inward Material Flow (4 Steps)

```
1. SECURITY GUARD          2. OFFICER              3. STORE MANAGER         4. OFFICER
   Creates Gate Entry  →   Initial Approval   →   Physical Verification   →  Final Approval
   (Gate Pass Generated)   (Authorize Entry)      (Add Details)              (Update Stock)
```

### Material Issue Flow (2 Steps)

```
1. STORE MANAGER                    2. OFFICER
   Creates Issue Request    →      Approves Request
   (Select Material + Dept)        (Stock Deducted)
```

---

## 📋 Gate Entry Process

### What Security Guard Enters:
- ✅ Vendor name and location
- ✅ Vehicle number
- ✅ Driver name and phone
- ✅ Material type description
- ✅ Approximate quantity
- ✅ Select officer for approval

### What System Does:
- Generates unique Gate Pass Number (GP-XXXXXXXX)
- Sends to officer for approval
- Tracks status automatically

---

## ✅ Officer Approval Process

### Stage 1 (Initial Approval)
**When:** After security creates gate entry  
**Action:** Approve or Reject delivery  
**Result:** Approved entries go to store manager

### Stage 2 (Final Approval)
**When:** After store manager verifies delivery  
**Action:** Review details, edit if needed, then approve  
**Result:** Materials added to inventory, stock updated automatically

---

## 📦 Store Manager Verification

### Information to Enter:
1. **Invoice Details:**
   - Invoice number
   - Invoice date

2. **Material Details** (can add multiple items):
   - Material description
   - Category (Consumable, Spare, Chemical, etc.)
   - Quantity received
   - Unit of measurement (Nos, Kg, Ltr)
   - Minimum stock level

3. **Storage Location:**
   - Store room
   - Rack number
   - Shelf number

4. **Remarks:** Any special notes

---

## 🏭 Material Issue Request

### How to Request:
1. Login as Store Manager
2. Go to "Request Material Issue"
3. Select material from dropdown
4. Enter:
   - Quantity needed
   - Purpose
   - Requesting department
   - Officer to approve
5. Submit

### What Happens Next:
- Officer receives approval request
- Officer approves → Stock automatically deducted
- System generates Issue Note/Receipt
- Available for download/print

---

## 📊 Material Categories

| Category | Examples |
|----------|----------|
| **CONSUMABLE** | Office supplies, cleaning materials |
| **SPARE** | Replacement parts, components |
| **ASSET** | Equipment, machinery |
| **FIRE_AND_SAFETY** | Fire extinguishers, safety gear |
| **AUTOMATION** | Sensors, controllers, PLCs |
| **ELECTRICAL** | Cables, switches, panels |
| **MECHANICAL** | Tools, bearings, fasteners |
| **CHEMICALS** | Industrial chemicals, solvents |
| **OILS_AND_LUBRICANTS** | Motor oils, greases |
| **STATIONARY** | Paper, pens, office items |

---

## 🔐 Login Credentials (Default)

### Test Users:
- **Security:** Username: `security1` | Password: `password123`
- **Officer:** Username: `officer1` | Password: `password123`
- **Store Manager:** Username: `store1` | Password: `password123`
- **Admin:** Username: `admin` | Password: `admin123`

> ⚠️ **Important:** Change these default passwords in production!

---

## 📱 System Access

### Web Address:
- **Production:** [Your deployed URL]
- **Local Testing:** http://localhost:5173

### Supported Devices:
- ✅ Desktop computers
- ✅ Tablets
- ✅ Smartphones
- ✅ Any modern web browser (Chrome, Safari, Firefox, Edge)

---

## 📈 Key Metrics Tracked

### Inventory Metrics:
- Current stock levels
- Material categories
- Storage locations
- Minimum stock thresholds

### Transaction Metrics:
- Total gate entries (daily/monthly)
- Approval times
- Material issues processed
- Pending approvals

### Audit Trail:
- Who created each entry
- Who approved/rejected
- Timestamps of all actions
- Complete history

---

## 🚨 Common Status Codes

| Status | Meaning | What's Next |
|--------|---------|-------------|
| `PENDING_OFFICER_APPROVAL_1` | Waiting for officer initial approval | Officer to approve/reject |
| `APPROVED_STAGE_1` | Officer approved, ready for store | Store manager to verify |
| `PENDING_OFFICER_FINAL_APPROVAL` | Store verified, awaiting final approval | Officer to final approve |
| `FINAL_APPROVED` | Complete, stock updated | Process finished ✅ |
| `REJECTED` | Entry rejected | Process stopped ❌ |

---

## 💡 Best Practices

### For Security Guards:
- ✅ Always verify driver ID before creating entry
- ✅ Select the correct officer for the material type
- ✅ Enter complete vehicle and driver details
- ✅ Take note of Gate Pass Number for reference

### For Officers:
- ✅ Review all details before approving
- ✅ Check if delivery was expected
- ✅ Verify material quantities during final approval
- ✅ Review stock levels before approving issues

### For Store Managers:
- ✅ Verify invoice against actual delivery
- ✅ Count materials carefully
- ✅ Enter accurate storage locations
- ✅ Update material master data as needed
- ✅ Set realistic minimum stock levels

### For Everyone:
- ✅ Log out after each session
- ✅ Use strong passwords
- ✅ Report any discrepancies immediately
- ✅ Keep system data accurate and current

---

## 🔍 Inventory View Features

### What You Can See:
- Material name and code
- Category and description
- Current quantity in stock
- Unit of measurement
- Storage location (room/rack/shelf)
- Inward date
- Requesting officer (for store managers)

### Filtering Options:
- Search by material name
- Filter by category
- Sort by date, quantity, or name
- Export to Excel (if implemented)

---

## 📞 Troubleshooting

### Can't Login?
1. Check username spelling (case-sensitive)
2. Verify password
3. Contact admin to reset password

### Entry Not Showing?
1. Check you're looking at correct status tab
2. Refresh the page (F5)
3. Verify entry was submitted successfully

### Stock Not Updated?
1. Ensure officer gave **final approval**
2. Check status is "FINAL_APPROVED"
3. Refresh inventory page

### Can't Approve Material Issue?
1. Check if sufficient stock available
2. Verify you're the assigned officer
3. Ensure status is "PENDING"

---

## 📋 Data Entry Tips

### Vendor Names:
- Use consistent spelling (e.g., always "ABC Corp" not "ABC Corporation")
- Include location for clarity

### Material Descriptions:
- Be specific: "Motor Oil 20W-50" not just "Oil"
- Include brand if relevant
- Add specifications where needed

### Storage Locations:
- Use standard naming (SR-1, SR-2 for store rooms)
- Keep rack/shelf numbers consistent
- Add new locations systematically

---

## 🎯 Key Benefits Summary

| Benefit | Impact |
|---------|--------|
| **Time Savings** | 70%+ faster processing |
| **Accuracy** | Eliminates manual errors |
| **Visibility** | Real-time inventory status |
| **Accountability** | Complete audit trails |
| **Accessibility** | Access from anywhere |
| **Scalability** | Grows with business |

---

## 📝 Document Reference

For detailed information, see:
- **Business Documentation:** `BUSINESS_DOCUMENTATION.md`
- **Technical Specs:** Contact IT team
- **Training Materials:** [To be created]

---

*Last Updated: January 2026*  
*For support or questions, contact your system administrator*
