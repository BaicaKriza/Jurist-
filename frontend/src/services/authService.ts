import api from '@/lib/api'
import type { User, TokenResponse } from '@/types'

export const authService = {
  async login(email: string, password: string): Promise<TokenResponse> {
    const { data } = await api.post<TokenResponse>('/auth/login', { email, password })
    return data
  },

  async getMe(): Promise<User> {
    const { data } = await api.get<User>('/auth/me')
    return data
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.patch('/auth/me/password', {
      current_password: currentPassword,
      new_password: newPassword,
    })
  },
}
