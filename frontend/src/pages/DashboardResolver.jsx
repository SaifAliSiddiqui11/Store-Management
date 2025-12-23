import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const DashboardResolver = () => {
    const { user } = useAuth()
    const navigate = useNavigate()

    useEffect(() => {
        if (user) {
            switch (user.role) {
                case 'SECURITY':
                    navigate('/security/new-entry')
                    break
                case 'OFFICER':
                    navigate('/officer/approvals')
                    break
                case 'STORE_MANAGER':
                    navigate('/store/pending')
                    break
                case 'ADMIN':
                    // Admin sees everything, maybe default to officer view
                    navigate('/officer/approvals')
                    break
                default:
                    navigate('/login')
            }
        }
    }, [user, navigate])

    return <div className="container">Redirecting...</div>
}

export default DashboardResolver
