import { useState } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import api from '../api/axios'
import { Truck, Package, User, FileText } from 'lucide-react'

const SecurityDashboard = () => {
    const [formData, setFormData] = useState({
        vendor_name: '',
        vehicle_number: '',
        driver_name: '',
        driver_phone: '',
        material_type_desc: '',
        approx_quantity: '',
        request_officer_id: 3 // Hardcoded to Officer ID 3 for MVP demo
    })
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(null)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        try {
            const res = await api.post('/gate-entry/', formData)
            setSuccess(`Entry Created! Gate Pass: ${res.data.gate_pass_number}`)
            setFormData({
                vendor_name: '',
                vehicle_number: '',
                driver_name: '',
                driver_phone: '',
                material_type_desc: '',
                approx_quantity: '',
                request_officer_id: 3
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
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Vehicle Number</label>
                        <div style={{ position: 'relative' }}>
                            <Truck size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                            <input
                                className="glass-input"
                                style={{ paddingLeft: '2.5rem' }}
                                value={formData.vehicle_number}
                                onChange={e => setFormData({ ...formData, vehicle_number: e.target.value })}
                                placeholder="MH-04-AB-1234"
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Driver Name</label>
                        <input
                            className="glass-input"
                            value={formData.driver_name}
                            onChange={e => setFormData({ ...formData, driver_name: e.target.value })}
                            placeholder="Driver Name"
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Contact Number</label>
                        <input
                            className="glass-input"
                            value={formData.driver_phone}
                            onChange={e => setFormData({ ...formData, driver_phone: e.target.value })}
                            placeholder="Mobile No"
                        />
                    </div>

                    <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Material Description</label>
                        <div style={{ position: 'relative' }}>
                            <FileText size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                            <input
                                required
                                className="glass-input"
                                style={{ paddingLeft: '2.5rem' }}
                                value={formData.material_type_desc}
                                onChange={e => setFormData({ ...formData, material_type_desc: e.target.value })}
                                placeholder="Describe items (e.g. 5 boxes of spare parts)"
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Approx Quantity</label>
                        <div style={{ position: 'relative' }}>
                            <Package size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                            <input
                                type="number"
                                className="glass-input"
                                style={{ paddingLeft: '2.5rem' }}
                                value={formData.approx_quantity}
                                onChange={e => setFormData({ ...formData, approx_quantity: e.target.value })}
                                placeholder="Total Qty"
                            />
                        </div>
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
