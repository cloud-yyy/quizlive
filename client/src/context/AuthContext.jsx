import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authApi, refreshSession, setAccessToken, setAuthLostHandler } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore the session from the httpOnly refresh cookie on first load.
  useEffect(() => {
    let cancelled = false
    refreshSession()
      .then((data) => !cancelled && setUser(data.user))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false))
    setAuthLostHandler(() => setUser(null))
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email, password) => {
    const data = await authApi.login({ email, password })
    setAccessToken(data.accessToken)
    setUser(data.user)
    return data.user
  }, [])

  const register = useCallback(
    async (email, password, nickname) => {
      await authApi.register({ email, password, ...(nickname ? { nickname } : {}) })
      return login(email, password)
    },
    [login],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setAccessToken(null)
      setUser(null)
    }
  }, [])

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
