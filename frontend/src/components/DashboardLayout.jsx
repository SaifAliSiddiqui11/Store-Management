import { useAuth } from '../context/AuthContext'
import { LogOut, Home, Key, Shield, AlertTriangle, FileText, Layers, FileBarChart2, RefreshCw } from 'lucide-react'
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
                maxHeight: '100vh',
                height: '100vh',
                top: 0,
                left: 0,
                boxSizing: 'border-box',
                overflowY: 'auto'
            }}>
                <h2 className="page-title" style={{ fontSize: '1.5rem', marginBottom: '2rem', flexShrink: 0 }}>My BPCL Store</h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: '1 1 auto', minHeight: 0, overflow: 'auto' }}>
                    <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div className={`badge ${user.role === 'SECURITY' ? 'badge-blue' : user.role === 'OFFICER' ? 'badge-warning' : 'badge-success'}`}>
                            {user.role}
                        </div>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{user.username}</span>
                    </div>

                    <button 
                        onClick={() => navigate('/dashboard')} 
                        className="btn" 
                        style={{ justifyContent: 'flex-start', background: 'transparent', border: 'none', color: 'white', display: 'flex', gap: '0.75rem', padding: '0.75rem' }}
                    >
                        <Home size={18} /> Dashboard
                    </button>

                    <button 
                        onClick={() => navigate('/returnables')} 
                        className="btn" 
                        style={{ justifyContent: 'flex-start', background: 'transparent', border: 'none', color: 'white', display: 'flex', gap: '0.75rem', padding: '0.75rem' }}
                    >
                        <RefreshCw size={18} /> Returnables
                    </button>

                    {(user.role === 'OFFICER' || user.role === 'ADMIN') && (
                        <button 
                            onClick={() => navigate('/reports/material-inward')} 
                            className="btn" 
                            style={{ justifyContent: 'flex-start', background: 'transparent', border: 'none', color: 'white', display: 'flex', gap: '0.75rem', padding: '0.75rem' }}
                        >
                            <FileText size={18} /> Inward Report
                        </button>
                    )
                    }

                    {(user.role === 'OFFICER' || user.role === 'ADMIN' || user.role === 'STORE_MANAGER') && (
                        <button 
                            onClick={() => navigate('/reports/inventory')} 
                            className="btn" 
                            style={{ justifyContent: 'flex-start', background: 'transparent', border: 'none', color: 'white', display: 'flex', gap: '0.75rem', padding: '0.75rem' }}
                        >
                            <Layers size={18} /> Inventory Report
                        </button>
                    )
                    }

                    {(user.role === 'OFFICER' || user.role === 'ADMIN' || user.role === 'STORE_MANAGER') && (
                        <button 
                            onClick={() => navigate('/reports/material-issue')} 
                            className="btn" 
                            style={{ justifyContent: 'flex-start', background: 'transparent', border: 'none', color: 'white', display: 'flex', gap: '0.75rem', padding: '0.75rem' }}
                        >
                            <FileBarChart2 size={18} /> Issue Report
                        </button>
                    )
                    }
                </div>

                <button onClick={handleLogout} className="btn btn-secondary" style={{ marginTop: '1rem', width: '100%', flexShrink: 0 }}>
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
