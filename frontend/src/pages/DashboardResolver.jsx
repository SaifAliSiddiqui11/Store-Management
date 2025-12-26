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
                    navigate('/officer')
                    break
                case 'STORE_MANAGER':
                    navigate('/store')
                    break
                case 'ADMIN':
                    navigate('/admin')
                    break
                default:
                    navigate('/login')
            }
        }
    }, [user, navigate])

    return <div className="container">Redirecting...</div>
}

export default DashboardResolver
