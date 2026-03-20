import { useState, useEffect } from 'react'
import api from '../api/axios'
import { FileBarChart, Download, Search, Filter, Box, MapPin, Tag, Info } from 'lucide-react'

const InventoryReportContent = () => {
    const [loading, setLoading] = useState(false)
    const [inventoryData, setInventoryData] = useState([])
    
    // Filters
    const [category, setCategory] = useState('')
    const [search, setSearch] = useState('')
    const [make, setMake] = useState('')
    const [size, setSize] = useState('')
    const [rating, setRating] = useState('')

    const fetchInventoryData = async () => {
        setLoading(true)
        try {
            const params = {}
            if (category) params.category = category
            if (search) params.search = search
            if (make) params.make = make
            if (size) params.size = size
            if (rating) params.rating = rating

            console.log("Fetching inventory with params:", params)
            const res = await api.get('/reports/inventory', { params })
            setInventoryData(res.data.data)
        } catch (error) {
            console.error("Failed to fetch inventory data", error)
            alert("Failed to load inventory report")
        } finally {
            setLoading(false)
        }
    }

    // Initial load
    useEffect(() => {
        fetchInventoryData()
    }, [])

    const handleFilterSubmit = (e) => {
        if (e) e.preventDefault()
        fetchInventoryData()
    }

    const downloadPDF = async () => {
        try {
            const token = localStorage.getItem('token')
            const params = new URLSearchParams()
            if (category) params.append('category', category)
            if (search) params.append('search', search)
            if (make) params.append('make', make)
            if (size) params.append('size', size)
            if (rating) params.append('rating', rating)

            const baseUrl = import.meta.env.VITE_API_URL || ''
            const response = await fetch(`${baseUrl}/reports/inventory/pdf?${params.toString()}`, {
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
            a.download = `Live_Inventory_Report_${new Date().toISOString().split('T')[0]}.pdf`
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
        setCategory('')
        setSearch('')
        setMake('')
        setSize('')
        setRating('')
        setTimeout(() => fetchInventoryData(), 0)
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Filters Section */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--primary)' }}>
                    <Filter size={20} />
                    <h3 style={{ margin: 0 }}>Inventory Filters</h3>
                </div>
                
                <form onSubmit={handleFilterSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.2rem', alignItems: 'end' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                            Category
                        </label>
                        <select 
                            className="glass-input" 
                            value={category} 
                            onChange={e => setCategory(e.target.value)}
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
                    </div>
                    
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                            Search Material
                        </label>
                        <input 
                            className="glass-input" 
                            placeholder="Code or Name..." 
                            value={search} 
                            onChange={e => setSearch(e.target.value)} 
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                            Make / Brand
                        </label>
                        <input 
                            className="glass-input" 
                            placeholder="e.g. Tata, SKF" 
                            value={make} 
                            onChange={e => setMake(e.target.value)} 
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                            Size / Dim
                        </label>
                        <input 
                            className="glass-input" 
                            placeholder="e.g. 10mm, 1/2 inch" 
                            value={size} 
                            onChange={e => setSize(e.target.value)} 
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                            Rating / Grade
                        </label>
                        <input 
                            className="glass-input" 
                            placeholder="e.g. 8.8, 316L" 
                            value={rating} 
                            onChange={e => setRating(e.target.value)} 
                        />
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                            Apply
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
                        <FileBarChart size={24} color="var(--primary)" />
                        <h3 style={{ margin: 0 }}>Live Stock Inventory ({inventoryData.length} entries)</h3>
                    </div>
                    
                    <button 
                        onClick={downloadPDF} 
                        className="btn btn-success" 
                        disabled={inventoryData.length === 0 || loading}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <Download size={18} />
                        Download PDF
                    </button>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                        <div className="loading-spinner"></div>
                        <p style={{ marginLeft: '1rem' }}>Refreshing live data...</p>
                    </div>
                ) : inventoryData.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                        <Box size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                        <p>No inventory items found matching the filters.</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                    <th>Material Info</th>
                                    <th>Category</th>
                                    <th>Specifications (Variant)</th>
                                    <th>Storage Location</th>
                                    <th style={{ textAlign: 'right' }}>Current Qty</th>
                                    <th>Unit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {inventoryData.map((item, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span className="badge badge-blue" style={{ width: 'fit-content', marginBottom: '4px', fontSize: '0.7rem' }}>
                                                    {item.material_code}
                                                </span>
                                                <span style={{ fontWeight: 600 }}>{item.material_name}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span style={{ fontSize: '0.85rem' }}>{item.category}</span>
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
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
                                                <MapPin size={12} color="var(--text-muted)" />
                                                {item.store_room || '-'}{item.rack_no ? ` / R:${item.rack_no}` : ''}{item.shelf_no ? ` / S:${item.shelf_no}` : ''}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <span style={{ fontWeight: 'bold', color: 'var(--success)', fontSize: '1.1rem' }}>
                                                {item.quantity}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{item.unit}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Quick Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid var(--success)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px' }}>
                        <Box color="var(--success)" size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Unique Items</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{inventoryData.length}</div>
                    </div>
                </div>
                
                <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid var(--primary)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '0.75rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px' }}>
                        <Tag color="var(--primary)" size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Categories</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                            {[...new Set(inventoryData.map(i => i.category))].length}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default InventoryReportContent
