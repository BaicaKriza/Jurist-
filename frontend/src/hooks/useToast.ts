import { useState, useCallback } from 'react'

export interface ToastMessage {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'destructive' | 'success'
  duration?: number
}

let toastQueue: ToastMessage[] = []
let listeners: Array<(toasts: ToastMessage[]) => void> = []

function notifyListeners() {
  listeners.forEach((l) => l([...toastQueue]))
}

export function toast(msg: Omit<ToastMessage, 'id'>) {
  const id = crypto.randomUUID()
  const item: ToastMessage = { ...msg, id, duration: msg.duration ?? 4000 }
  toastQueue = [...toastQueue, item]
  notifyListeners()
  setTimeout(() => {
    toastQueue = toastQueue.filter((t) => t.id !== id)
    notifyListeners()
  }, item.duration)
}

export function useToastMessages() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const subscribe = useCallback(() => {
    const listener = (msgs: ToastMessage[]) => setToasts(msgs)
    listeners.push(listener)
    return () => {
      listeners = listeners.filter((l) => l !== listener)
    }
  }, [])

  return { toasts, subscribe }
}

export function useToast() {
  const showToast = useCallback(
    (opts: Omit<ToastMessage, 'id'>) => {
      toast(opts)
    },
    []
  )

  return {
    toast: showToast,
    success: (title: string, description?: string) =>
      showToast({ title, description, variant: 'success' }),
    error: (title: string, description?: string) =>
      showToast({ title, description, variant: 'destructive' }),
    info: (title: string, description?: string) =>
      showToast({ title, description, variant: 'default' }),
  }
}
