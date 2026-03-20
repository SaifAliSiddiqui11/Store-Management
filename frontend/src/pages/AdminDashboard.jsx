import { useState, useEffect } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import api from '../api/axios'
import { UserPlus, Users, Shield, Package, Pencil, X, Check } from 'lucide-react'

const CATEGORIES = [
    { value: 'CONSUMABLE', label: 'Consumable' },
    { value: 'SPARE', label: 'Spare' },
    { value: 'ASSET', label: 'Asset' },
    { value: 'FIRE_AND_SAFETY', label: 'Fire and Safety' },
    { value: 'AUTOMATION', label: 'Automation' },
    { value: 'ELECTRICAL', label: 'Electrical' },
    { value: 'MECHANICAL', label: 'Mechanical' },
    { value: 'CHEMICALS', label: 'Chemicals' },
    { value: 'OILS_AND_LUBRICANTS', label: 'Oils and Lubricants' },
    { value: 'STATIONARY', label: 'Stationary' },
]

const UNITS = ['Nos', 'Kg', 'Ltr', 'Mtr', 'Box', 'Set', 'Roll']

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('create') // create, users, materials
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        role: 'OFFICER'
    })
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(null)

    // Material Management state
    const [materials, setMaterials] = useState([])
    const [materialSearch, setMaterialSearch] = useState('')
    const [materialCategoryFilter, setMaterialCategoryFilter] = useState('')
    const [editingMaterialId, setEditingMaterialId] = useState(null)
    const [editMaterialForm, setEditMaterialForm] = useState({})
    const [savingMaterial, setSavingMaterial] = useState(false)

    const fetchUsers = async () => {
        try {
            const res = await api.get('/admin/users')
            setUsers(res.data)
        } catch (e) {
            console.error(e)
        }
    }

    const fetchMaterials = async () => {
        setLoading(true)
        try {
            const res = await api.get('/materials')
            setMaterials(res.data)
        } catch (e) {
            console.error('Failed to fetch materials:', e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (activeTab === 'users') {
            fetchUsers()
        } else if (activeTab === 'materials') {
            fetchMaterials()
        }
    }, [activeTab])

    const handleCreateUser = async (e) => {
        e.preventDefault()
        setLoading(true)
        setSuccess(null)
        try {
            await api.post('/admin/users', formData)
            setSuccess(`User ${formData.username} created successfully!`)
            setFormData({
                username: '',
                email: '',
                password: '',
                role: 'OFFICER'
            })
            if (activeTab === 'users') fetchUsers()
        } catch (error) {
            alert(error.response?.data?.detail || 'Failed to create user')
        } finally {
            setLoading(false)
        }
    }

    // Material edit handlers
    const startEditMaterial = (material) => {
        setEditingMaterialId(material.id)
        setEditMaterialForm({
            code: material.code,
            name: material.name,
            description: material.description || '',
            category: material.category,
            unit: material.unit,
            min_stock_level: material.min_stock_level
        })
    }

    const cancelEditMaterial = () => {
        setEditingMaterialId(null)
        setEditMaterialForm({})
    }

    const saveEditMaterial = async () => {
        setSavingMaterial(true)
        try {
            await api.put(`/admin/materials/${editingMaterialId}`, editMaterialForm)
            setEditingMaterialId(null)
            setEditMaterialForm({})
            fetchMaterials()
        } catch (error) {
            alert(error.response?.data?.detail || 'Failed to update material')
        } finally {
            setSavingMaterial(false)
        }
    }

    // Filter materials
    const filteredMaterials = materials.filter(m => {
        const matchesCategory = !materialCategoryFilter || m.category === materialCategoryFilter
        const matchesSearch = !materialSearch ||
            m.name.toLowerCase().includes(materialSearch.toLowerCase()) ||
            m.code.toLowerCase().includes(materialSearch.toLowerCase())
        return matchesCategory && matchesSearch
    })

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
        <DashboardLayout title="Role: Admin">
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                <TabButton id="create" label="Create User" />
                <TabButton id="users" label="View Users" />
                <TabButton id="materials" label="Material Management" />
            </div>

            {activeTab === 'materials' ? (
                <div className="glass-panel" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Package size={24} />
                            Material Master List
                        </h2>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <select
                                className="glass-input"
                                style={{ width: '200px' }}
                                value={materialCategoryFilter}
                                onChange={e => setMaterialCategoryFilter(e.target.value)}
                            >
                                <option value="">All Categories</option>
                                {CATEGORIES.map(c => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                            <input
                                className="glass-input"
                                placeholder="Search Name or Code..."
                                style={{ width: '250px' }}
                                value={materialSearch}
                                onChange={e => setMaterialSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    {loading ? (
                        <p>Loading...</p>
                    ) : materials.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No materials found.
                        </div>
                    ) : filteredMaterials.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No materials match your search.
                        </div>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Code</th>
                                    <th>Name</th>
                                    <th>Category</th>
                                    <th>Unit</th>
                                    <th>Min Stock</th>
                                    <th>Current Stock</th>
                                    <th>Stock Deviation</th>
                                    <th style={{ width: '120px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredMaterials.map(m => {
                                    const deviation = m.min_stock_level > 0
                                        ? ((m.current_stock - m.min_stock_level) / m.min_stock_level) * 100
                                        : 0
                                    const deviationColor = deviation >= 0 ? 'var(--success)' : 'var(--danger)'
                                    const isEditing = editingMaterialId === m.id

                                    if (isEditing) {
                                        return (
                                            <tr key={m.id} style={{ background: 'rgba(100,100,255,0.08)' }}>
                                                <td>
                                                    <input
                                                        className="glass-input"
                                                        style={{ width: '90px', padding: '0.4rem' }}
                                                        value={editMaterialForm.code}
                                                        onChange={e => setEditMaterialForm({ ...editMaterialForm, code: e.target.value })}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        className="glass-input"
                                                        style={{ width: '120px', padding: '0.4rem' }}
                                                        value={editMaterialForm.name}
                                                        onChange={e => setEditMaterialForm({ ...editMaterialForm, name: e.target.value })}
                                                    />
                                                </td>
                                                <td>
                                                    <select
                                                        className="glass-input"
                                                        style={{ padding: '0.4rem' }}
                                                        value={editMaterialForm.category}
                                                        onChange={e => setEditMaterialForm({ ...editMaterialForm, category: e.target.value })}
                                                    >
                                                        {CATEGORIES.map(c => (
                                                            <option key={c.value} value={c.value}>{c.label}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td>
                                                    <select
                                                        className="glass-input"
                                                        style={{ width: '80px', padding: '0.4rem' }}
                                                        value={editMaterialForm.unit}
                                                        onChange={e => setEditMaterialForm({ ...editMaterialForm, unit: e.target.value })}
                                                    >
                                                        {UNITS.map(u => (
                                                            <option key={u} value={u}>{u}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td>
                                                    <input
                                                        className="glass-input"
                                                        type="number"
                                                        min="0"
                                                        style={{ width: '70px', padding: '0.4rem' }}
                                                        value={editMaterialForm.min_stock_level}
                                                        onChange={e => setEditMaterialForm({ ...editMaterialForm, min_stock_level: parseInt(e.target.value) || 0 })}
                                                    />
                                                </td>
                                                <td style={{
                                                    fontWeight: 'bold',
                                                    color: m.current_stock < m.min_stock_level ? 'var(--danger)' : 'var(--success)'
                                                }}>
                                                    {m.current_stock}
                                                </td>
                                                <td style={{ fontWeight: 'bold', color: deviationColor }}>
                                                    {deviation > 0 ? '+' : ''}{deviation.toFixed(1)}%
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button
                                                            onClick={saveEditMaterial}
                                                            disabled={savingMaterial}
                                                            title="Save"
                                                            style={{
                                                                background: 'var(--success)',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                padding: '0.4rem 0.6rem',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center'
                                                            }}
                                                        >
                                                            <Check size={16} />
                                                        </button>
                                                        <button
                                                            onClick={cancelEditMaterial}
                                                            title="Cancel"
                                                            style={{
                                                                background: 'var(--danger)',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                padding: '0.4rem 0.6rem',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center'
                                                            }}
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    }

                                    return (
                                        <tr key={m.id}>
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
                                            <td>
                                                <button
                                                    onClick={() => startEditMaterial(m)}
                                                    title="Edit Material"
                                                    style={{
                                                        background: 'var(--primary)',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        padding: '0.4rem 0.8rem',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.3rem',
                                                        fontSize: '0.85rem'
                                                    }}
                                                >
                                                    <Pencil size={14} />
                                                    Edit
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            ) : (
                <div className="glass-panel" style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
                    {activeTab === 'create' && (
                        <>
                            <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <UserPlus size={24} />
                                Create New User
                            </h2>

                            {success && (
                                <div className="badge badge-success" style={{ padding: '1rem', width: '100%', marginBottom: '1.5rem', textAlign: 'center' }}>
                                    {success}
                                </div>
                            )}

                            <form onSubmit={handleCreateUser} className="dashboard-grid">
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Username</label>
                                    <input
                                        required
                                        className="glass-input"
                                        value={formData.username}
                                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                                        placeholder="Enter username"
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Email</label>
                                    <input
                                        required
                                        type="email"
                                        className="glass-input"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="user@example.com"
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Password</label>
                                    <input
                                        required
                                        type="password"
                                        className="glass-input"
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        placeholder="Set password"
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Role</label>
                                    <select
                                        className="glass-input"
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                                    >
                                        <option value="OFFICER">Officer</option>
                                        <option value="SECURITY">Security Guard</option>
                                        <option value="STORE_MANAGER">Store Manager</option>
                                        <option value="ADMIN">Admin</option>
                                    </select>
                                </div>

                                <div style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
                                    <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
                                        {loading ? 'Creating...' : 'Create User'}
                                    </button>
                                </div>
                            </form>
                        </>
                    )}

                    {activeTab === 'users' && (
                        <>
                            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Users size={24} />
                                All Users
                            </h2>

                            <table>
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Username</th>
                                        <th>Email</th>
                                        <th>Role</th>
                                        <th>Status</th>
                                        <th style={{ width: '200px' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(user => (
                                        <tr key={user.id}>
                                            <td><span className="badge badge-blue">{user.id}</span></td>
                                            <td>{user.username}</td>
                                            <td>{user.email || 'N/A'}</td>
                                            <td>
                                                <span className="badge" style={{ background: 'var(--accent)' }}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`badge ${user.is_active ? 'badge-success' : 'badge-danger'}`}>
                                                    {user.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button
                                                        onClick={async () => {
                                                            if (confirm(`Are you sure you want to ${user.is_active ? 'deactivate' : 'activate'} this user?`)) {
                                                                try {
                                                                    await api.put(`/admin/users/${user.id}/status`, { is_active: !user.is_active });
                                                                    fetchUsers();
                                                                    alert(`User successfully ${user.is_active ? 'deactivated' : 'activated'}.`);
                                                                } catch (error) {
                                                                    alert(error.response?.data?.detail || 'Failed to update user status');
                                                                }
                                                            }
                                                        }}
                                                        style={{
                                                            background: user.is_active ? 'var(--danger)' : 'var(--success)',
                                                            color: 'white', border: 'none', borderRadius: '4px',
                                                            padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem'
                                                        }}
                                                    >
                                                        {user.is_active ? 'Deactivate' : 'Activate'}
                                                    </button>
                                                    {user.role !== 'OFFICER' && (
                                                        <button
                                                            onClick={async () => {
                                                                const newPassword = prompt(`Enter new password for ${user.username}:`);
                                                                if (newPassword) {
                                                                    if (newPassword.length < 6) {
                                                                        alert('Password must be at least 6 characters long.');
                                                                        return;
                                                                    }
                                                                    try {
                                                                        await api.put(`/admin/users/${user.id}/password`, { new_password: newPassword });
                                                                        alert('Password updated successfully!');
                                                                    } catch (error) {
                                                                        alert(error.response?.data?.detail || 'Failed to update password');
                                                                    }
                                                                }
                                                            }}
                                                            style={{
                                                                background: 'var(--primary)',
                                                                color: 'white', border: 'none', borderRadius: '4px',
                                                                padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem'
                                                            }}
                                                        >
                                                            Change Pwd
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}
                </div>
            )}
        </DashboardLayout>
    )
}

export default AdminDashboard
