import axios from 'axios'

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/', // Use env var or fallback to proxy
    headers: {
        'Content-Type': 'application/json',
    },
})

// Add a request interceptor
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token')
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    },
    (error) => {
        return Promise.reject(error)
    }
)

export default api
