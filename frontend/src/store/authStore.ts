import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'
import api from '@/lib/api'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  setUser: (user: User) => void
  loadUser: () => Promise<void>
}

function mapProfileToUser(profile: any): User {
  return {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    role: profile.is_superadmin
      ? 'admin'
      : profile.roles?.includes('manager')
      ? 'manager'
      : 'viewer',
    is_active: profile.is_active,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true })
        try {
          // Backend LoginRequest expects JSON
          const { data: tokenData } = await api.post('/auth/login', { email, password })
          const { access_token } = tokenData

          localStorage.setItem('access_token', access_token)

          // Fetch user profile after getting token
          const { data: profile } = await api.get('/auth/me', {
            headers: { Authorization: `Bearer ${access_token}` },
          })

          set({
            token: access_token,
            user: mapProfileToUser(profile),
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      logout: () => {
        localStorage.removeItem('access_token')
        set({ user: null, token: null, isAuthenticated: false })
      },

      setUser: (user: User) => {
        set({ user })
      },

      loadUser: async () => {
        const token = localStorage.getItem('access_token')
        if (!token) return
        try {
          const { data: profile } = await api.get('/auth/me')
          set({ user: mapProfileToUser(profile), isAuthenticated: true, token })
        } catch {
          localStorage.removeItem('access_token')
          set({ user: null, token: null, isAuthenticated: false })
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
