import axios from 'axios'

/** Base URL: same-origin "/api" by default, or VITE_API_URL for a separate API host. */
export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') || '/api'

export const http = axios.create({ baseURL: API_URL, withCredentials: true })

// The access token lives in memory only (never in localStorage -> no XSS theft);
// the refresh token is an httpOnly cookie managed by the server.
let accessToken = null
let onAuthLost = () => {}

export const setAccessToken = (token) => {
  accessToken = token
}
export const getAccessToken = () => accessToken
export const setAuthLostHandler = (fn) => {
  onAuthLost = fn
}

http.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

let refreshing = null
async function refreshSession() {
  if (!refreshing) {
    refreshing = axios
      .post(`${API_URL}/auth/refresh`, null, { withCredentials: true })
      .then((res) => {
        accessToken = res.data.accessToken
        return res.data
      })
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

http.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error
    const isAuthCall = config?.url?.startsWith('/auth/')
    if (response?.status === 401 && config && !config._retried && !isAuthCall && accessToken) {
      config._retried = true
      try {
        await refreshSession()
        config.headers.Authorization = `Bearer ${accessToken}`
        return http(config)
      } catch {
        accessToken = null
        onAuthLost()
      }
    }
    return Promise.reject(error)
  },
)

export { refreshSession }

/** Extracts a human-readable message from an API error. */
export function errorMessage(error, fallback = 'Что-то пошло не так') {
  const data = error?.response?.data?.error
  if (data?.details && Array.isArray(data.details) && data.details.length) {
    return data.details.map((d) => d.message).join('; ')
  }
  if (data?.message) return data.message
  if (error?.code === 'ERR_NETWORK') return 'Нет связи с сервером'
  return fallback
}

export const authApi = {
  register: (body) => http.post('/auth/register', body).then((r) => r.data),
  login: (body) => http.post('/auth/login', body).then((r) => r.data),
  logout: () => http.post('/auth/logout').then((r) => r.data),
}

export const quizApi = {
  list: (params) => http.get('/quizzes', { params }).then((r) => r.data),
  stats: () => http.get('/quizzes/stats').then((r) => r.data),
  categories: () => http.get('/quizzes/categories').then((r) => r.data.items),
}
