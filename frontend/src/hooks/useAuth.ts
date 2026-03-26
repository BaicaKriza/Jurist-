import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/store/authStore'

export function useAuth() {
  const { user, isAuthenticated, isLoading, login, logout, loadUser } = useAuthStore()
  const initialized = useRef(false)

  // On first mount: if we have a token but no user, validate token silently
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    const token = localStorage.getItem('access_token')
    if (token && !user) {
      loadUser()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { user, isAuthenticated, isLoading, login, logout }
}
