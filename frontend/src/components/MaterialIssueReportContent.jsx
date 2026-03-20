import { useState, useEffect } from 'react'
import api from '../api/axios'
import { FileSpreadsheet, Download, Search, Filter, Calendar, User, Clock, Building2, ClipboardList } from 'lucide-react'

const MaterialIssueReportContent = () => {
    const [loading, setLoading] = useState(false)
    const [reportData, setReportData] = useState([])
    const [officers, setOfficers] = useState([])
    
    // Filters
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [category, setCategory] = useState('')
    const [status, setStatus] = useState('')
    const [officerId, setOfficerId] = useState('')
    const [search, setSearch] = useState('')

    const fetchOfficers = async () => {
        try {
            const res = await api.get('/officers')
            setOfficers(res.data)
        } catch (error) {
            console.error("Failed to fetch officers", error)
        }
    }

    const fetchReportData = async () => {
        setLoading(true)
        try {
            const params = {}
            if (startDate) params.start_date = new Date(startDate).toISOString()
            if (endDate) params.end_date = new Date(endDate).toISOString()
            if (category) params.category = category
            if (status) params.status = status
            if (officerId) params.officer_id = officerId
            if (search) params.search = search

            console.log("Fetching issue report with params:", params)
            const res = await api.get('/reports/material-issue', { params })
            setReportData(res.data.data)
        } catch (error) {
            console.error("Failed to fetch issue report", error)
            alert("Failed to load issue report")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchOfficers()
        fetchReportData()
    }, [])

    const handleFilterSubmit = (e) => {
        if (e) e.preventDefault()
        fetchReportData()
    }

    const downloadPDF = async () => {
        try {
            const token = localStorage.getItem('token')
            const params = new URLSearchParams()
            if (startDate) params.append('start_date', new Date(startDate).toISOString())
            if (endDate) params.append('end_date', new Date(endDate).toISOString())
            if (category) params.append('category', category)
            if (status) params.append('status', status)
            if (officerId) params.append('officer_id', officerId)
            if (search) params.append('search', search)

            const baseUrl = import.meta.env.VITE_API_URL || ''
            const response = await fetch(`${baseUrl}/reports/material-issue/pdf?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })

            if (!response.ok) throw new Error("Failed to download PDF")

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `Issue_Report_${new Date().toISOString().split('T')[0]}.pdf`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (error) {
            console.error("PDF download failed", error)
            alert("Failed to download PDF report")
        }
    }

    const resetFilters = () => {
        setStartDate('')
        setEndDate('')
        setCategory('')
        setStatus('')
        setOfficerId('')
        setSearch('')
        setTimeout(() => fetchReportData(), 0)
    }

    // Helper for status badge styling
    const getStatusBadge = (status) => {
        switch (status) {
            case 'APPROVED': return 'badge-success'
            case 'REJECTED': return 'badge-danger'
            case 'PENDING_OFFICER_APPROVAL': return 'badge-warning'
            default: return 'badge-blue'
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Filters Section */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--primary)' }}>
                    <Filter size={20} />
                    <h3 style={{ margin: 0 }}>Advanced Filters</h3>
                </div>
                
                <form onSubmit={handleFilterSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.2rem', alignItems: 'end' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Start Date</label>
                        <input type="date" className="glass-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>End Date</label>
                        <input type="date" className="glass-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Status</label>
                        <select className="glass-input" value={status} onChange={e => setStatus(e.target.value)}>
                            <option value="">All Statuses</option>
                            <option value="PENDING_OFFICER_APPROVAL">Pending</option>
                            <option value="APPROVED">Approved</option>
                            <option value="REJECTED">Rejected</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Category</label>
                        <select className="glass-input" value={category} onChange={e => setCategory(e.target.value)}>
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
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Officer</label>
                        <select className="glass-input" value={officerId} onChange={e => setOfficerId(e.target.value)}>
                            <option value="">All Officers</option>
                            {officers.map(off => (
                                <option key={off.id} value={off.id}>{off.username}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Global Search</label>
                        <input className="glass-input" placeholder="ID, Material, Dept..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Apply</button>
                        <button type="button" onClick={resetFilters} className="btn btn-secondary">Reset</button>
                    </div>
                </form>
            </div>

            {/* Report Content */}
            <div className="glass-panel" style={{ padding: '1.5rem', minHeight: '400px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FileSpreadsheet size={24} color="var(--primary)" />
                        <h3 style={{ margin: 0 }}>Material Consumption Records ({reportData.length})</h3>
                    </div>
                    
                    <button 
                        onClick={downloadPDF} 
                        className="btn btn-success" 
                        disabled={reportData.length === 0 || loading}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <Download size={18} /> Download PDF
                    </button>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                        <div className="loading-spinner"></div>
                        <p style={{ marginLeft: '1rem' }}>Processing report...</p>
                    </div>
                ) : reportData.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                        <ClipboardList size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                        <p>No issue records found for selected filters.</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                    <th>Date & ID</th>
                                    <th>Material / Category</th>
                                    <th>Variant Specifications</th>
                                    <th>Department & Purpose</th>
                                    <th>Quantity</th>
                                    <th>Status & Officer</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.map((item, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontWeight: 600 }}>{new Date(item.date).toLocaleDateString('en-IN')}</span>
                                                <span className="badge badge-blue" style={{ width: 'fit-content', marginTop: '4px', fontSize: '0.65rem' }}>
                                                    {item.issue_note_id || `ISS-${item.id}`}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontWeight: 600 }}>{item.material_name}</span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.material_code} | {item.category}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                {item.rating && <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', textTransform: 'none' }}>R: {item.rating}</span>}
                                                {item.size && <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', textTransform: 'none' }}>S: {item.size}</span>}
                                                {item.material_make && <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', textTransform: 'none' }}>M: {item.material_make}</span>}
                                                {!item.rating && !item.size && !item.material_make && <span style={{ color: 'var(--text-muted)' }}>-</span>}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                                                    <Building2 size={12} color="var(--primary)" /> {item.department}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {item.purpose}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{item.quantity}</span>
                                            <span style={{ marginLeft: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.unit}</span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <span className={`badge ${getStatusBadge(item.status)}`} style={{ width: 'fit-content', fontSize: '0.65rem' }}>
                                                    {item.status.replace(/_/g, ' ')}
                                                </span>
                                                <span style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <User size={10} /> {item.officer_name}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Premium Summary Info */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid var(--primary)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '0.75rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px' }}>
                        <ClipboardList color="var(--primary)" size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Issue Lines</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{reportData.length}</div>
                    </div>
                </div>
                
                <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid var(--success)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px' }}>
                        <Clock color="var(--success)" size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Approved Today</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                            {reportData.filter(d => d.status === 'APPROVED' && new Date(d.date).toDateString() === new Date().toDateString()).length}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MaterialIssueReportContent
