import { useAuth } from '../context/AuthContext'
import { LogOut, Home, Key, Shield, AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const DashboardLayout = ({ children, title }) => {
    const { user, logout } = useAuth()
    const navigate = useNavigate()

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            {/* Sidebar */}
            <div className="glass-panel" style={{
                width: '260px',
                borderRadius: '0',
                borderLeft: 'none',
                borderTop: 'none',
                borderBottom: 'none',
                display: 'flex',
                flexDirection: 'column',
                padding: '1.5rem',
                position: 'fixed',
                height: '100vh'
            }}>
                <h2 className="page-title" style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>SafeStore</h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                    <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div className={`badge ${user.role === 'SECURITY' ? 'badge-blue' : user.role === 'OFFICER' ? 'badge-warning' : 'badge-success'}`}>
                            {user.role}
                        </div>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{user.username}</span>
                    </div>
                </div>

                <button onClick={handleLogout} className="btn btn-secondary" style={{ marginTop: 'auto', width: '100%' }}>
                    <LogOut size={18} /> Sign Out
                </button>
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, marginLeft: '260px', padding: '2rem' }}>
                <header className="page-header glass-panel" style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>{title}</h1>
                    <span className="badge badge-blue">System Online</span>
                </header>

                <main>
                    {children}
                </main>
            </div>
        </div>
    )
}

export default DashboardLayout
