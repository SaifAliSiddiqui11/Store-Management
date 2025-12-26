import { useState, useEffect } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import api from '../api/axios'
import StoreInventoryTable from '../components/StoreInventoryTable'

const StoreDashboard = () => {
    const [activeTab, setActiveTab] = useState('verification') // verification, inventory, issue
    const [items, setItems] = useState([]) // For pending verification
    const [materials, setMaterials] = useState([]) // For inventory
    const [storeItems, setStoreItems] = useState([]) // For live inventory
    const [loading, setLoading] = useState(false)
    const [selectedItem, setSelectedItem] = useState(null) // For verification modal/form

    // Form states
    const [verifData, setVerifData] = useState({
        invoice_no: '',
        invoice_date: '', // text for simplicity or date input
        remarks: '',
        qty_received: '',
        store_room: 'A',
        material_id: '' // Need to select material too!
    })

    const [materialForm, setMaterialForm] = useState({
        code: '', name: '', description: '', category: 'CONSUMABLE', unit: 'Nos', min_stock_level: 10
    })

    const [issueForm, setIssueForm] = useState({
        material_id: '', quantity_requested: '', purpose: '', requesting_dept: ''
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

    useEffect(() => {
        if (activeTab === 'verification') fetchPending()
        if (activeTab === 'inventory') {
            fetchMaterials()
            fetchStoreItems()
        }
        if (activeTab === 'issue') fetchMaterials()
    }, [activeTab])

    const handleVerifySubmit = async (e) => {
        e.preventDefault()
        if (!selectedItem) return

        try {
            const payload = {
                invoice_no: verifData.invoice_no,
                invoice_date: new Date().toISOString(), // Simplified date
                remarks: verifData.remarks,
                items: [
                    {
                        material_id: parseInt(verifData.material_id),
                        quantity_received: parseInt(verifData.qty_received),
                        store_room: verifData.store_room,
                        rack_no: 'A1',
                        shelf_no: 'S1'
                    }
                ]
            }
            await api.post(`/store/${selectedItem.id}/process`, payload)
            setSelectedItem(null)
            fetchPending()
        } catch (e) { alert("Verification Failed") }
    }

    const handleCreateMaterial = async (e) => {
        e.preventDefault()
        try {
            await api.post('/materials', materialForm)
            alert("Material Created")
            fetchMaterials()
            setMaterialForm({ code: '', name: '', description: '', category: 'CONSUMABLE', unit: 'Nos', min_stock_level: 10 })
        } catch (e) { alert("Failed") }
    }

    const handleRequestIssue = async (e) => {
        e.preventDefault()
        try {
            await api.post('/issue/request', issueForm)
            alert("Issue Requested")
            setIssueForm({ material_id: '', quantity_requested: '', purpose: '', requesting_dept: '' })
        } catch (e) { alert("Failed") }
    }

    const TabButton = ({ id, label }) => (
        <button onClick={() => setActiveTab(id)} style={{
            background: activeTab === id ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
            color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600
        }}>{label}</button>
    )

    return (
        <DashboardLayout title="Role: Store Manager">
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                <TabButton id="verification" label="Pending Verification" />
                <TabButton id="inventory" label="Inventory & Master" />
                <TabButton id="issue" label="Raise Issue" />
            </div>

            <div className="glass-panel" style={{ padding: '2rem' }}>
                {activeTab === 'verification' && (
                    <>
                        {selectedItem ? (
                            <form onSubmit={handleVerifySubmit}>
                                <h3>Verify Entry: {selectedItem.gate_pass_number}</h3>
                                <p>Vendor: {selectedItem.vendor_name} | Item: {selectedItem.material_type_desc}</p>

                                <div className="dashboard-grid" style={{ marginTop: '1rem' }}>
                                    <input className="glass-input" required placeholder="Invoice No" value={verifData.invoice_no} onChange={e => setVerifData({ ...verifData, invoice_no: e.target.value })} />
                                    <input className="glass-input" required placeholder="Qty Received (Verified)" type="number" value={verifData.qty_received} onChange={e => setVerifData({ ...verifData, qty_received: e.target.value })} />
                                    <input className="glass-input" placeholder="Store Room" value={verifData.store_room} onChange={e => setVerifData({ ...verifData, store_room: e.target.value })} />

                                    <select className="glass-input" value={verifData.material_id} onChange={e => setVerifData({ ...verifData, material_id: e.target.value })} onClick={() => { if (materials.length === 0) fetchMaterials() }}>
                                        <option value="">Select Official Material Code</option>
                                        {materials.map(m => <option key={m.id} value={m.id}>{m.code} - {m.name}</option>)}
                                    </select>

                                    <input className="glass-input" placeholder="Remarks" value={verifData.remarks} onChange={e => setVerifData({ ...verifData, remarks: e.target.value })} style={{ gridColumn: '1/-1' }} />
                                </div>
                                <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                                    <button type="submit" className="btn btn-primary">Submit Verification</button>
                                    <button type="button" className="btn btn-secondary" onClick={() => setSelectedItem(null)}>Cancel</button>
                                </div>
                            </form>
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
                        )}
                    </>
                )}

                {activeTab === 'inventory' && (
                    <>
                        <div style={{ marginBottom: '2rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                            <h4>Add New Material Master</h4>
                            <form onSubmit={handleCreateMaterial} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <input className="glass-input" style={{ flex: 1 }} placeholder="Code (e.g. M001)" value={materialForm.code} onChange={e => setMaterialForm({ ...materialForm, code: e.target.value })} />
                                <input className="glass-input" style={{ flex: 2 }} placeholder="Name" value={materialForm.name} onChange={e => setMaterialForm({ ...materialForm, name: e.target.value })} />
                                <button className="btn btn-success" type="submit">Create</button>
                            </form>
                        </div>

                        <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Live Store Inventory</h3>
                        <StoreInventoryTable items={storeItems} userRole="STORE_MANAGER" />

                        <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Material Master List</h3>
                        <table>
                            <thead><tr><th>Code</th><th>Name</th><th>Total Stock</th><th>Unit</th></tr></thead>
                            <tbody>
                                {materials.map(m => (
                                    <tr key={m.id}><td>{m.code}</td><td>{m.name}</td><td style={{ fontWeight: 'bold', color: 'var(--success)' }}>{m.current_stock}</td><td>{m.unit}</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </>
                )}

                {activeTab === 'issue' && (
                    <form onSubmit={handleRequestIssue} style={{ maxWidth: '600px' }}>
                        <h3>Raise Material Issue Request</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <select className="glass-input" required value={issueForm.material_id} onChange={e => setIssueForm({ ...issueForm, material_id: e.target.value })}>
                                <option value="">Select Material</option>
                                <option value="">Select Material</option>
                                {materials.map(m => <option key={m.id} value={m.id}>{m.name} (Stock: {m.current_stock})</option>)}
                            </select>
                            <input className="glass-input" type="number" required placeholder="Quantity Required" value={issueForm.quantity_requested} onChange={e => setIssueForm({ ...issueForm, quantity_requested: e.target.value })} />
                            <input className="glass-input" required placeholder="Requesting Dept" value={issueForm.requesting_dept} onChange={e => setIssueForm({ ...issueForm, requesting_dept: e.target.value })} />
                            <input className="glass-input" required placeholder="Purpose" value={issueForm.purpose} onChange={e => setIssueForm({ ...issueForm, purpose: e.target.value })} />
                            <button className="btn btn-primary">Send to Officer</button>
                        </div>
                    </form>
                )}
            </div>
        </DashboardLayout>
    )
}

export default StoreDashboard
