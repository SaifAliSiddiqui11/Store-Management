import { useState, useEffect } from 'react'
import api from '../api/axios'
import { FileText, Download, Search, Filter, Calendar, User, Clock } from 'lucide-react'

const MaterialInwardReportContent = () => {
    const [loading, setLoading] = useState(false)
    const [reportData, setReportData] = useState([])
    const [officers, setOfficers] = useState([])
    
    // Filters
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [officerId, setOfficerId] = useState('')
    const [search, setSearch] = useState('')

    const fetchOfficers = async () => {
        try {
            const res = await api.get('/officers')
            console.log("Fetched officers:", res.data)
            setOfficers(res.data)
        } catch (error) {
            console.error("Failed to fetch officers", error)
        }
    }

    const fetchReportData = async () => {
        setLoading(true)
        try {
            const params = {}
            // Only add params if they have values
            if (startDate) params.start_date = new Date(startDate).toISOString()
            if (endDate) params.end_date = new Date(endDate).toISOString()
            if (officerId) params.officer_id = officerId
            if (search) params.search = search

            console.log("Fetching report with params:", params)
            const res = await api.get('/reports/material-inward', { params })
            setReportData(res.data.data)
        } catch (error) {
            console.error("Failed to fetch report data", error)
            alert("Failed to load report data")
        } finally {
            setLoading(false)
        }
    }

    // Initial load
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
            if (officerId) params.append('officer_id', officerId)
            if (search) params.append('search', search)

            const baseUrl = import.meta.env.VITE_API_URL || ''
            const response = await fetch(`${baseUrl}/reports/material-inward/pdf?${params.toString()}`, {
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
            a.download = `Inward_Report_${new Date().toISOString().split('T')[0]}.pdf`
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
        setOfficerId('')
        setSearch('')
        // Fetch all data again after state clearing
        setTimeout(() => fetchReportData(), 0)
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Filters Section */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--primary)' }}>
                    <Filter size={20} />
                    <h3 style={{ margin: 0 }}>Report Filters</h3>
                </div>
                
                <form onSubmit={handleFilterSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', alignItems: 'end' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                            <Calendar size={14} style={{ marginRight: '4px' }} /> Start Date
                        </label>
                        <input 
                            type="date" 
                            className="glass-input" 
                            value={startDate} 
                            onChange={e => setStartDate(e.target.value)} 
                        />
                    </div>
                    
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                            <Calendar size={14} style={{ marginRight: '4px' }} /> End Date
                        </label>
                        <input 
                            type="date" 
                            className="glass-input" 
                            value={endDate} 
                            onChange={e => setEndDate(e.target.value)} 
                        />
                    </div>
                    
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                            <User size={14} style={{ marginRight: '4px' }} /> Officer Assigned
                        </label>
                        <select 
                            className="glass-input" 
                            value={officerId} 
                            onChange={e => {
                                const val = e.target.value;
                                setOfficerId(val === "" ? "" : val); // Keep as string for select value compatibility
                            }}
                        >
                            <option value="">All Officers</option>
                            {officers.map(off => (
                                <option key={off.id} value={off.id.toString()}>{off.username}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                            <Search size={14} style={{ marginRight: '4px' }} /> Global Search
                        </label>
                        <input 
                            className="glass-input" 
                            placeholder="GP, Vendor, Material..." 
                            value={search} 
                            onChange={e => setSearch(e.target.value)} 
                        />
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                            Apply Filters
                        </button>
                        <button type="button" onClick={resetFilters} className="btn btn-secondary">
                            Reset
                        </button>
                    </div>
                </form>
            </div>

            {/* Report Content */}
            <div className="glass-panel" style={{ padding: '1.5rem', minHeight: '400px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FileText size={20} color="var(--primary)" />
                        <h3 style={{ margin: 0 }}>Material Inward Records ({reportData.length})</h3>
                    </div>
                    
                    <button 
                        onClick={downloadPDF} 
                        className="btn btn-success" 
                        disabled={reportData.length === 0 || loading}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <Download size={18} />
                        Download PDF Report
                    </button>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                        <div className="loading-spinner"></div>
                        <p style={{ marginLeft: '1rem' }}>Generating report...</p>
                    </div>
                ) : reportData.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                        <Clock size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                        <p>No records found matching the selected filters.</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Gatepass</th>
                                    <th>Vendor</th>
                                    <th>Material Description</th>
                                    <th>Officer</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.map((item, idx) => (
                                    <tr key={idx}>
                                        <td style={{ whiteSpace: 'nowrap' }}>
                                            {new Date(item.date).toLocaleDateString('en-IN')}
                                        </td>
                                        <td>
                                            <span className="badge badge-blue" style={{ fontSize: '0.75rem' }}>
                                                {item.gate_pass_number}
                                            </span>
                                        </td>
                                        <td style={{ fontWeight: 500 }}>{item.vendor_name}</td>
                                        <td style={{ maxWidth: '350px' }}>{item.material_description || '-'}</td>
                                        <td>{item.officer_name}</td>
                                        <td>
                                            <span className={`badge ${
                                                item.status === 'FINAL_APPROVED' ? 'badge-success' : 
                                                item.status.includes('REJECTED') ? 'badge-danger' : 
                                                'badge-warning'
                                            }`} style={{ fontSize: '0.7rem' }}>
                                                {item.status.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Quick Actions / Summary Info */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid var(--primary)' }}>
                    <h4 style={{ margin: '0 0 1rem 0' }}>Daily Summary</h4>
                    <div style={{ display: 'flex', gap: '2rem' }}>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Inwards Today</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                                {reportData.filter(d => new Date(d.date).toDateString() === new Date().toDateString()).length}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Approved Items</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--success)' }}>
                                {reportData.filter(d => d.status === 'FINAL_APPROVED').length}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MaterialInwardReportContent
