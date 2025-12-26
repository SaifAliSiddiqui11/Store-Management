import { useState, useEffect } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import api from '../api/axios'
import { Truck, Package, User, FileText } from 'lucide-react'

const SecurityDashboard = () => {
    const [formData, setFormData] = useState({
        vendor_name: '',
        vendor_location: '',
        request_officer_id: ''
    })
    const [officers, setOfficers] = useState([])
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(null)

    useEffect(() => {
        // Fetch officers list on component mount
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
        fetchOfficers()
    }, [])

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
                material_type_desc: 'Standard Entry', // Providing a default desc or null if allowed
                approx_quantity: 0
            })
            setSuccess(`Entry Created! Gate Pass: ${res.data.gate_pass_number}`)
            setFormData({
                vendor_name: '',
                vendor_location: '',
                request_officer_id: officers.length > 0 ? officers[0].id : ''
            })
        } catch (error) {
            console.error(error)
            alert('Failed to create entry')
        } finally {
            setLoading(false)
        }
    }

    return (
        <DashboardLayout title="Role: Security Guard">
            <div className="glass-panel" style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
                <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
                    New Gate Entry
                </h2>

                {success && (
                    <div className="badge badge-success" style={{ padding: '1rem', width: '100%', marginBottom: '1.5rem', textAlign: 'center', fontSize: '1rem' }}>
                        {success}
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
        </DashboardLayout>
    )
}
export default SecurityDashboard
