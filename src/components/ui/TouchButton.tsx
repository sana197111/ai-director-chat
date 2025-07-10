'use client'

import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { tokens } from '@/styles/tokens'
import type { TouchButtonProps } from '@/types'

export const TouchButton: React.FC<TouchButtonProps> = ({
  onClick,
  disabled = false,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  haptic = true,
  loading = false,
  className = '',
  children
}) => {
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([])
  const buttonRef = useRef<HTMLButtonElement>(null)

  const handleClick = (e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => {
    if (disabled || loading) return

    // Haptic feedback
    if (haptic && 'vibrate' in navigator) {
      navigator.vibrate(10)
    }

    // Ripple effect
    const button = buttonRef.current
    if (button) {
      const rect = button.getBoundingClientRect()
      const x = 'touches' in e ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left
      const y = 'touches' in e ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top
      
      const rippleId = Date.now()
      setRipples(prev => [...prev, { x, y, id: rippleId }])
      
      setTimeout(() => {
        setRipples(prev => prev.filter(ripple => ripple.id !== rippleId))
      }, 600)
    }

    onClick()
  }

  const baseStyles = `
    relative overflow-hidden
    inline-flex items-center justify-center
    font-medium transition-all duration-200
    focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
    disabled:cursor-not-allowed
    select-none
  `

  const variantStyles = {
    primary: `
      bg-yellow-500 text-black
      hover:bg-yellow-600 active:bg-yellow-700
      focus-visible:ring-yellow-500
      disabled:bg-opacity-50
    `,
    secondary: `
      bg-white text-black border border-gray-300
      hover:bg-gray-50 active:bg-gray-100
      focus-visible:ring-yellow-500
      disabled:bg-opacity-50 disabled:text-gray-400
    `,
    ghost: `
      bg-transparent text-white
      hover:bg-white/10 active:bg-white/20
      focus-visible:ring-yellow-500
      disabled:text-gray-400
    `
  }

  const sizeStyles = {
    sm: 'min-h-[40px] px-md text-sm rounded-md gap-2',
    md: 'min-h-[48px] px-lg text-base rounded-lg gap-2',
    lg: 'min-h-[56px] px-xl text-lg rounded-xl gap-3'
  }

  return (
    <motion.button
      ref={buttonRef}
      className={`
        ${baseStyles}
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={disabled || loading}
      onClick={handleClick}
      onTouchStart={handleClick}
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      transition={{ duration: 0.1 }}
    >
      {/* Ripple effects */}
      <AnimatePresence>
        {ripples.map(ripple => (
          <motion.span
            key={ripple.id}
            className="absolute bg-white bg-opacity-30 rounded-full pointer-events-none"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: 10,
              height: 10,
              marginLeft: -5,
              marginTop: -5,
            }}
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 20, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        ))}
      </AnimatePresence>

      {/* Loading spinner */}
      {loading && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center bg-inherit"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        </motion.div>
      )}

      {/* Button content */}
      <motion.span
        className={`relative z-10 ${loading ? 'opacity-0' : 'opacity-100'}`}
        animate={{ opacity: loading ? 0 : 1 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.span>
    </motion.button>
  )
}
