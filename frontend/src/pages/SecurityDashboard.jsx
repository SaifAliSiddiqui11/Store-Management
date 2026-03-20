import { useState, useEffect } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import api from '../api/axios'
import { Truck, Package, User, FileText, Download, Edit } from 'lucide-react'

const SecurityDashboard = () => {
    const [formData, setFormData] = useState({
        vendor_name: '',
        vendor_location: '',
        material_type_desc: '',
        request_officer_id: ''
    })
    const [officers, setOfficers] = useState([])
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(null)
    const [lastEntryId, setLastEntryId] = useState(null)
    const [history, setHistory] = useState([])
    const [historyLoading, setHistoryLoading] = useState(true)
    const [editModalOpen, setEditModalOpen] = useState(false)
    const [editingEntry, setEditingEntry] = useState(null)
    const [editFormData, setEditFormData] = useState({
        vendor_name: '',
        vendor_location: '',
        material_type_desc: ''
    })

    useEffect(() => {
        // Fetch officers list and history on component mount
        const fetchOfficers = async () => {
            try {
                const res = await api.get('/officers')
                setOfficers(res.data)
                // Set first officer as default if available
                if (res.data.length > 0) {
                    setFormData(prev => ({ ...prev, request_officer_id: res.data[0].id }))
                }
            } catch (e) {
                console.error('Failed to fetch officers', e)
            }
        }

        const fetchHistory = async () => {
            try {
                setHistoryLoading(true)
                const res = await api.get('/security/history')
                setHistory(Array.isArray(res.data) ? res.data : [])
            } catch (error) {
                console.error('Failed to fetch history', error)
                setHistory([]) // Ensure history is always an array even on error
            } finally {
                setHistoryLoading(false)
            }
        }

        fetchOfficers()
        fetchHistory()
    }, [])

    const refreshHistory = async () => {
        try {
            const res = await api.get('/security/history')
            setHistory(Array.isArray(res.data) ? res.data : [])
        } catch (error) {
            console.error('Failed to fetch history', error)
            setHistory([]) // Ensure history is always an array even on error
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        try {
            const res = await api.post('/gate-entry/', {
                ...formData,
                // Send defaults for fields we removed from UI but are still part of schema (though optional now)
                vehicle_number: null,
                driver_name: null,
                driver_phone: null,
                approx_quantity: 0
            })
            setSuccess(`Entry Created! Gate Pass: ${res.data.gate_pass_number}`)
            setLastEntryId(res.data.id)
            setFormData({
                vendor_name: '',
                vendor_location: '',
                material_type_desc: '',
                request_officer_id: officers.length > 0 ? officers[0].id : ''
            })
            // Refresh history
            refreshHistory()
        } catch (error) {
            console.error(error)
            alert('Failed to create entry')
        } finally {
            setLoading(false)
        }
    }

    const downloadPDF = async (entryId) => {
        try {
            const response = await api.get(`/gate-entry/${entryId}/pdf`, {
                responseType: 'blob'
            })
            const blob = new Blob([response.data], { type: 'application/pdf' })
            const url = window.URL.createObjectURL(blob)
            window.open(url, '_blank')
            setTimeout(() => window.URL.revokeObjectURL(url), 100)
        } catch (error) {
            console.error('Failed to download PDF', error)
            alert('Failed to download PDF')
        }
    }

    const openEditModal = (entry) => {
        setEditingEntry(entry)
        setEditFormData({
            vendor_name: entry.vendor_name,
            vendor_location: entry.vendor_location || '',
            material_type_desc: entry.material_type_desc || ''
        })
        setEditModalOpen(true)
    }

    const closeEditModal = () => {
        setEditModalOpen(false)
        setEditingEntry(null)
        setEditFormData({
            vendor_name: '',
            vendor_location: '',
            material_type_desc: ''
        })
    }

    const handleEditSubmit = async (e) => {
        e.preventDefault()
        try {
            await api.put(`/gate-entry/${editingEntry.id}`, editFormData)
            alert('Gate entry updated successfully!')
            closeEditModal()
            refreshHistory()
        } catch (error) {
            console.error('Failed to update entry', error)
            alert(error.response?.data?.detail || 'Failed to update entry')
        }
    }

    const getStatusBadge = (status) => {
        const statusMap = {
            'PENDING_OFFICER_APPROVAL_1': { label: 'Pending Officer Approval', color: '#f59e0b' },
            'APPROVED_STAGE_1': { label: 'Approved by Officer', color: '#3b82f6' },
            'PENDING_OFFICER_FINAL_APPROVAL': { label: 'Pending Store Manager', color: '#8b5cf6' },
            'FINAL_APPROVED': { label: 'Final Approved', color: '#10b981' },
            'REJECTED': { label: 'Rejected', color: '#ef4444' },
            'REJECTED_STAGE_1': { label: 'Rejected by Officer', color: '#ef4444' }
        }
        const statusInfo = statusMap[status] || { label: status, color: '#6b7280' }
        return (
            <span style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: '600',
                backgroundColor: `${statusInfo.color}20`,
                color: statusInfo.color,
                whiteSpace: 'nowrap'
            }}>
                {statusInfo.label}
            </span>
        )
    }

    return (
        <DashboardLayout title="Role: Security Guard">
            <div className="glass-panel" style={{ maxWidth: '800px', margin: '0 auto 2rem', padding: '2rem' }}>
                <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
                    New Gate Entry
                </h2>

                {success && (
                    <div className="badge badge-success" style={{ padding: '1rem', width: '100%', marginBottom: '1.5rem', textAlign: 'center', fontSize: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                        <span>{success}</span>
                        <button
                            className="btn btn-primary"
                            style={{ width: 'fit-content', backgroundColor: 'var(--accent-primary)', border: 'none' }}
                            onClick={() => downloadPDF(lastEntryId)}
                        >
                            <FileText size={18} style={{ marginRight: '8px' }} />
                            Print Gate Pass
                        </button>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="dashboard-grid">
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Vendor Name</label>
                        <div style={{ position: 'relative' }}>
                            <User size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                            <input
                                required
                                className="glass-input"
                                style={{ paddingLeft: '2.5rem' }}
                                value={formData.vendor_name}
                                onChange={e => setFormData({ ...formData, vendor_name: e.target.value })}
                                placeholder="Enter vendor name"
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Location / Origin</label>
                        <div style={{ position: 'relative' }}>
                            <Truck size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                            <input
                                required
                                className="glass-input"
                                style={{ paddingLeft: '2.5rem' }}
                                value={formData.vendor_location}
                                onChange={e => setFormData({ ...formData, vendor_location: e.target.value })}
                                placeholder="Where are they coming from?"
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Material Description</label>
                        <div style={{ position: 'relative' }}>
                            <Package size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                            <input
                                required
                                className="glass-input"
                                style={{ paddingLeft: '2.5rem' }}
                                value={formData.material_type_desc}
                                onChange={e => setFormData({ ...formData, material_type_desc: e.target.value })}
                                placeholder="Brief description of material"
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Select Officer</label>
                        <select
                            required
                            className="glass-input"
                            value={formData.request_officer_id}
                            onChange={e => setFormData({ ...formData, request_officer_id: parseInt(e.target.value) })}
                        >
                            <option value="">-- Select Officer --</option>
                            {officers.map(officer => (
                                <option key={officer.id} value={officer.id}>
                                    {officer.username} ({officer.email || 'No email'})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
                        <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
                            {loading ? 'Creating...' : 'Generate Gate Pass'}
                        </button>
                    </div>
                </form>
            </div>

            {/* History Section */}
            <div className="glass-panel" style={{ padding: '2rem' }}>
                <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
                    Gate Pass History
                </h2>

                {historyLoading ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        Loading history...
                    </div>
                ) : history.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No gate passes created yet.
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Gate Pass #</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Date</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Vendor</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Location</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Material</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Status</th>
                                    <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((entry) => (
                                    <tr key={entry.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '1rem', fontWeight: '600', color: 'var(--accent-primary)' }}>
                                            {entry.gate_pass_number}
                                        </td>
                                        <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                                            {new Date(entry.created_at).toLocaleDateString('en-IN', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric'
                                            })}
                                        </td>
                                        <td style={{ padding: '1rem' }}>{entry.vendor_name}</td>
                                        <td style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                            {entry.vendor_location || 'N/A'}
                                        </td>
                                        <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                                            {entry.material_type_desc || 'N/A'}
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            {getStatusBadge(entry.status)}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                {entry.status === 'PENDING_OFFICER_APPROVAL_1' && (
                                                    <button
                                                        onClick={() => openEditModal(entry)}
                                                        className="btn btn-secondary"
                                                        style={{
                                                            padding: '0.5rem 1rem',
                                                            fontSize: '0.875rem',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '0.5rem'
                                                        }}
                                                        title="Edit entry"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => downloadPDF(entry.id)}
                                                    className="btn btn-primary"
                                                    style={{
                                                        padding: '0.5rem 1rem',
                                                        fontSize: '0.875rem',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.5rem'
                                                    }}
                                                    title="Download PDF"
                                                >
                                                    <Download size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {editModalOpen && (
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
                        <form onSubmit={handleEditSubmit}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Vendor Name</label>
                                <div style={{ position: 'relative' }}>
                                    <User size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                                    <input
                                        required
                                        className="glass-input"
                                        style={{ paddingLeft: '2.5rem' }}
                                        value={editFormData.vendor_name}
                                        onChange={e => setEditFormData({ ...editFormData, vendor_name: e.target.value })}
                                        placeholder="Enter vendor name"
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Location / Origin</label>
                                <div style={{ position: 'relative' }}>
                                    <Truck size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                                    <input
                                        required
                                        className="glass-input"
                                        style={{ paddingLeft: '2.5rem' }}
                                        value={editFormData.vendor_location}
                                        onChange={e => setEditFormData({ ...editFormData, vendor_location: e.target.value })}
                                        placeholder="Where are they coming from?"
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Material Description</label>
                                <div style={{ position: 'relative' }}>
                                    <Package size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                                    <input
                                        required
                                        className="glass-input"
                                        style={{ paddingLeft: '2.5rem' }}
                                        value={editFormData.material_type_desc}
                                        onChange={e => setEditFormData({ ...editFormData, material_type_desc: e.target.value })}
                                        placeholder="Brief description of material"
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={closeEditModal}
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
            )}
        </DashboardLayout>
    )
}
export default SecurityDashboard
