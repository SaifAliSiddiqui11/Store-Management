import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import DashboardResolver from './pages/DashboardResolver'
import SecurityDashboard from './pages/SecurityDashboard'
import OfficerDashboard from './pages/OfficerDashboard'
import StoreDashboard from './pages/StoreDashboard'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />

                <Route path="/" element={<Navigate to="/dashboard" replace />} />

                <Route path="/dashboard" element={
                    <ProtectedRoute>
                        <DashboardResolver />
                    </ProtectedRoute>
                } />

                {/* Role Specific Routes */}
                <Route path="/security/*" element={
                    <ProtectedRoute roles={['SECURITY', 'ADMIN']}>
                        <SecurityDashboard />
                    </ProtectedRoute>
                } />

                <Route path="/officer/*" element={
                    <ProtectedRoute roles={['OFFICER', 'ADMIN']}>
                        <OfficerDashboard />
                    </ProtectedRoute>
                } />

                <Route path="/store/*" element={
                    <ProtectedRoute roles={['STORE_MANAGER', 'ADMIN']}>
                        <StoreDashboard />
                    </ProtectedRoute>
                } />

            </Routes>
        </BrowserRouter>
    )
}

export default App
