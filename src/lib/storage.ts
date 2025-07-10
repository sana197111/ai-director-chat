// Local storage utilities with type safety

const STORAGE_KEYS = {
  SESSION: 'ai-director-session',
  DIRECTOR: 'ai-director-selected',
  SCENARIO: 'ai-director-scenario',
  CHAT: 'ai-director-chat',
  PREFERENCES: 'ai-director-preferences'
} as const

export const storage = {
  // Generic get method with type safety
  get<T>(key: keyof typeof STORAGE_KEYS): T | null {
    if (typeof window === 'undefined') return null
    
    try {
      const item = localStorage.getItem(STORAGE_KEYS[key])
      return item ? JSON.parse(item) : null
    } catch (error) {
      console.error(`Error reading from localStorage:`, error)
      return null
    }
  },

  // Generic set method
  set<T>(key: keyof typeof STORAGE_KEYS, value: T): void {
    if (typeof window === 'undefined') return
    
    try {
      localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(value))
    } catch (error) {
      console.error(`Error writing to localStorage:`, error)
    }
  },

  // Remove specific item
  remove(key: keyof typeof STORAGE_KEYS): void {
    if (typeof window === 'undefined') return
    
    try {
      localStorage.removeItem(STORAGE_KEYS[key])
    } catch (error) {
      console.error(`Error removing from localStorage:`, error)
    }
  },

  // Clear all app data
  clearAll(): void {
    if (typeof window === 'undefined') return
    
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key)
      })
    } catch (error) {
      console.error(`Error clearing localStorage:`, error)
    }
  },

  // Check if session is expired (10 minutes of inactivity)
  isSessionExpired(lastActivity: Date | string): boolean {
    const lastActivityTime = new Date(lastActivity).getTime()
    const now = Date.now()
    const tenMinutes = 10 * 60 * 1000
    
    return now - lastActivityTime > tenMinutes
  }
}

export type StorageKeys = keyof typeof STORAGE_KEYS