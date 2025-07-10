// Haptic feedback utilities for mobile devices

export const haptic = {
  // Light impact for button taps
  light: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10)
    }
  },

  // Medium impact for selections
  medium: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(20)
    }
  },

  // Heavy impact for important actions
  heavy: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(30)
    }
  },

  // Success pattern
  success: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([10, 10, 20])
    }
  },

  // Warning pattern
  warning: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([20, 10, 20])
    }
  },

  // Error pattern
  error: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([30, 10, 30, 10, 30])
    }
  },

  // Selection change
  selection: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(5)
    }
  }
}

// Check if haptic feedback is supported
export const isHapticSupported = () => 'vibrate' in navigator
