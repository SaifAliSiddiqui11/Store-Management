import { useState, useEffect } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import api from '../api/axios'
import { UserPlus, Users, Shield } from 'lucide-react'

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('create') // create, users
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        role: 'OFFICER'
    })
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(null)

    const fetchUsers = async () => {
        // This would need a new endpoint to list all users
        // For now just fetching officers as demo
        try {
            const res = await api.get('/officers')
            setUsers(res.data)
        } catch (e) {
            console.error(e)
        }
    }

    useEffect(() => {
        if (activeTab === 'users') {
            fetchUsers()
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
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                <TabButton id="create" label="Create User" />
                <TabButton id="users" label="View Users" />
            </div>

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
                            Active Officers
                        </h2>

                        <table>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Username</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Status</th>
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
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </>
                )}
            </div>
        </DashboardLayout>
    )
}

export default AdminDashboard
