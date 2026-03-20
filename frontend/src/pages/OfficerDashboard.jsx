import { useState, useEffect } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import api from '../api/axios'
import { CheckCircle, XCircle, Edit, ChevronDown, ChevronRight } from 'lucide-react'
import StoreInventoryTable from '../components/StoreInventoryTable'
import MaterialVariantAutocomplete from '../components/MaterialVariantAutocomplete'

const OfficerDashboard = () => {
    const [activeTab, setActiveTab] = useState('stage1') // stage1, final, issues, inventory, materials, settings
    const [items, setItems] = useState([])
    const [storeItems, setStoreItems] = useState([]) // For personal inventory view
    const [materials, setMaterials] = useState([]) // For material management
    const [loading, setLoading] = useState(true)

    // Password change state
    const [passwordForm, setPasswordForm] = useState({
        current_password: '',
        new_password: '',
        confirm_password: ''
    })

    // Material creation form state
    const [materialForm, setMaterialForm] = useState({
        code: '',
        name: '',
        description: '',
        category: 'CONSUMABLE',
        unit: 'Nos',
        min_stock_level: '' // Empty, must be entered by user
    })

    // Catalog Filters
    const [materialSearch, setMaterialSearch] = useState('')
    const [materialCategoryFilter, setMaterialCategoryFilter] = useState('')
    const [expandedMaterialRows, setExpandedMaterialRows] = useState({}) // State to track expanded rows

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
        if (activeTab !== 'settings') {
            fetchItems()
        }
    }, [activeTab])

    const handlePasswordChange = async (e) => {
        e.preventDefault()
        if (passwordForm.new_password !== passwordForm.confirm_password) {
            alert("New passwords do not match!")
            return
        }
        if (passwordForm.new_password.length < 6) {
            alert("Password must be at least 6 characters long.")
            return
        }
        try {
            await api.put('/users/me/password', {
                current_password: passwordForm.current_password,
                new_password: passwordForm.new_password
            })
            alert("Password changed successfully! Please log in again.")
            localStorage.removeItem('token')
            window.location.href = '/login'
        } catch (error) {
            alert(error.response?.data?.detail || "Failed to change password")
        }
    }

    const handleAction = async (id, action, type = 'stage1', remarks = null) => {
        // Only show confirmation if remarks weren't already provided (to avoid double dialogs)
        if (!remarks && !confirm(`Are you sure you want to ${action}?`)) return

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
                if (action === 'REJECTED') {
                    endpoint = `/officer/issue/${id}/reject`
                    body = { action, remarks: remarks || 'Rejected by Officer' }
                } else {
                    endpoint = `/officer/issue/${id}/approve`
                }
            }

            console.log(`[handleAction] POST ${endpoint}`, body)
            const response = await api.post(endpoint, body)
            console.log(`[handleAction] Response:`, response.data)
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

    // Edit functionality for Stage 1
    const [stage1EditModalOpen, setStage1EditModalOpen] = useState(false)
    const [editingStage1Entry, setEditingStage1Entry] = useState(null)
    const [stage1EditForm, setStage1EditForm] = useState({
        vendor_name: '',
        vendor_location: '',
        material_type_desc: ''
    })

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
            material_id: inwardItem.material_id || null, // For autocomplete
            quantity_received: inwardItem.quantity_received,
            store_room: inwardItem.store_room,
            rack_no: inwardItem.rack_no,
            shelf_no: inwardItem.shelf_no,
            material_category: inwardItem.material_category,
            material_unit: inwardItem.material_unit,
            material_description: inwardItem.material_description,
            rating: inwardItem.rating || '',
            size: inwardItem.size || '',
            material_make: inwardItem.material_make || ''
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
                        material_unit: editForm.material_unit,
                        material_description: editForm.material_description,
                        rating: editForm.rating,
                        size: editForm.size,
                        material_make: editForm.material_make
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
                min_stock_level: '' // Empty, must be entered by user
            })
            fetchItems() // Refresh materials list
        } catch (error) {
            console.error('Failed to create material:', error)
            const errorMsg = error.response?.data?.detail || 'Failed to create material'
            alert(errorMsg)
        }
    }

    const downloadApprovalPDF = async (issueId) => {
        try {
            const token = localStorage.getItem('token')
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/issue/${issueId}/approval-note`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })

            if (!response.ok) {
                const errorText = await response.text()
                console.error('PDF download failed:', response.status, errorText)
                throw new Error(`Server returned ${response.status}: ${errorText}`)
            }

            // Get the blob from response
            const blob = await response.blob()

            // Verify it's a PDF
            if (blob.type !== 'application/pdf') {
                console.error('Invalid content type:', blob.type)
                throw new Error('Server did not return a PDF file')
            }

            // Create download link
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `Approval_Note_ISS-${issueId}.pdf`
            document.body.appendChild(a)
            a.click()

            // Cleanup
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (error) {
            console.error('Error downloading PDF:', error)
            alert(`Failed to download PDF: ${error.message}`)
        }
    }

    const openStage1EditModal = (entry) => {
        setEditingStage1Entry(entry)
        setStage1EditForm({
            vendor_name: entry.vendor_name,
            vendor_location: entry.vendor_location || '',
            material_type_desc: entry.material_type_desc || ''
        })
        setStage1EditModalOpen(true)
    }

    const closeStage1EditModal = () => {
        setStage1EditModalOpen(false)
        setEditingStage1Entry(null)
        setStage1EditForm({
            vendor_name: '',
            vendor_location: '',
            material_type_desc: ''
        })
    }

    const handleStage1EditSubmit = async (e) => {
        e.preventDefault()
        try {
            await api.put(`/gate-entry/${editingStage1Entry.id}`, stage1EditForm)
            alert('Gate entry updated successfully!')
            closeStage1EditModal()
            fetchItems()
        } catch (error) {
            console.error('Failed to update entry', error)
            alert(error.response?.data?.detail || 'Failed to update entry')
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
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                <TabButton id="stage1" label="Gate Approvals (Stage 1)" />
                <TabButton id="final" label="Results & Final (Stage 2)" />
                <TabButton id="issues" label="Material Issues" />
                <TabButton id="approved_issues" label="Approved Issues" />
                <TabButton id="materials" label="Material Management" />
                <TabButton id="inventory" label="My Store Inventory" />
                <TabButton id="settings" label="Profile Settings" />
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
                                        <th style={{ width: '40px' }}></th>
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
                                        const hasVariants = m.variants && m.variants.length > 0;
                                        const isExpanded = expandedMaterialRows[m.id];

                                        const toggleRow = () => {
                                            setExpandedMaterialRows(prev => ({
                                                ...prev,
                                                [m.id]: !prev[m.id]
                                            }));
                                        };

                                        return (
                                            <>
                                                <tr key={m.id} onClick={hasVariants ? toggleRow : undefined} style={{ cursor: hasVariants ? 'pointer' : 'default' }}>
                                                    <td>
                                                        {hasVariants && (
                                                            <button
                                                                className="btn-icon"
                                                                style={{ padding: 0, background: 'none', border: 'none', color: 'var(--text-muted)' }}
                                                            >
                                                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                            </button>
                                                        )}
                                                    </td>
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
                                                {isExpanded && hasVariants && (
                                                    <tr style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
                                                        <td colSpan="8" style={{ padding: '0 0 1rem 3rem' }}>
                                                            <div style={{ marginTop: '0.5rem' }}>
                                                                <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Variants</h5>
                                                                <table style={{ width: '100%', fontSize: '0.9rem', borderLeft: '2px solid var(--primary-light)' }}>
                                                                    <thead>
                                                                        <tr style={{ background: 'none' }}>
                                                                            <th style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>Rating</th>
                                                                            <th style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>Size</th>
                                                                            <th style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>Make</th>
                                                                            <th style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>Current Stock</th>
                                                                            <th style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>Unit</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {m.variants.map(v => (
                                                                            <tr key={v.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                                                <td style={{ padding: '0.5rem' }}>{v.rating || '-'}</td>
                                                                                <td style={{ padding: '0.5rem' }}>{v.size || '-'}</td>
                                                                                <td style={{ padding: '0.5rem' }}>{v.material_make || '-'}</td>
                                                                                <td style={{ padding: '0.5rem', fontWeight: 'bold', color: 'var(--success)' }}>
                                                                                    {v.current_stock || 0}
                                                                                </td>
                                                                                <td style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>
                                                                                    {m.unit || '-'}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
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

                                                            {/* Additional Material Specifications */}
                                                            <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                                                                <MaterialVariantAutocomplete
                                                                    materialId={editForm.material_id}
                                                                    field="rating"
                                                                    value={editForm.rating}
                                                                    onChange={(value) => setEditForm({ ...editForm, rating: value })}
                                                                    label="Rating"
                                                                    placeholder="Enter rating..."
                                                                    disabled={!editForm.material_id}
                                                                />
                                                                <MaterialVariantAutocomplete
                                                                    materialId={editForm.material_id}
                                                                    field="size"
                                                                    value={editForm.size}
                                                                    onChange={(value) => setEditForm({ ...editForm, size: value })}
                                                                    label="Size"
                                                                    placeholder="Enter size..."
                                                                    disabled={!editForm.material_id}
                                                                />
                                                                <MaterialVariantAutocomplete
                                                                    materialId={editForm.material_id}
                                                                    field="material_make"
                                                                    value={editForm.material_make}
                                                                    onChange={(value) => setEditForm({ ...editForm, material_make: value })}
                                                                    label="Material Make"
                                                                    placeholder="Enter material make..."
                                                                    disabled={!editForm.material_id}
                                                                />
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
                                                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Rating</label>
                                                                        <p style={{ margin: '0.25rem 0 0', fontWeight: 600 }}>{inwardItem.rating || '-'}</p>
                                                                    </div>
                                                                    <div>
                                                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Size</label>
                                                                        <p style={{ margin: '0.25rem 0 0', fontWeight: 600 }}>{inwardItem.size || '-'}</p>
                                                                    </div>
                                                                    <div>
                                                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Material Make</label>
                                                                        <p style={{ margin: '0.25rem 0 0', fontWeight: 600 }}>{inwardItem.material_make || '-'}</p>
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
                                                <th>Actions</th>
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
                                                <th>Date</th>
                                                <th>Material(s)</th>
                                                <th>Category</th>
                                                <th>Qty</th>
                                                <th>Purpose</th>
                                                <th>Issued To (Dept)</th>
                                            </>
                                        )}
                                        {activeTab !== 'approved_issues' && <th>Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map(item => {
                                        // Derive material info from items array for new-style multi-item issues
                                        const issueItems = item.items || [];
                                        const hasMaterialItems = issueItems.length > 0;
                                        const materialNamesSummary = hasMaterialItems
                                            ? issueItems.map(i => i.material_description || 'Material').join(', ')
                                            : (item.material_name || '-');
                                        const categorySummary = hasMaterialItems
                                            ? [...new Set(issueItems.map(i => i.material_category).filter(Boolean))].join(', ') || '-'
                                            : (item.material_category || '-');
                                        const totalQty = hasMaterialItems
                                            ? issueItems.reduce((sum, i) => sum + (i.quantity_issued || 0), 0)
                                            : (item.quantity_requested || 0);
                                        const unitSummary = hasMaterialItems
                                            ? [...new Set(issueItems.map(i => i.material_unit).filter(Boolean))].join('/') || ''
                                            : (item.material_unit || '');

                                        return (
                                            <>
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
                                                            <td>
                                                                <button
                                                                    onClick={() => downloadApprovalPDF(item.id)}
                                                                    className="btn btn-sm btn-primary"
                                                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                                                                    title="Download PDF Approval Note"
                                                                >
                                                                    📄 PDF
                                                                </button>
                                                            </td>
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
                                                            <td>{item.created_at ? new Date(item.created_at).toLocaleDateString('en-IN') : '-'}</td>
                                                            <td style={{ fontWeight: 600 }}>{materialNamesSummary}</td>
                                                            <td>{categorySummary}</td>
                                                            <td style={{ fontWeight: 600 }}>{totalQty} {unitSummary}</td>
                                                            <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.purpose}</td>
                                                            <td>{item.requesting_dept}</td>
                                                        </>
                                                    )}

                                                    {activeTab !== 'approved_issues' && (
                                                        <td>
                                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                                {activeTab !== 'stage1' ? (
                                                                    <>
                                                                        <button
                                                                            className="btn"
                                                                            onClick={() => handleAction(item.id, 'APPROVED', activeTab)}
                                                                            style={{ background: 'var(--success)', color: 'white', padding: '0.5rem' }}
                                                                            title="Approve"
                                                                        >
                                                                            <CheckCircle size={18} />
                                                                        </button>
                                                                        {activeTab === 'issues' && (
                                                                            <button
                                                                                className="btn"
                                                                                onClick={() => {
                                                                                    const remarks = prompt("Enter reason for rejection:");
                                                                                    if (remarks) handleAction(item.id, 'REJECTED', activeTab, remarks);
                                                                                }}
                                                                                style={{ background: 'var(--danger)', color: 'white', padding: '0.5rem' }}
                                                                                title="Reject"
                                                                            >
                                                                                <XCircle size={18} />
                                                                            </button>
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <button
                                                                            className="btn"
                                                                            onClick={() => openStage1EditModal(item)}
                                                                            style={{ background: 'rgba(255,255,255,0.1)', color: 'white', padding: '0.5rem' }}
                                                                            title="Edit"
                                                                        >
                                                                            <Edit size={18} />
                                                                        </button>
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
                                                {/* Expandable variant detail rows for issues and approved_issues */}
                                                {
                                                    (activeTab === 'issues' || activeTab === 'approved_issues') && hasMaterialItems && issueItems.length > 0 && (
                                                        <tr key={`${item.id}-details`} style={{ background: 'rgba(255,255,255,0.02)' }}>
                                                            <td colSpan={activeTab === 'approved_issues' ? 9 : 8} style={{ padding: '0.75rem 1rem 0.75rem 2.5rem' }}>
                                                                <div style={{ fontSize: '0.85rem' }}>
                                                                    <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                                                                        Item Details ({issueItems.length} item{issueItems.length > 1 ? 's' : ''})
                                                                    </div>
                                                                    <table style={{ width: '100%', fontSize: '0.85rem', borderLeft: '2px solid var(--primary-light)' }}>
                                                                        <thead>
                                                                            <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                                                                                <th style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)', fontWeight: 500 }}>Material</th>
                                                                                <th style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)', fontWeight: 500 }}>Category</th>
                                                                                <th style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)', fontWeight: 500 }}>Qty</th>
                                                                                <th style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)', fontWeight: 500 }}>Rating</th>
                                                                                <th style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)', fontWeight: 500 }}>Size</th>
                                                                                <th style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)', fontWeight: 500 }}>Make</th>
                                                                                <th style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)', fontWeight: 500 }}>Location</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {issueItems.map((issItem, idx) => (
                                                                                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                                                    <td style={{ padding: '0.4rem 0.6rem', fontWeight: 600 }}>{issItem.material_description || '-'}</td>
                                                                                    <td style={{ padding: '0.4rem 0.6rem' }}>{issItem.material_category || '-'}</td>
                                                                                    <td style={{ padding: '0.4rem 0.6rem', fontWeight: 600, color: 'var(--success)' }}>
                                                                                        {issItem.quantity_issued} {issItem.material_unit || ''}
                                                                                    </td>
                                                                                    <td style={{ padding: '0.4rem 0.6rem' }}>{issItem.rating || '-'}</td>
                                                                                    <td style={{ padding: '0.4rem 0.6rem' }}>{issItem.size || '-'}</td>
                                                                                    <td style={{ padding: '0.4rem 0.6rem' }}>{issItem.material_make || '-'}</td>
                                                                                    <td style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                                                        {[issItem.store_room, issItem.rack_no, issItem.shelf_no].filter(Boolean).join(' / ') || '-'}
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )
                                                }
                                            </>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </>
                )}
            </div >

            {/* Settings Tab */}
            {activeTab === 'settings' && (
                <div className="glass-panel" style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem' }}>
                    <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
                        Change Password
                    </h2>
                    <form onSubmit={handlePasswordChange} className="dashboard-grid" style={{ gridTemplateColumns: '1fr' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Current Password *</label>
                            <input
                                required
                                type="password"
                                className="glass-input"
                                value={passwordForm.current_password}
                                onChange={e => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                                placeholder="Enter current password"
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>New Password *</label>
                            <input
                                required
                                type="password"
                                className="glass-input"
                                value={passwordForm.new_password}
                                onChange={e => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                                placeholder="Enter new password"
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Confirm New Password *</label>
                            <input
                                required
                                type="password"
                                className="glass-input"
                                value={passwordForm.confirm_password}
                                onChange={e => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                                placeholder="Confirm new password"
                            />
                        </div>
                        <div style={{ marginTop: '1rem' }}>
                            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                                Update Password
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Stage 1 Edit Modal */}
            {
                stage1EditModalOpen && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}>
                        <div className="glass-panel" style={{
                            maxWidth: '600px',
                            width: '90%',
                            padding: '2rem',
                            maxHeight: '90vh',
                            overflowY: 'auto'
                        }}>
                            <h2 style={{ marginBottom: '1.5rem' }}>Edit Gate Entry</h2>
                            <form onSubmit={handleStage1EditSubmit}>
                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Vendor Name</label>
                                    <input
                                        required
                                        className="glass-input"
                                        value={stage1EditForm.vendor_name}
                                        onChange={e => setStage1EditForm({ ...stage1EditForm, vendor_name: e.target.value })}
                                        placeholder="Enter vendor name"
                                    />
                                </div>

                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Location / Origin</label>
                                    <input
                                        required
                                        className="glass-input"
                                        value={stage1EditForm.vendor_location}
                                        onChange={e => setStage1EditForm({ ...stage1EditForm, vendor_location: e.target.value })}
                                        placeholder="Where are they coming from?"
                                    />
                                </div>

                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Material Description</label>
                                    <input
                                        required
                                        className="glass-input"
                                        value={stage1EditForm.material_type_desc}
                                        onChange={e => setStage1EditForm({ ...stage1EditForm, material_type_desc: e.target.value })}
                                        placeholder="Brief description of material"
                                    />
                                </div>

                                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                    <button
                                        type="button"
                                        onClick={closeStage1EditModal}
                                        className="btn btn-secondary"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </DashboardLayout >
    )
}

export default OfficerDashboard
