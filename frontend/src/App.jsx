import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import DashboardResolver from './pages/DashboardResolver'
import SecurityDashboard from './pages/SecurityDashboard'
import OfficerDashboard from './pages/OfficerDashboard'
import StoreDashboard from './pages/StoreDashboard'
import AdminDashboard from './pages/AdminDashboard'
import MaterialInwardReport from './pages/MaterialInwardReport'
import InventoryReport from './pages/InventoryReport'
import MaterialIssueReport from './pages/MaterialIssueReport'
import Returnables from './pages/Returnables'
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

                <Route path="/returnables" element={
                    <ProtectedRoute>
                        <Returnables />
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

                <Route path="/admin/*" element={
                    <ProtectedRoute roles={['ADMIN']}>
                        <AdminDashboard />
                    </ProtectedRoute>
                } />

                <Route path="/reports/material-inward" element={
                    <ProtectedRoute roles={['OFFICER', 'ADMIN']}>
                        <MaterialInwardReport />
                    </ProtectedRoute>
                } />

                <Route path="/reports/inventory" element={
                    <ProtectedRoute roles={['OFFICER', 'ADMIN', 'STORE_MANAGER']}>
                        <InventoryReport />
                    </ProtectedRoute>
                } />

                <Route path="/reports/material-issue" element={
                    <ProtectedRoute roles={['OFFICER', 'ADMIN', 'STORE_MANAGER']}>
                        <MaterialIssueReport />
                    </ProtectedRoute>
                } />

            </Routes>
        </BrowserRouter>
    )
}

export default App
