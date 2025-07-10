'use client'

import React from 'react'
import { motion } from 'framer-motion'

// Skeleton Screen Component
interface SkeletonProps {
  width?: string | number
  height?: string | number
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  className = '',
  variant = 'text'
}) => {
  const baseStyles = 'bg-gray-200 animate-pulse'
  
  const variantStyles = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg'
  }

  return (
    <div
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      style={{ width, height }}
    />
  )
}

// Typing Animation Component
interface TypingAnimationProps {
  text?: string
  className?: string
}

export const TypingAnimation: React.FC<TypingAnimationProps> = ({
  text = '감독이 생각 중',
  className = ''
}) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-text-secondary">{text}</span>
      <motion.div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-2 h-2 bg-text-secondary rounded-full"
            initial={{ opacity: 0.3 }}
            animate={{ opacity: 1 }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              repeatType: 'reverse',
              delay: i * 0.2
            }}
          />
        ))}
      </motion.div>
    </div>
  )
}

// Progress Indicator Component
interface ProgressIndicatorProps {
  current: number
  total: number
  labels?: string[]
  className?: string
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  current,
  total,
  labels = [],
  className = ''
}) => {
  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between mb-2">
        {labels.map((label, index) => (
          <span
            key={index}
            className={`text-xs ${
              index + 1 <= current ? 'text-primary font-medium' : 'text-text-disabled'
            }`}
          >
            {label}
          </span>
        ))}
      </div>
      <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${(current / total) * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <div className="flex justify-between mt-2">
        {Array.from({ length: total }).map((_, index) => (
          <div
            key={index}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium
              ${index + 1 <= current 
                ? 'bg-primary text-white' 
                : 'bg-gray-200 text-text-disabled'
              }`}
          >
            {index + 1}
          </div>
        ))}
      </div>
    </div>
  )
}

// Spinner Overlay Component
interface SpinnerOverlayProps {
  isVisible: boolean
  message?: string
  className?: string
}

export const SpinnerOverlay: React.FC<SpinnerOverlayProps> = ({
  isVisible,
  message,
  className = ''
}) => {
  if (!isVisible) return null

  return (
    <motion.div
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="bg-white rounded-xl p-xl flex flex-col items-center gap-4"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        {message && (
          <p className="text-text-primary font-medium">{message}</p>
        )}
      </motion.div>
    </motion.div>
  )
}

// Loading Card Component (for content placeholders)
export const LoadingCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`bg-surface rounded-xl p-lg ${className}`}>
      <Skeleton variant="rectangular" height={200} className="mb-4" />
      <Skeleton variant="text" height={24} width="80%" className="mb-2" />
      <Skeleton variant="text" height={16} width="100%" className="mb-1" />
      <Skeleton variant="text" height={16} width="90%" />
    </div>
  )
}

// Film Strip Loading Component
export const FilmStripLoading: React.FC = () => {
  return (
    <div className="flex gap-4 p-4">
      {[1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          className="flex-1"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
        >
          <Skeleton variant="rectangular" height={120} className="rounded-lg" />
        </motion.div>
      ))}
    </div>
  )
}
