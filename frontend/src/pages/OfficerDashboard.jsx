import { useState, useEffect } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import api from '../api/axios'
import { CheckCircle, XCircle } from 'lucide-react'
import StoreInventoryTable from '../components/StoreInventoryTable'

const OfficerDashboard = () => {
    const [activeTab, setActiveTab] = useState('stage1') // stage1, final, issues, inventory
    const [items, setItems] = useState([])
    const [storeItems, setStoreItems] = useState([]) // For personal inventory view
    const [loading, setLoading] = useState(true)

    const fetchItems = async () => {
        setLoading(true)
        try {
            let endpoint = '/officer/pending-stage-1'
            if (activeTab === 'final') endpoint = '/officer/final-pending'
            if (activeTab === 'issues') endpoint = '/officer/pending-issues'

            if (activeTab === 'inventory') {
                const res = await api.get('/store/items')
                setStoreItems(res.data)
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
                    alert("Rejection at final stage not implemented in MVP yet")
                    return
                }
                endpoint = `/officer/${id}/final-approve`
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
                <TabButton id="inventory" label="My Store Inventory" />
            </div>

            <div className="glass-panel table-container">

                {activeTab === 'inventory' ? (
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
                                            <button
                                                className="btn"
                                                onClick={() => handleAction(item.id, 'APPROVED', 'final')}
                                                style={{ background: 'var(--success)', color: 'white', padding: '0.75rem 1.5rem' }}
                                            >
                                                <CheckCircle size={18} style={{ marginRight: '0.5rem' }} />
                                                Final Approve
                                            </button>
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
                                                <h4 style={{ marginTop: '1.5rem', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                                    Store Manager Verification Details
                                                </h4>

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
                                                            <div>
                                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Min Stock Level</label>
                                                                <p style={{ margin: '0.25rem 0 0', fontWeight: 600 }}>{inwardItem.min_stock_level || '-'}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
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
                                                <th>Material</th>
                                                <th>Dept</th>
                                                <th>Purpose</th>
                                                <th>Qty</th>
                                            </>
                                        )}
                                        <th>Actions</th>
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
                                                        dateStyle: 'short',
                                                        timeStyle: 'short'
                                                    })}</td>
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
                                                    <td>{item.material_name || '-'}</td>
                                                    <td>{item.requesting_dept}</td>
                                                    <td>{item.purpose}</td>
                                                    <td>{item.quantity_requested}</td>
                                                </>
                                            )}

                                            <td>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button
                                                        className="btn"
                                                        onClick={() => handleAction(item.id, 'APPROVED', activeTab)}
                                                        style={{ background: 'var(--success)', color: 'white', padding: '0.5rem' }}
                                                        title="Approve"
                                                    >
                                                        <CheckCircle size={18} />
                                                    </button>

                                                    {activeTab === 'stage1' && (
                                                        <button
                                                            className="btn"
                                                            onClick={() => handleAction(item.id, 'REJECTED', activeTab)}
                                                            style={{ background: 'var(--danger)', color: 'white', padding: '0.5rem' }}
                                                            title="Reject"
                                                        >
                                                            <XCircle size={18} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </>
                )}
            </div>
        </DashboardLayout>
    )
}

export default OfficerDashboard
