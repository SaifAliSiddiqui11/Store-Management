import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ProtectedRoute = ({ children, roles }) => {
    const { user } = useAuth()

    if (!user) {
        return <Navigate to="/login" replace />
    }

    if (roles && !roles.includes(user.role)) {
        // Redirect to their appropriate dashboard if unauthorized for this specific route
        return <Navigate to="/dashboard" replace />
    }

    return children
}

export default ProtectedRoute
