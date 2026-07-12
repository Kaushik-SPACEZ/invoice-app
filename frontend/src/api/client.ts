import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
})

// Read token directly from Zustand store (single source of truth, no desync)
client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`

  // Only set JSON content-type when NOT sending FormData
  // FormData must NOT have Content-Type set — browser sets it automatically with the multipart boundary
  if (!(config.data instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json'
  }

  return config
})

// 401 → call proper logout (clears Zustand state) then redirect
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default client
