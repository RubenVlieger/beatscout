import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auth API
export const authApi = {
  login: () => {
    window.location.href = `${API_URL}/api/auth/soundcloud/login`
  },
  
  logout: async () => {
    localStorage.removeItem('token')
    return api.post('/auth/logout')
  },
  
  getMe: async () => {
    return api.get('/auth/me')
  },
}

// Tracks API
export const tracksApi = {
  search: async (params: { query: string; min_bpm?: number; max_bpm?: number }) => {
    return api.get('/tracks/search', { params })
  },
  
  getById: async (id: string) => {
    return api.get(`/tracks/${id}`)
  },
  
  addToCrate: async (id: string) => {
    return api.post(`/tracks/${id}/add-to-crate`)
  },
  
  getMyCrate: async () => {
    return api.get('/tracks/crate/my')
  },
}

// Analysis API
export const analysisApi = {
  request: async (data: { track_name: string; artist_name?: string }) => {
    return api.post('/analysis/request', data)
  },
  
  getStatus: async (id: string) => {
    return api.get(`/analysis/status/${id}`)
  },
  
  getResults: async (id: string) => {
    return api.get(`/analysis/results/${id}`)
  },
}

// Explorer API
export const explorerApi = {
  getExampleData: async () => {
    return api.get('/explorer/example')
  },
}

export default api
