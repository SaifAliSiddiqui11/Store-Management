import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/token': { target: 'http://127.0.0.1:8000', changeOrigin: true },
            '/users': { target: 'http://127.0.0.1:8000', changeOrigin: true },
            '/admin': { target: 'http://127.0.0.1:8000', changeOrigin: true },
            '/officers': { target: 'http://127.0.0.1:8000', changeOrigin: true },
            '/gate-entry': { target: 'http://127.0.0.1:8000', changeOrigin: true },
            '/officer': { target: 'http://127.0.0.1:8000', changeOrigin: true },
            '/store': { target: 'http://127.0.0.1:8000', changeOrigin: true },
            '/issue': { target: 'http://127.0.0.1:8000', changeOrigin: true },
            '/materials': { target: 'http://127.0.0.1:8000', changeOrigin: true },
        }
    }
})
