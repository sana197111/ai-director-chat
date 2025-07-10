'use client'

import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'
import type { ToastProps } from '@/types'

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 3000,
  onClose
}) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose?.()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <XCircle className="w-5 h-5" />,
    warning: <AlertCircle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />
  }

  const colors = {
    success: 'bg-success text-white',
    error: 'bg-error text-white',
    warning: 'bg-warning text-black',
    info: 'bg-info text-white'
  }

  return (
    <motion.div
      className={`
        fixed bottom-24 left-1/2 transform -translate-x-1/2
        flex items-center gap-3 px-lg py-md rounded-xl shadow-xl
        min-w-[320px] max-w-[95vw] z-toast
        ${colors[type]}
      `}
      initial={{ opacity: 0, y: 50, x: '-50%' }}
      animate={{ opacity: 1, y: 0, x: '-50%' }}
      exit={{ opacity: 0, y: 20, x: '-50%' }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <span className="flex-shrink-0">{icons[type]}</span>
      <span className="flex-1 text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1 hover:opacity-80 transition-opacity"
          aria-label="닫기"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  )
}

// Toast Provider Component
interface ToastProviderProps {
  children: React.ReactNode
}

interface ToastItem {
  id: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration?: number
}

const ToastContext = React.createContext<{
  showToast: (toast: Omit<ToastItem, 'id'>) => void
} | null>(null)

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = React.useState<ToastItem[]>([])

  const showToast = (toast: Omit<ToastItem, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    setToasts(prev => [...prev, { ...toast, id }])
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <AnimatePresence>
        {toasts.map((toast, index) => (
          <motion.div
            key={toast.id}
            style={{ bottom: `${24 + index * 80}px` }}
            className="fixed left-1/2 transform -translate-x-1/2 z-toast"
          >
            <Toast
              message={toast.message}
              type={toast.type}
              duration={toast.duration}
              onClose={() => removeToast(toast.id)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
