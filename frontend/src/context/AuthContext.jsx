import { createContext, useState, useEffect, useContext } from 'react'
import { jwtDecode } from 'jwt-decode'
import axios from 'axios'
import api from '../api/axios'

const AuthContext = createContext()

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('token')
            if (token) {
                try {
                    const decoded = jwtDecode(token)
                    // Ideally fetch user details from backend to be sure
                    // But for now, trust the token or fetch /users/me
                    const res = await api.get('/users/me')
                    setUser(res.data)
                } catch (error) {
                    console.error("Auth Check Failed", error)
                    localStorage.removeItem('token')
                    setUser(null)
                }
            }
            setLoading(false)
        }
        checkAuth()
    }, [])

    const login = async (username, password) => {
        const params = new URLSearchParams()
        params.append('username', username)
        params.append('password', password)

        const res = await api.post('/token', params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        })


        const { access_token } = res.data
        localStorage.setItem('token', access_token)

        // Fetch user details immediately
        const userRes = await api.get('/users/me')
        setUser(userRes.data)
        return userRes.data
    }

    const logout = () => {
        localStorage.removeItem('token')
        setUser(null)
    }

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    )
}
