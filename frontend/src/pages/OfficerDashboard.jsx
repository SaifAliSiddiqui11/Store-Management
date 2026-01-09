import { useState, useEffect } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import api from '../api/axios'
import { CheckCircle, XCircle } from 'lucide-react'
import StoreInventoryTable from '../components/StoreInventoryTable'

const OfficerDashboard = () => {
    const [activeTab, setActiveTab] = useState('stage1') // stage1, final, issues, inventory, materials
    const [items, setItems] = useState([])
    const [storeItems, setStoreItems] = useState([]) // For personal inventory view
    const [materials, setMaterials] = useState([]) // For material management
    const [loading, setLoading] = useState(true)

    // Material creation form state
    const [materialForm, setMaterialForm] = useState({
        code: '',
        name: '',
        description: '',
        category: 'CONSUMABLE',
        unit: 'Nos',
        min_stock_level: 10
    })

    // Catalog Filters
    const [materialSearch, setMaterialSearch] = useState('')
    const [materialCategoryFilter, setMaterialCategoryFilter] = useState('')

    const filteredMaterials = materials.filter(m => {
        const matchesSearch = m.name.toLowerCase().includes(materialSearch.toLowerCase()) ||
            m.code.toLowerCase().includes(materialSearch.toLowerCase())
        const matchesCategory = materialCategoryFilter ? m.category === materialCategoryFilter : true
        return matchesSearch && matchesCategory
    })

    const fetchItems = async () => {
        setLoading(true)
        try {
            let endpoint = '/officer/pending-stage-1'
            if (activeTab === 'final') endpoint = '/officer/final-pending'
            if (activeTab === 'issues') endpoint = '/officer/pending-issues'
            if (activeTab === 'approved_issues') endpoint = '/officer/approved-issues'

            if (activeTab === 'inventory') {
                const res = await api.get('/store/items')
                setStoreItems(res.data)
                setLoading(false)
                return
            }

            if (activeTab === 'materials') {
                const res = await api.get('/materials')
                setMaterials(res.data)
                setLoading(false)
                return
            }

            const res = await api.get(endpoint)
            setItems(res.data)
        } catch (error) {
            console.error("Failed to fetch", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchItems()
    }, [activeTab])

    const handleAction = async (id, action, type = 'stage1') => {
        if (!confirm(`Are you sure you want to ${action}?`)) return

        try {
            let endpoint = ''
            let body = {}

            if (type === 'stage1') {
                endpoint = `/gate-entry/${id}/approve-stage-1`
                body = { action, remarks: 'Processed by Officer' }
            } else if (type === 'final') {
                if (action === 'REJECTED') {
                    endpoint = `/officer/${id}/final-reject`
                    body = { action, remarks: remarks || 'Rejected by Officer' }
                } else {
                    endpoint = `/officer/${id}/final-approve`
                }
            } else if (type === 'issue' || type === 'issues') {
                endpoint = `/officer/issue/${id}/approve`
            }

            await api.post(endpoint, body)
            alert("Action completed successfully!")
            fetchItems()
        } catch (error) {
            console.error("Action failed:", error)
            const errorMsg = error.response?.data?.detail || error.message || "Unknown error"
            alert(`Action failed: ${errorMsg}`)
        }
    }

    // Edit functionality for Stage 2
    const [editingId, setEditingId] = useState(null)
    const [editForm, setEditForm] = useState({})

    const handleEditClick = (item) => {
        if (!item.inward_process) return
        const inward = item.inward_process
        // Assuming single item for now as per current logic
        const inwardItem = inward.items && inward.items.length > 0 ? inward.items[0] : {}

        setEditingId(item.id)
        setEditForm({
            invoice_no: inward.invoice_no,
            invoice_date: inward.invoice_date ? inward.invoice_date.split('T')[0] : '',
            remarks: inward.remarks,
            // Item details
            item_id: inwardItem.id,
            quantity_received: inwardItem.quantity_received,
            store_room: inwardItem.store_room,
            rack_no: inwardItem.rack_no,
            shelf_no: inwardItem.shelf_no,
            material_category: inwardItem.material_category,
            material_unit: inwardItem.material_unit
        })
    }

    const handleEditSave = async (id) => {
        try {
            const payload = {
                invoice_no: editForm.invoice_no,
                invoice_date: new Date(editForm.invoice_date).toISOString(),
                remarks: editForm.remarks,
                items: [
                    {
                        id: editForm.item_id,
                        quantity_received: parseInt(editForm.quantity_received),
                        store_room: editForm.store_room,
                        rack_no: editForm.rack_no,
                        shelf_no: editForm.shelf_no,
                        material_category: editForm.material_category,
                        material_unit: editForm.material_unit
                    }
                ]
            }

            await api.put(`/officer/${id}/verification-details`, payload)
            alert("Updated successfully")
            setEditingId(null)
            fetchItems()
        } catch (e) {
            console.error(e)
            alert("Update failed")
        }
    }

    const handleCreateMaterial = async (e) => {
        e.preventDefault()
        try {
            await api.post('/materials', materialForm)
            alert('Material created successfully!')
            setMaterialForm({
                code: '',
                name: '',
                description: '',
                category: 'CONSUMABLE',
                unit: 'Nos',
                min_stock_level: 10
            })
            fetchItems() // Refresh materials list
        } catch (error) {
            console.error('Failed to create material:', error)
            const errorMsg = error.response?.data?.detail || 'Failed to create material'
            alert(errorMsg)
        }
    }

    const TabButton = ({ id, label }) => (
        <button
            onClick={() => setActiveTab(id)}
            style={{
                background: activeTab === id ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600
            }}
        >
            {label}
        </button>
    )

    return (
        <DashboardLayout title="Role: Officer">
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                <TabButton id="stage1" label="Gate Approvals (Stage 1)" />
                <TabButton id="final" label="Results & Final (Stage 2)" />
                <TabButton id="issues" label="Material Issues" />
                <TabButton id="approved_issues" label="Approved Issues" />
                <TabButton id="materials" label="Material Management" />
                <TabButton id="inventory" label="My Store Inventory" />
            </div>

            <div className="glass-panel table-container">

                {activeTab === 'materials' ? (
                    <>
                        <div style={{ marginBottom: '2rem', padding: '1.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                            <h3 style={{ marginBottom: '1.5rem' }}>Create New Material</h3>
                            <form onSubmit={handleCreateMaterial}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Material Code *</label>
                                        <input
                                            className="glass-input"
                                            required
                                            placeholder="e.g., MAT-001"
                                            value={materialForm.code}
                                            onChange={e => setMaterialForm({ ...materialForm, code: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Material Name *</label>
                                        <input
                                            className="glass-input"
                                            required
                                            placeholder="e.g., Steel Bolts"
                                            value={materialForm.name}
                                            onChange={e => setMaterialForm({ ...materialForm, name: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Description</label>
                                    <input
                                        className="glass-input"
                                        placeholder="Optional description"
                                        value={materialForm.description}
                                        onChange={e => setMaterialForm({ ...materialForm, description: e.target.value })}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Category *</label>
                                        <select
                                            className="glass-input"
                                            value={materialForm.category}
                                            onChange={e => setMaterialForm({ ...materialForm, category: e.target.value })}
                                        >
                                            <option value="CONSUMABLE">Consumable</option>
                                            <option value="SPARE">Spare</option>
                                            <option value="ASSET">Asset</option>
                                            <option value="FIRE_AND_SAFETY">Fire and Safety</option>
                                            <option value="AUTOMATION">Automation</option>
                                            <option value="ELECTRICAL">Electrical</option>
                                            <option value="MECHANICAL">Mechanical</option>
                                            <option value="CHEMICALS">Chemicals</option>
                                            <option value="OILS_AND_LUBRICANTS">Oils and Lubricants</option>
                                            <option value="STATIONARY">Stationary</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Unit *</label>
                                        <select
                                            className="glass-input"
                                            value={materialForm.unit}
                                            onChange={e => setMaterialForm({ ...materialForm, unit: e.target.value })}
                                        >
                                            <option value="Nos">Nos</option>
                                            <option value="Kg">Kg</option>
                                            <option value="Ltr">Ltr</option>
                                            <option value="Mtr">Mtr</option>
                                            <option value="Box">Box</option>
                                            <option value="Set">Set</option>
                                            <option value="Roll">Roll</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Min Stock Level *</label>
                                        <input
                                            className="glass-input"
                                            type="number"
                                            required
                                            min="1"
                                            placeholder="e.g., 50"
                                            value={materialForm.min_stock_level}
                                            onChange={e => setMaterialForm({ ...materialForm, min_stock_level: parseInt(e.target.value) || '' })}
                                        />
                                    </div>
                                </div>

                                <button className="btn btn-primary" type="submit">
                                    Create Material
                                </button>
                            </form>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0 }}>Material Master List</h3>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <select
                                    className="glass-input"
                                    style={{ width: '200px' }}
                                    value={materialCategoryFilter}
                                    onChange={e => setMaterialCategoryFilter(e.target.value)}
                                >
                                    <option value="">All Categories</option>
                                    <option value="CONSUMABLE">Consumable</option>
                                    <option value="SPARE">Spare</option>
                                    <option value="ASSET">Asset</option>
                                    <option value="FIRE_AND_SAFETY">Fire and Safety</option>
                                    <option value="AUTOMATION">Automation</option>
                                    <option value="ELECTRICAL">Electrical</option>
                                    <option value="MECHANICAL">Mechanical</option>
                                    <option value="CHEMICALS">Chemicals</option>
                                    <option value="OILS_AND_LUBRICANTS">Oils and Lubricants</option>
                                    <option value="STATIONARY">Stationary</option>
                                </select>
                                <input
                                    className="glass-input"
                                    placeholder="Search Name or Code..."
                                    style={{ width: '250px' }}
                                    value={materialSearch}
                                    onChange={e => setMaterialSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        {loading ? (
                            <p>Loading...</p>
                        ) : materials.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                No materials created yet. Create your first material above.
                            </div>
                        ) : filteredMaterials.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                No materials match your search.
                            </div>
                        ) : (
                            <table>
                                <thead>
                                    <tr>
                                        <th>Code</th>
                                        <th>Name</th>
                                        <th>Category</th>
                                        <th>Unit</th>
                                        <th>Min Stock</th>
                                        <th>Current Stock</th>
                                        <th>Stock Deviation</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMaterials.map(m => {
                                        const deviation = m.min_stock_level > 0
                                            ? ((m.current_stock - m.min_stock_level) / m.min_stock_level) * 100
                                            : 0;
                                        const deviationColor = deviation >= 0 ? 'var(--success)' : 'var(--danger)';

                                        return (
                                            <tr key={m.id}>
                                                <td><span className="badge badge-blue">{m.code}</span></td>
                                                <td style={{ fontWeight: 600 }}>{m.name}</td>
                                                <td>{m.category}</td>
                                                <td>{m.unit}</td>
                                                <td>{m.min_stock_level}</td>
                                                <td style={{
                                                    fontWeight: 'bold',
                                                    color: m.current_stock < m.min_stock_level ? 'var(--danger)' : 'var(--success)'
                                                }}>
                                                    {m.current_stock}
                                                </td>
                                                <td style={{ fontWeight: 'bold', color: deviationColor }}>
                                                    {deviation > 0 ? '+' : ''}{deviation.toFixed(1)}%
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </>
                ) : activeTab === 'inventory' ? (
                    <StoreInventoryTable items={storeItems} userRole="OFFICER" />
                ) : activeTab === 'final' ? (
                    <>
                        {items.length === 0 && !loading && (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                No pending items in this category.
                            </div>
                        )}

                        {items.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {items.map(item => (
                                    <div key={item.id} className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.3)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                                            <div>
                                                <h3 style={{ margin: 0, marginBottom: '0.5rem' }}>
                                                    <span className="badge badge-blue">{item.gate_pass_number}</span>
                                                </h3>
                                                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
                                                    Created: {new Date(item.created_at).toLocaleString('en-IN')}
                                                </p>
                                            </div>
                                            <div style={{ display: 'flex', gap: '1rem' }}>
                                                <button
                                                    className="btn"
                                                    onClick={() => {
                                                        const remarks = prompt("Enter reason for rejection:");
                                                        if (remarks) handleAction(item.id, 'REJECTED', 'final', remarks);
                                                    }}
                                                    style={{ background: 'var(--danger)', color: 'white', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center' }}
                                                >
                                                    <XCircle size={18} style={{ marginRight: '0.5rem' }} />
                                                    Reject
                                                </button>
                                                <button
                                                    className="btn"
                                                    onClick={() => handleAction(item.id, 'APPROVED', 'final')}
                                                    style={{ background: 'var(--success)', color: 'white', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center' }}
                                                >
                                                    <CheckCircle size={18} style={{ marginRight: '0.5rem' }} />
                                                    Final Approve
                                                </button>
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                            <div>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vendor Name</label>
                                                <p style={{ margin: '0.25rem 0 0', fontWeight: 600 }}>{item.vendor_name}</p>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vendor Location</label>
                                                <p style={{ margin: '0.25rem 0 0', fontWeight: 600 }}>{item.vendor_location || '-'}</p>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Material Description</label>
                                                <p style={{ margin: '0.25rem 0 0', fontWeight: 600 }}>{item.material_type_desc || '-'}</p>
                                            </div>
                                        </div>

                                        {item.inward_process && (
                                            <>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                                    <h4 style={{ margin: 0 }}>Store Manager Verification Details</h4>
                                                    {editingId !== item.id && (
                                                        <button
                                                            onClick={() => handleEditClick(item)}
                                                            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}
                                                        >
                                                            Edit Details
                                                        </button>
                                                    )}
                                                </div>

                                                {editingId === item.id ? (
                                                    <div style={{ background: 'rgba(50,50,50,0.5)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--primary)' }}>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                                            <div>
                                                                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Invoice Number</label>
                                                                <input className="glass-input" value={editForm.invoice_no} onChange={e => setEditForm({ ...editForm, invoice_no: e.target.value })} />
                                                            </div>
                                                            <div>
                                                                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Invoice Date</label>
                                                                <input type="date" className="glass-input" value={editForm.invoice_date} onChange={e => setEditForm({ ...editForm, invoice_date: e.target.value })} />
                                                            </div>
                                                            <div>
                                                                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Remarks</label>
                                                                <input className="glass-input" value={editForm.remarks} onChange={e => setEditForm({ ...editForm, remarks: e.target.value })} />
                                                            </div>
                                                        </div>

                                                        <h5 style={{ color: 'var(--primary)', margin: '1rem 0 0.5rem 0' }}>Item Details</h5>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
                                                            <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                                <div>
                                                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Description</label>
                                                                    <input className="glass-input" value={editForm.material_description} onChange={e => setEditForm({ ...editForm, material_description: e.target.value })} />
                                                                </div>
                                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                                    <div>
                                                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Category</label>
                                                                        <select className="glass-input" value={editForm.material_category} onChange={e => setEditForm({ ...editForm, material_category: e.target.value })}>
                                                                            <option value="CONSUMABLE">Consumable</option>
                                                                            <option value="SPARE">Spare</option>
                                                                            <option value="ASSET">Asset</option>
                                                                            <option value="FIRE_AND_SAFETY">Fire and Safety</option>
                                                                            <option value="AUTOMATION">Automation</option>
                                                                            <option value="ELECTRICAL">Electrical</option>
                                                                            <option value="MECHANICAL">Mechanical</option>
                                                                            <option value="CHEMICALS">Chemicals</option>
                                                                            <option value="OILS_AND_LUBRICANTS">Oils and Lubricants</option>
                                                                            <option value="STATIONARY">Stationary</option>
                                                                        </select>
                                                                    </div>
                                                                    <div>
                                                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Unit</label>
                                                                        <select className="glass-input" value={editForm.material_unit} onChange={e => setEditForm({ ...editForm, material_unit: e.target.value })}>
                                                                            <option value="Nos">Nos</option>
                                                                            <option value="Kg">Kg</option>
                                                                            <option value="Ltr">Ltr</option>
                                                                            <option value="Mtr">Mtr</option>
                                                                            <option value="Box">Box</option>
                                                                            <option value="Set">Set</option>
                                                                            <option value="Roll">Roll</option>
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Quantity</label>
                                                                <input type="number" className="glass-input" value={editForm.quantity_received} onChange={e => setEditForm({ ...editForm, quantity_received: e.target.value })} />
                                                            </div>
                                                            <div>
                                                                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Store Room</label>
                                                                <input className="glass-input" value={editForm.store_room} onChange={e => setEditForm({ ...editForm, store_room: e.target.value })} />
                                                            </div>
                                                            <div>
                                                                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Rack No</label>
                                                                <input className="glass-input" value={editForm.rack_no} onChange={e => setEditForm({ ...editForm, rack_no: e.target.value })} />
                                                            </div>
                                                            <div>
                                                                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Shelf No</label>
                                                                <input className="glass-input" value={editForm.shelf_no} onChange={e => setEditForm({ ...editForm, shelf_no: e.target.value })} />
                                                            </div>
                                                        </div>

                                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                                                            <button onClick={() => setEditingId(null)} className="btn" style={{ background: 'transparent', border: '1px solid var(--text-muted)' }}>Cancel</button>
                                                            <button onClick={() => handleEditSave(item.id)} className="btn btn-primary">Save Changes</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                                            <div>
                                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Invoice Number</label>
                                                                <p style={{ margin: '0.25rem 0 0', fontWeight: 600, color: 'var(--primary)' }}>{item.inward_process.invoice_no}</p>
                                                            </div>
                                                            <div>
                                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Invoice Date</label>
                                                                <p style={{ margin: '0.25rem 0 0', fontWeight: 600 }}>{new Date(item.inward_process.invoice_date).toLocaleDateString('en-IN')}</p>
                                                            </div>
                                                            <div>
                                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Remarks</label>
                                                                <p style={{ margin: '0.25rem 0 0', fontWeight: 600 }}>{item.inward_process.remarks || '-'}</p>
                                                            </div>
                                                        </div>

                                                        {item.inward_process.items?.map((inwardItem, idx) => (
                                                            <div key={idx} style={{ padding: '1rem', background: 'rgba(100,200,255,0.05)', borderRadius: '8px', border: '1px solid rgba(100,200,255,0.2)', marginTop: '1rem' }}>
                                                                <h5 style={{ margin: '0 0 1rem 0', color: 'var(--primary)' }}>Material Item #{idx + 1}</h5>
                                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
                                                                    {inwardItem.material_code && (
                                                                        <div>
                                                                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Material Code</label>
                                                                            <p style={{ margin: '0.25rem 0 0', fontWeight: 600, color: 'var(--primary)' }}>{inwardItem.material_code}</p>
                                                                        </div>
                                                                    )}
                                                                    <div>
                                                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Description</label>
                                                                        <p style={{ margin: '0.25rem 0 0', fontWeight: 600 }}>{inwardItem.material_description || '-'}</p>
                                                                    </div>
                                                                    <div>
                                                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Category</label>
                                                                        <p style={{ margin: '0.25rem 0 0', fontWeight: 600 }}>{inwardItem.material_category || '-'}</p>
                                                                    </div>
                                                                    <div>
                                                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Unit</label>
                                                                        <p style={{ margin: '0.25rem 0 0', fontWeight: 600 }}>{inwardItem.material_unit || '-'}</p>
                                                                    </div>
                                                                    <div>
                                                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Quantity</label>
                                                                        <p style={{ margin: '0.25rem 0 0', fontWeight: 600, color: 'var(--success)', fontSize: '1.1rem' }}>{inwardItem.quantity_received}</p>
                                                                    </div>
                                                                    <div>
                                                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Store Room</label>
                                                                        <p style={{ margin: '0.25rem 0 0', fontWeight: 600 }}>{inwardItem.store_room || '-'}</p>
                                                                    </div>
                                                                    <div>
                                                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Rack No</label>
                                                                        <p style={{ margin: '0.25rem 0 0', fontWeight: 600 }}>{inwardItem.rack_no || '-'}</p>
                                                                    </div>
                                                                    <div>
                                                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Shelf No</label>
                                                                        <p style={{ margin: '0.25rem 0 0', fontWeight: 600 }}>{inwardItem.shelf_no || '-'}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        {items.length === 0 && !loading && (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                No pending items in this category.
                            </div>
                        )}

                        {items.length > 0 && (
                            <table>
                                {/* ... existing table ... */}
                                <thead>
                                    <tr>
                                        {activeTab === 'stage1' ? (
                                            <>
                                                <th>Vendor Name</th>
                                                <th>Vendor Location</th>
                                                <th>Material Description</th>
                                                <th>Date & Time</th>
                                            </>
                                        ) : activeTab === 'approved_issues' ? (
                                            <>
                                                <th>ID</th>
                                                <th>Category</th>
                                                <th>Date Approved</th>
                                                <th>Material</th>
                                                <th>Qty</th>
                                                <th>Issued To (Dept)</th>
                                                <th>Status</th>
                                            </>
                                        ) : activeTab !== 'issues' ? (
                                            <>
                                                <th>ID</th>
                                                <th>Vendor</th>
                                                <th>Material</th>
                                                <th>Qty</th>
                                                <th>Invoice</th>
                                            </>
                                        ) : (
                                            <>
                                                <th>ID</th>
                                                <th>Category</th>
                                                <th>Date</th>
                                                <th>Material</th>
                                                <th>Qty</th>
                                                <th>Issued To (Dept)</th>
                                            </>
                                        )}
                                        {activeTab !== 'approved_issues' && <th>Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map(item => (
                                        <tr key={item.id}>
                                            {activeTab === 'stage1' ? (
                                                <>
                                                    <td>{item.vendor_name}</td>
                                                    <td>{item.vendor_location || '-'}</td>
                                                    <td>{item.material_type_desc || '-'}</td>
                                                    <td>{new Date(item.created_at).toLocaleString('en-IN', {
                                                        day: '2-digit',
                                                        month: 'short',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        hour12: true
                                                    })}</td>
                                                </>
                                            ) : activeTab === 'approved_issues' ? (
                                                <>
                                                    <td>
                                                        <span className="badge badge-blue">
                                                            {`ISS-${item.id}`}
                                                        </span>
                                                    </td>
                                                    <td>{item.material_category || '-'}</td>
                                                    <td>{item.approved_at ? new Date(item.approved_at).toLocaleString('en-IN') : '-'}</td>
                                                    <td>{item.material_name || '-'}</td>
                                                    <td>{item.quantity_requested} {item.material_unit}</td>
                                                    <td>{item.requesting_dept}</td>
                                                    <td><span className="badge badge-green">{item.status}</span></td>
                                                </>
                                            ) : activeTab !== 'issues' ? (
                                                <>
                                                    <td>
                                                        <span className="badge badge-blue">
                                                            {item.gate_pass_number}
                                                        </span>
                                                    </td>
                                                    <td>{item.vendor_name}</td>
                                                    <td>{item.material_type_desc || item.material_desc}</td>
                                                    <td>{item.approx_quantity || item.quantity}</td>
                                                    <td>{item.invoice_no || '-'}</td>
                                                </>
                                            ) : (
                                                <>
                                                    <td>
                                                        <span className="badge badge-blue">
                                                            {`ISS-${item.id}`}
                                                        </span>
                                                    </td>
                                                    <td>{item.material_category || '-'}</td>
                                                    <td>{item.created_at ? new Date(item.created_at).toLocaleDateString('en-IN') : '-'}</td>
                                                    <td>{item.material_name || '-'}</td>
                                                    <td>{item.quantity_requested} {item.material_unit}</td>
                                                    <td>{item.requesting_dept}</td>
                                                </>
                                            )}

                                            {activeTab !== 'approved_issues' && (
                                                <td>
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        {activeTab !== 'stage1' ? (
                                                            <button
                                                                className="btn"
                                                                onClick={() => handleAction(item.id, 'APPROVED', activeTab)}
                                                                style={{ background: 'var(--success)', color: 'white', padding: '0.5rem' }}
                                                                title="Approve"
                                                            >
                                                                <CheckCircle size={18} />
                                                            </button>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    className="btn"
                                                                    onClick={() => handleAction(item.id, 'APPROVED', activeTab)}
                                                                    style={{ background: 'var(--success)', color: 'white', padding: '0.5rem' }}
                                                                    title="Approve"
                                                                >
                                                                    <CheckCircle size={18} />
                                                                </button>
                                                                <button
                                                                    className="btn"
                                                                    onClick={() => handleAction(item.id, 'REJECTED', activeTab)}
                                                                    style={{ background: 'var(--danger)', color: 'white', padding: '0.5rem' }}
                                                                    title="Reject"
                                                                >
                                                                    <XCircle size={18} />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </>
                )}
            </div >
        </DashboardLayout >
    )
}

export default OfficerDashboard
