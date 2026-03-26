import { create } from 'zustand'

export interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  read: boolean
  created_at: string
}

interface UIState {
  sidebarOpen: boolean
  notifications: Notification[]
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  addNotification: (notification: Omit<Notification, 'id' | 'read' | 'created_at'>) => void
  markNotificationRead: (id: string) => void
  clearNotifications: () => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  notifications: [],

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        {
          ...notification,
          id: crypto.randomUUID(),
          read: false,
          created_at: new Date().toISOString(),
        },
        ...state.notifications,
      ].slice(0, 50),
    })),

  markNotificationRead: (id: string) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),

  clearNotifications: () => set({ notifications: [] }),
}))
