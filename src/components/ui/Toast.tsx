import { create } from 'zustand'

export interface ToastItem {
  id: number
  type: 'success' | 'error' | 'info'
  message: string
}

interface ToastStore {
  toasts: ToastItem[]
  addToast: (type: ToastItem['type'], message: string) => void
  removeToast: (id: number) => void
}

let nextId = 0

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (type, message) => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 4000)
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  error: (message: string) => useToastStore.getState().addToast('error', message),
  success: (message: string) => useToastStore.getState().addToast('success', message),
  info: (message: string) => useToastStore.getState().addToast('info', message),
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  const removeToast = useToastStore((s) => s.removeToast)

  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed',
      top: '16px',
      right: '16px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      pointerEvents: 'none',
    }}>
      {toasts.map((t) => {
        const bg = t.type === 'error' ? 'var(--danger)' : t.type === 'success' ? 'var(--success)' : 'var(--accent)'
        return (
          <div
            key={t.id}
            onClick={() => removeToast(t.id)}
            style={{
              background: bg,
              color: '#fff',
              padding: '12px 18px',
              borderRadius: 'var(--radius)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              pointerEvents: 'auto',
              animation: 'toastIn 0.3s ease',
              maxWidth: '360px',
              wordBreak: 'break-word',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            }}
          >
            {t.message}
          </div>
        )
      })}
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
