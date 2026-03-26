import React, { useEffect, useState } from 'react'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast'
import { useToastMessages } from '@/hooks/useToast'
import { CheckCircle2, AlertCircle, Info } from 'lucide-react'

export function Toaster() {
  const { toasts, subscribe } = useToastMessages()

  useEffect(() => {
    const unsub = subscribe()
    return unsub
  }, [subscribe])

  return (
    <ToastProvider>
      {toasts.map((t) => (
        <Toast key={t.id} variant={t.variant === 'success' ? 'success' : t.variant === 'destructive' ? 'destructive' : 'default'}>
          <div className="flex items-start gap-2">
            {t.variant === 'success' && <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />}
            {t.variant === 'destructive' && <AlertCircle className="h-4 w-4 mt-0.5 text-red-600 shrink-0" />}
            {(!t.variant || t.variant === 'default') && <Info className="h-4 w-4 mt-0.5 text-blue-600 shrink-0" />}
            <div className="flex-1 grid gap-1">
              <ToastTitle>{t.title}</ToastTitle>
              {t.description && <ToastDescription>{t.description}</ToastDescription>}
            </div>
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}
