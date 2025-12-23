import { useState, useEffect } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import api from '../api/axios'
import { CheckCircle, XCircle } from 'lucide-react'

const OfficerDashboard = () => {
    const [activeTab, setActiveTab] = useState('stage1') // stage1, final, issues
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchItems = async () => {
        setLoading(true)
        try {
            let endpoint = '/officer/pending-stage-1'
            if (activeTab === 'final') endpoint = '/officer/final-pending'
            if (activeTab === 'issues') endpoint = '/officer/pending-issues'

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
                // Final approval logic in backend just takes ID, assume approved for now or add reject
                // Current backend only has 'final-approve' endpoint which implies approval. 
                // Let's assume ONLY Approval for Final stage in MVP based on my API design?
                // Checking backend... main.py: /officer/{entry_id}/final-approve
                // It doesn't take body. So only Approve supported?
                if (action === 'REJECTED') {
                    alert("Rejection at final stage not implemented in MVP yet")
                    return
                }
                endpoint = `/officer/${id}/final-approve`
            } else if (type === 'issue') {
                // Issue approval
                endpoint = `/officer/issue/${id}/approve`
            }

            await api.post(endpoint, body)
            fetchItems() // Refresh
        } catch (error) {
            alert("Action failed")
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
            </div>

            <div className="glass-panel table-container">
                {items.length === 0 && !loading && (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No pending items in this category.
                    </div>
                )}

                {items.length > 0 && (
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                {activeTab !== 'issues' ? (
                                    <>
                                        <th>Vendor</th>
                                        <th>Material</th>
                                        <th>Qty</th>
                                        <th>Invoice</th>
                                    </>
                                ) : (
                                    <>
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
                                    <td>
                                        <span className="badge badge-blue">
                                            {item.gate_pass_number || `ISS-${item.id}`}
                                        </span>
                                    </td>

                                    {activeTab !== 'issues' ? (
                                        <>
                                            <td>{item.vendor_name}</td>
                                            <td>{item.material_type_desc || item.material_desc}</td>
                                            <td>{item.approx_quantity || item.quantity}</td>
                                            <td>{item.invoice_no || '-'}</td>
                                        </>
                                    ) : (
                                        <>
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
            </div>
        </DashboardLayout>
    )
}

export default OfficerDashboard
