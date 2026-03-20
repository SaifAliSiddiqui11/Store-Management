import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, Plus, Trash2, LogOut } from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import api from '../api/axios'
import StoreInventoryTable from '../components/StoreInventoryTable'
import MaterialVariantAutocomplete from '../components/MaterialVariantAutocomplete'

const StoreDashboard = () => {
    const [activeTab, setActiveTab] = useState('verification') // verification, inventory, master, issue
    const [items, setItems] = useState([]) // For pending verification
    const [materials, setMaterials] = useState([]) // For inventory
    const [storeItems, setStoreItems] = useState([]) // For live inventory
    const [issueRecords, setIssueRecords] = useState([]) // For issue history
    const [officers, setOfficers] = useState([]) // For officer selection
    const [loading, setLoading] = useState(false)
    const [selectedItem, setSelectedItem] = useState(null) // For verification modal/form

    // Form states
    const [verifData, setVerifData] = useState({
        invoice_no: '',
        invoice_date: new Date().toISOString().split('T')[0], // Default to today
        remarks: '',
        qty_received: '',
        store_room: '',
        rack_no: '',
        shelf_no: '',
        material_id: '',
        // Material Master Defaults (will populate on select)
        description: '',
        category: '',
        unit: '',
        rating: '',
        size: '',
        material_make: '',
        // Gate Entry Updates
        vendor_name: ''
    })

    // New: Issue items array for multi-item support
    const [issueItems, setIssueItems] = useState([])
    const [currentIssueItem, setCurrentIssueItem] = useState({
        material_id: '',
        material_variant_id: '',
        quantity_issued: '',
        rating: '',
        size: '',
        material_make: ''
    })
    const [issueForm, setIssueForm] = useState({
        purpose: '', officer_id: ''
    })
    const [deptType, setDeptType] = useState('')
    const [deptName, setDeptName] = useState('')
    const [selectedMaterialVariants, setSelectedMaterialVariants] = useState([])

    const [materialSearch, setMaterialSearch] = useState('')
    const [issueCategory, setIssueCategory] = useState('')

    // Catalog Filters
    const [catalogSearch, setCatalogSearch] = useState('')
    const [catalogCategoryFilter, setCatalogCategoryFilter] = useState('')
    const [expandedMaterialRows, setExpandedMaterialRows] = useState({})
    const [expandedIssueRows, setExpandedIssueRows] = useState({}) // Track expanded issue records


    const filteredMaterials = materials.filter(m => {
        const matchesSearch = m.name.toLowerCase().includes(materialSearch.toLowerCase()) ||
            m.code.toLowerCase().includes(materialSearch.toLowerCase())
        const matchesCategory = issueCategory ? m.category === issueCategory : true
        return matchesSearch && matchesCategory
    })

    const filteredCatalog = materials.filter(m => {
        const matchesSearch = m.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
            m.code.toLowerCase().includes(catalogSearch.toLowerCase())
        const matchesCategory = catalogCategoryFilter ? m.category === catalogCategoryFilter : true
        return matchesSearch && matchesCategory
    })

    const fetchPending = async () => {
        setLoading(true)
        try {
            const res = await api.get('/store/pending')
            setItems(res.data)
        } catch (e) { console.error(e) }
        setLoading(false)
    }

    const fetchMaterials = async () => {
        setLoading(true)
        try {
            const res = await api.get('/materials')
            setMaterials(res.data)
        } catch (e) { console.error(e) }
        setLoading(false)
    }

    const fetchStoreItems = async () => {
        setLoading(true)
        try {
            const res = await api.get('/store/items')
            setStoreItems(res.data)
        } catch (e) { console.error(e) }
        setLoading(false)
    }

    const fetchOfficers = async () => {
        try {
            const res = await api.get('/officers')
            setOfficers(res.data)
            // Set first officer as default if available
            if (res.data.length > 0 && !issueForm.officer_id) {
                setIssueForm(prev => ({ ...prev, officer_id: res.data[0].id }))
            }
        } catch (e) { console.error(e) }
    }

    const fetchIssueHistory = async () => {
        setLoading(true)
        try {
            const res = await api.get('/store/issue-history')
            setIssueRecords(res.data)
        } catch (e) { console.error(e) }
        setLoading(false)
    }

    const downloadReceipt = async (issueId) => {
        try {
            const response = await api.get(`/ issue / ${issueId}/receipt`, {
                responseType: 'blob'
            })

            // Create a download link
            const url = window.URL.createObjectURL(new Blob([response.data]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `receipt_issue_${issueId}.txt`)
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)
        } catch (error) {
            console.error('Receipt download error:', error)
            alert('Failed to download receipt')
        }
    }

    useEffect(() => {
        if (activeTab === 'verification') {
            fetchPending()
            fetchMaterials()
        }
        if (activeTab === 'inventory' || activeTab === 'master') {
            fetchMaterials()
            fetchStoreItems()
        }
        if (activeTab === 'issue') {
            fetchMaterials()
            fetchOfficers()
        }
        if (activeTab === 'records') {
            fetchIssueHistory()
        }
    }, [activeTab])

    // Auto-populate material details when material selected for verification
    const handleVerificationMaterialSelect = (materialId) => {
        const mat = materials.find(m => m.id === parseInt(materialId))
        if (mat) {
            setVerifData(prev => ({
                ...prev,
                material_id: materialId,
                description: mat.description || mat.name,
                category: mat.category,
                unit: mat.unit
            }))
        } else {
            setVerifData(prev => ({ ...prev, material_id: materialId }))
        }
    }

    // Pre-fill Vendor Name when item selected
    useEffect(() => {
        if (selectedItem) {
            setVerifData(prev => ({
                invoice_no: '',
                invoice_date: new Date().toISOString().split('T')[0],
                remarks: '',
                qty_received: '',
                store_room: '',
                rack_no: '',
                shelf_no: '',
                material_id: '',
                description: '',
                category: '',
                unit: '',
                rating: '',
                size: '',
                material_make: '',
                vendor_name: selectedItem.vendor_name
            }))
        }
    }, [selectedItem])

    const handleVerifySubmit = async (e) => {
        e.preventDefault()
        if (!selectedItem) return

        try {
            const payload = {
                invoice_no: verifData.invoice_no,
                invoice_date: new Date(verifData.invoice_date).toISOString(),
                remarks: verifData.remarks,
                vendor_name: verifData.vendor_name,
                items: [
                    {
                        material_id: verifData.material_id ? parseInt(verifData.material_id) : null,
                        quantity_received: parseInt(verifData.qty_received),
                        store_room: verifData.store_room,
                        rack_no: verifData.rack_no,
                        shelf_no: verifData.shelf_no,
                        // Material Master updates
                        material_description: verifData.description,
                        material_category: verifData.category,
                        material_unit: verifData.unit,
                        // Additional specifications
                        rating: verifData.rating,
                        size: verifData.size,
                        material_make: verifData.material_make
                    }
                ]
            }
            await api.post(`/store/${selectedItem.id}/process`, payload)
            setSelectedItem(null)
            fetchPending()
        } catch (e) { alert("Verification Failed") }
    }



    // Handle material selection to load variants for issue
    const handleIssueMaterialSelect = async (materialId) => {
        setCurrentIssueItem({ ...currentIssueItem, material_id: materialId, material_variant_id: '' })

        if (materialId) {
            // Find material and load its variants
            const material = materials.find(m => m.id === parseInt(materialId))
            if (material && material.variants && material.variants.length > 0) {
                setSelectedMaterialVariants(material.variants)
            } else {
                setSelectedMaterialVariants([])
            }
        } else {
            setSelectedMaterialVariants([])
        }
    }

    // Add item to issue list
    const handleAddIssueItem = () => {
        if (!currentIssueItem.material_id || !currentIssueItem.quantity_issued) {
            alert('Please select material and enter quantity')
            return
        }

        const material = materials.find(m => m.id === parseInt(currentIssueItem.material_id))
        const variant = selectedMaterialVariants.find(v => v.id === parseInt(currentIssueItem.material_variant_id))

        const maxStock = variant ? variant.current_stock : material?.current_stock;

        if (maxStock !== undefined && parseInt(currentIssueItem.quantity_issued) > maxStock) {
            alert(`Quantity exceeds available stock (${maxStock})`)
            return
        }

        const newItem = {
            material_id: parseInt(currentIssueItem.material_id),
            material_variant_id: currentIssueItem.material_variant_id ? parseInt(currentIssueItem.material_variant_id) : null,
            quantity_issued: parseInt(currentIssueItem.quantity_issued),
            material_description: material?.description,
            material_category: material?.category,
            material_unit: material?.unit,
            rating: variant?.rating || currentIssueItem.rating,
            size: variant?.size || currentIssueItem.size,
            material_make: variant?.material_make || currentIssueItem.material_make,
            // For display
            _materialName: material?.name,
            _materialCode: material?.code
        }

        setIssueItems([...issueItems, newItem])
        setCurrentIssueItem({
            material_id: '',
            material_variant_id: '',
            quantity_issued: '',
            rating: '',
            size: '',
            material_make: ''
        })
        setSelectedMaterialVariants([])
    }

    // Remove item from issue list
    const handleRemoveIssueItem = (index) => {
        setIssueItems(issueItems.filter((_, i) => i !== index))
    }

    const handleRequestIssue = async (e) => {
        e.preventDefault()

        if (issueItems.length === 0) {
            alert('Please add at least one item to the issue request')
            return
        }

        try {
            const payload = {
                purpose: issueForm.purpose,
                officer_id: parseInt(issueForm.officer_id),
                requesting_dept: `${deptType} - ${deptName}`,
                items: issueItems
            }
            await api.post('/issue/request', payload)
            alert("Issue Requested Successfully")
            setIssueForm({ purpose: '', officer_id: officers.length > 0 ? officers[0].id : '' })
            setIssueItems([])
            setDeptType('')
            setDeptName('')
        } catch (err) {
            alert(err.response?.data?.detail || "Failed to request issue")
        }
    }
    const TabButton = ({ id, label }) => (
        <button onClick={() => setActiveTab(id)} style={{
            background: activeTab === id ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
            color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600
        }}>{label}</button>
    )

    return (
        <DashboardLayout title="Role: Store Manager">
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                <TabButton id="verification" label="Pending Verification" />
                <TabButton id="inventory" label="Store Inventory" />
                <TabButton id="master" label="Material Master" />
                <TabButton id="issue" label="Raise Issue" />
                <TabButton id="records" label="Issue Records" />
            </div>

            <div className="glass-panel" style={{ padding: '2rem' }}>
                {activeTab === 'verification' && (
                    <>
                        {selectedItem ? (
                            <form onSubmit={handleVerifySubmit}>
                                <h3>Verify Entry: {selectedItem.gate_pass_number}</h3>

                                <div className="dashboard-grid" style={{ marginTop: '1rem', gridTemplateColumns: '1fr 1fr 1fr' }}>
                                    {/* 1. Vendor & Invoice Details */}
                                    <div style={{ gridColumn: '1/-1', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem' }}>Vendor Name</label>
                                            <input className="glass-input" required value={verifData.vendor_name} onChange={e => setVerifData({ ...verifData, vendor_name: e.target.value })} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem' }}>Invoice Number</label>
                                            <input className="glass-input" required value={verifData.invoice_no} onChange={e => setVerifData({ ...verifData, invoice_no: e.target.value })} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem' }}>Invoice Date</label>
                                            <input className="glass-input" type="date" required value={verifData.invoice_date} onChange={e => setVerifData({ ...verifData, invoice_date: e.target.value })} />
                                        </div>
                                    </div>

                                    {/* 2. Material Details */}
                                    <div style={{ gridColumn: '1/-1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                                        <select className="glass-input" required value={verifData.material_id} onChange={e => handleVerificationMaterialSelect(e.target.value)}>
                                            <option value="">Select Official Material Code</option>
                                            {materials.map(m => <option key={m.id} value={m.id}>{m.code} - {m.name}</option>)}
                                        </select>
                                        <input className="glass-input" placeholder="Material Description" value={verifData.description} onChange={e => setVerifData({ ...verifData, description: e.target.value })} />
                                    </div>

                                    <div style={{ gridColumn: '1/-1', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                        <select className="glass-input" value={verifData.category} onChange={e => setVerifData({ ...verifData, category: e.target.value })}>
                                            <option value="">Select Category</option>
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
                                        <select className="glass-input" value={verifData.unit} onChange={e => setVerifData({ ...verifData, unit: e.target.value })}>
                                            <option value="">Select Unit</option>
                                            <option value="Nos">Nos</option>
                                            <option value="Kg">Kg</option>
                                            <option value="Ltr">Ltr</option>
                                            <option value="Mtr">Mtr</option>
                                            <option value="Box">Box</option>
                                            <option value="Set">Set</option>
                                            <option value="Roll">Roll</option>
                                        </select>
                                    </div>

                                    {/* 3. Additional Material Specifications */}
                                    <div style={{ gridColumn: '1/-1', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                                        <MaterialVariantAutocomplete
                                            materialId={verifData.material_id}
                                            field="rating"
                                            value={verifData.rating}
                                            onChange={(value) => setVerifData({ ...verifData, rating: value })}
                                            label="Rating"
                                            placeholder="Enter rating..."
                                            disabled={!verifData.material_id}
                                        />
                                        <MaterialVariantAutocomplete
                                            materialId={verifData.material_id}
                                            field="size"
                                            value={verifData.size}
                                            onChange={(value) => setVerifData({ ...verifData, size: value })}
                                            label="Size"
                                            placeholder="Enter size..."
                                            disabled={!verifData.material_id}
                                        />
                                        <MaterialVariantAutocomplete
                                            materialId={verifData.material_id}
                                            field="material_make"
                                            value={verifData.material_make}
                                            onChange={(value) => setVerifData({ ...verifData, material_make: value })}
                                            label="Material Make"
                                            placeholder="Enter material make..."
                                            disabled={!verifData.material_id}
                                        />
                                    </div>

                                    {/* 4. Receiving & Storage */}
                                    <div style={{ gridColumn: '1/-1', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                                        <input className="glass-input" required placeholder="Qty (Verified)" type="number" value={verifData.qty_received} onChange={e => setVerifData({ ...verifData, qty_received: e.target.value })} />
                                        <input className="glass-input" placeholder="Store Room" value={verifData.store_room} onChange={e => setVerifData({ ...verifData, store_room: e.target.value })} />
                                        <input className="glass-input" placeholder="Rack Number" value={verifData.rack_no} onChange={e => setVerifData({ ...verifData, rack_no: e.target.value })} />
                                        <input className="glass-input" placeholder="Shelf / Bin" value={verifData.shelf_no} onChange={e => setVerifData({ ...verifData, shelf_no: e.target.value })} />
                                    </div>

                                    <input className="glass-input" placeholder="Remarks" value={verifData.remarks} onChange={e => setVerifData({ ...verifData, remarks: e.target.value })} style={{ gridColumn: '1/-1', marginTop: '1rem' }} />
                                </div>
                                <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                                    <button type="submit" className="btn btn-primary">Submit Verification</button>
                                    <button type="button" className="btn btn-secondary" onClick={() => setSelectedItem(null)}>Cancel</button>
                                </div>
                            </form>
                        ) : (
                            items.length === 0 ? (
                                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    No pending verifications.
                                </div>
                            ) : (
                                <table>
                                    <thead><tr><th>Gate Pass</th><th>Vendor</th><th>Desc</th><th>Action</th></tr></thead>
                                    <tbody>
                                        {items.map(item => (
                                            <tr key={item.id}>
                                                <td>{item.gate_pass_number}</td>
                                                <td>{item.vendor_name}</td>
                                                <td>{item.material_type_desc}</td>
                                                <td><button className="btn btn-primary" onClick={() => setSelectedItem(item)}>Verify</button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )
                        )}
                    </>
                )}

                {activeTab === 'inventory' && (
                    <>
                        <h3 style={{ marginBottom: '1rem' }}>Live Store Inventory</h3>
                        <StoreInventoryTable items={storeItems} userRole="STORE_MANAGER" />
                    </>
                )}

                {activeTab === 'master' && (
                    <>
                        <div style={{ marginBottom: '2rem', padding: '1.5rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                            <h4 style={{ marginTop: 0, color: 'var(--primary)' }}>ℹ️ Material Catalog (Read-Only)</h4>
                            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                                Materials are created and managed by Officers. Contact an Officer if you need to add new materials to the system.
                            </p>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0 }}>Material Catalog</h3>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <select
                                    className="glass-input"
                                    style={{ width: '200px' }}
                                    value={catalogCategoryFilter}
                                    onChange={e => setCatalogCategoryFilter(e.target.value)}
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
                                    value={catalogSearch}
                                    onChange={e => setCatalogSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        {materials.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                No materials available yet.
                            </div>
                        ) : filteredCatalog.length === 0 ? (
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
                                    {filteredCatalog.map(m => {
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
                                                    <tr>
                                                        <td colSpan="8" style={{ padding: 0, background: 'rgba(255,255,255,0.02)' }}>
                                                            <div style={{ padding: '1rem 2rem' }}>
                                                                <h5 style={{ marginTop: 0, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Variants</h5>
                                                                <table style={{ width: '100%', fontSize: '0.9rem' }}>
                                                                    <thead>
                                                                        <tr style={{ background: 'none' }}>
                                                                            <th style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>Rating</th>
                                                                            <th style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>Size</th>
                                                                            <th style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>Make</th>
                                                                            <th style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>Current Stock</th>
                                                                            <th style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>Created</th>
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
                                                                                    {new Date(v.created_at).toLocaleDateString()}
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
                )}

                {activeTab === 'issue' && (
                    <div style={{ maxWidth: '900px' }}>
                        <h3>Raise Material Issue Request</h3>

                        {/* Add Item Section */}
                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                            <h4 style={{ marginTop: 0, marginBottom: '1rem' }}>Add Items</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Filter by Category</label>
                                        <select
                                            className="glass-input"
                                            value={issueCategory}
                                            onChange={e => setIssueCategory(e.target.value)}
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
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Search Material</label>
                                        <input
                                            className="glass-input"
                                            placeholder="Name or Code..."
                                            value={materialSearch}
                                            onChange={e => setMaterialSearch(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Select Material</label>
                                    <select
                                        className="glass-input"
                                        value={currentIssueItem.material_id}
                                        onChange={e => handleIssueMaterialSelect(e.target.value)}
                                    >
                                        <option value="">-- Select Material --</option>
                                        {filteredMaterials.map(m => (
                                            <option key={m.id} value={m.id}>
                                                {m.code} - {m.name} (Stock: {m.current_stock} {m.unit})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {selectedMaterialVariants.length > 0 && (
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Select Variant (Optional)</label>
                                        <select
                                            className="glass-input"
                                            value={currentIssueItem.material_variant_id}
                                            onChange={e => setCurrentIssueItem({ ...currentIssueItem, material_variant_id: e.target.value })}
                                        >
                                            <option value="">-- No Specific Variant --</option>
                                            {selectedMaterialVariants.map(v => (
                                                <option key={v.id} value={v.id}>
                                                    {v.rating && `Rating: ${v.rating}`} {v.size && `| Size: ${v.size}`} {v.material_make && `| Make: ${v.material_make}`} (Stock: {v.current_stock})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'end' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Quantity</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
                                            <input
                                                className="glass-input"
                                                type="number"
                                                min="1"
                                                max={(() => {
                                                    const mat = materials.find(m => String(m.id) === String(currentIssueItem.material_id));
                                                    const variant = selectedMaterialVariants.find(v => String(v.id) === String(currentIssueItem.material_variant_id));
                                                    return variant ? variant.current_stock : mat?.current_stock;
                                                })()}
                                                placeholder={(() => {
                                                    const mat = materials.find(m => String(m.id) === String(currentIssueItem.material_id));
                                                    const variant = selectedMaterialVariants.find(v => String(v.id) === String(currentIssueItem.material_variant_id));
                                                    const stock = variant ? variant.current_stock : mat?.current_stock;
                                                    return stock !== undefined ? `Max: ${stock}` : "Qty";
                                                })()}
                                                value={currentIssueItem.quantity_issued}
                                                onChange={e => {
                                                    const val = parseInt(e.target.value);
                                                    const mat = materials.find(m => String(m.id) === String(currentIssueItem.material_id));
                                                    const variant = selectedMaterialVariants.find(v => String(v.id) === String(currentIssueItem.material_variant_id));
                                                    const maxStock = variant ? variant.current_stock : mat?.current_stock;

                                                    // Allow clearing the input (NaN) but check max if a number is entered
                                                    if (maxStock !== undefined && val > maxStock) {
                                                        alert(`Cannot issue more than available stock: ${maxStock}`);
                                                        return;
                                                    }
                                                    setCurrentIssueItem({ ...currentIssueItem, quantity_issued: e.target.value })
                                                }}
                                                style={{ flex: 1, paddingRight: '4rem' }}
                                            />
                                            {currentIssueItem.material_id && (
                                                <span style={{ position: 'absolute', right: '70px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', pointerEvents: 'none' }}>
                                                    / {(() => {
                                                        const mat = materials.find(m => String(m.id) === String(currentIssueItem.material_id));
                                                        const variant = selectedMaterialVariants.find(v => String(v.id) === String(currentIssueItem.material_variant_id));
                                                        return variant ? variant.current_stock : mat?.current_stock;
                                                    })()}
                                                </span>
                                            )}
                                            <span style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 600, minWidth: '40px' }}>
                                                {materials.find(m => String(m.id) === String(currentIssueItem.material_id))?.unit || ''}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddIssueItem}
                                        className="btn-primary"
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                    >
                                        <Plus size={18} /> Add Item
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Items List */}
                        {issueItems.length > 0 && (
                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                                <h4 style={{ marginTop: 0, marginBottom: '1rem' }}>Items to Issue ({issueItems.length})</h4>
                                <table style={{ width: '100%', fontSize: '0.9rem' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Material</th>
                                            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Variant</th>
                                            <th style={{ textAlign: 'right', padding: '0.5rem' }}>Quantity</th>
                                            <th style={{ textAlign: 'center', padding: '0.5rem' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {issueItems.map((item, index) => (
                                            <tr key={index} style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                                <td style={{ padding: '0.5rem' }}>
                                                    <div style={{ fontWeight: 600 }}>{item._materialCode} - {item._materialName}</div>
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.material_category}</div>
                                                </td>
                                                <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                                                    {item.rating || item.size || item.material_make ? (
                                                        <div>
                                                            {item.rating && <div>Rating: {item.rating}</div>}
                                                            {item.size && <div>Size: {item.size}</div>}
                                                            {item.material_make && <div>Make: {item.material_make}</div>}
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: 'var(--text-muted)' }}>No variant</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>
                                                    {item.quantity_issued} {item.material_unit}
                                                </td>
                                                <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveIssueItem(index)}
                                                        style={{
                                                            background: 'var(--danger)',
                                                            border: 'none',
                                                            padding: '0.4rem 0.8rem',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '0.3rem'
                                                        }}
                                                    >
                                                        <Trash2 size={14} /> Remove
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Issue Request Form */}
                        <form onSubmit={handleRequestIssue}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Dept Type</label>
                                        <select
                                            className="glass-input"
                                            required
                                            value={deptType}
                                            onChange={e => setDeptType(e.target.value)}
                                        >
                                            <option value="">Type</option>
                                            <option value="GO">GO</option>
                                            <option value="CW">CW</option>
                                            <option value="Vendor">Vendor</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Dept Name</label>
                                        <input
                                            className="glass-input"
                                            required
                                            placeholder="Name"
                                            value={deptName}
                                            onChange={e => setDeptName(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <input
                                    className="glass-input"
                                    required
                                    placeholder="Purpose"
                                    value={issueForm.purpose}
                                    onChange={e => setIssueForm({ ...issueForm, purpose: e.target.value })}
                                />

                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Select Officer</label>
                                    <select
                                        className="glass-input"
                                        required
                                        value={issueForm.officer_id}
                                        onChange={e => setIssueForm({ ...issueForm, officer_id: parseInt(e.target.value) })}
                                    >
                                        <option value="">-- Select Officer --</option>
                                        {officers.map(officer => (
                                            <option key={officer.id} value={officer.id}>
                                                {officer.username}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <button type="submit" className="btn-primary" style={{ marginTop: '1rem' }}>
                                    Send Request to Officer
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {activeTab === 'records' && (
                    <>
                        <h3 style={{ marginBottom: '1.5rem' }}>Material Issue Records</h3>
                        {loading ? (
                            <p>Loading...</p>
                        ) : issueRecords.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                No issue records found.
                            </div>
                        ) : (
                            <table>
                                <thead>
                                    <tr>
                                        <th>Issue ID</th>
                                        <th>Materials</th>
                                        <th>Purpose</th>
                                        <th>Department</th>
                                        <th>Status</th>
                                        <th>Date & Time</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {issueRecords.map(record => {
                                        const hasItems = record.items && record.items.length > 0
                                        const itemCount = hasItems ? record.items.length : (record.material_name ? 1 : 0)
                                        const isExpanded = expandedIssueRows[record.id] || false

                                        return (
                                            <React.Fragment key={record.id}>
                                                <tr>
                                                    <td>
                                                        <span className="badge badge-blue">
                                                            {record.issue_note_id || `ISS-${record.id}`}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {hasItems ? (
                                                            <div>
                                                                <div style={{ fontWeight: 600 }}>
                                                                    {itemCount} item{itemCount > 1 ? 's' : ''}
                                                                </div>
                                                                <button
                                                                    onClick={() => setExpandedIssueRows(prev => ({
                                                                        ...prev,
                                                                        [record.id]: !prev[record.id]
                                                                    }))}
                                                                    style={{
                                                                        background: 'none',
                                                                        border: 'none',
                                                                        color: 'var(--primary)',
                                                                        cursor: 'pointer',
                                                                        fontSize: '0.85rem',
                                                                        padding: '0.2rem 0',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '0.3rem'
                                                                    }}
                                                                >
                                                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                    {isExpanded ? 'Hide' : 'Show'} details
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                <div style={{ fontWeight: 600 }}>{record.material_name || 'Unknown'}</div>
                                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                                    {record.quantity_requested} {record.material_unit}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>{record.purpose}</td>
                                                    <td>{record.requesting_dept}</td>
                                                    <td>
                                                        <span className={`badge ${record.status === 'APPROVED' ? 'badge-success' : record.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                                                            {record.status}
                                                        </span>
                                                    </td>
                                                    <td>{record.created_at ? new Date(record.created_at).toLocaleString('en-IN') : '-'}</td>
                                                    <td>
                                                        {record.status === 'APPROVED' && (
                                                            <a
                                                                href={`http://localhost:8000/issue/${record.id}/receipt`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="btn btn-sm btn-success"
                                                                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', textDecoration: 'none' }}
                                                            >
                                                                Download Receipt
                                                            </a>
                                                        )}
                                                    </td>
                                                </tr>
                                                {isExpanded && hasItems && (
                                                    <tr>
                                                        <td colSpan="7" style={{ padding: 0, background: 'rgba(255,255,255,0.02)' }}>
                                                            <div style={{ padding: '1rem 2rem' }}>
                                                                <table style={{ width: '100%', fontSize: '0.9rem' }}>
                                                                    <thead>
                                                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                                                            <th style={{ textAlign: 'left', padding: '0.5rem', fontWeight: 600 }}>Material</th>
                                                                            <th style={{ textAlign: 'left', padding: '0.5rem', fontWeight: 600 }}>Variant Details</th>
                                                                            <th style={{ textAlign: 'right', padding: '0.5rem', fontWeight: 600 }}>Quantity</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {record.items.map((item, idx) => (
                                                                            <tr key={idx} style={{ borderBottom: idx < record.items.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                                                                                <td style={{ padding: '0.5rem' }}>
                                                                                    <div style={{ fontWeight: 600 }}>{item.material_description}</div>
                                                                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                                                        {item.material_category}
                                                                                    </div>
                                                                                </td>
                                                                                <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                                                                                    {item.rating || item.size || item.material_make ? (
                                                                                        <div>
                                                                                            {item.rating && <div>Rating: {item.rating}</div>}
                                                                                            {item.size && <div>Size: {item.size}</div>}
                                                                                            {item.material_make && <div>Make: {item.material_make}</div>}
                                                                                        </div>
                                                                                    ) : (
                                                                                        <span style={{ color: 'var(--text-muted)' }}>No variant</span>
                                                                                    )}
                                                                                </td>
                                                                                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600, color: 'var(--primary)' }}>
                                                                                    {item.quantity_issued} {item.material_unit}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </>
                )}
            </div>
        </DashboardLayout>
    )
}

export default StoreDashboard
