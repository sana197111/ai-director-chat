// Local storage utilities with type safety

import type { Message, EmotionType, DirectorType } from '@/types'
import type { ConversationStage, ScenarioContext } from './gemini'

const STORAGE_KEYS = {
  SESSION: 'ai-director-session',
  DIRECTOR: 'ai-director-selected',
  SCENARIO: 'ai-director-scenario',
  CHAT: 'ai-director-chat',
  PREFERENCES: 'ai-director-preferences',
  CHAT_SESSION: 'ai-director-chat-session'
} as const

interface StoredChatState {
  messages: Message[]
  scenarioContext: ScenarioContext | null
  conversationStage: ConversationStage
  director: DirectorType
  timestamp: number
  turnCount: number
}

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

// 채팅 세션 저장 및 복구 클래스
export class ChatStorage {
  private static readonly STORAGE_KEY = STORAGE_KEYS.CHAT_SESSION
  private static readonly EXPIRY_TIME = 30 * 60 * 1000 // 30분
  
  static save(data: {
    messages: Message[]
    scenarioContext: ScenarioContext | null
    conversationStage: ConversationStage
    director: DirectorType
    turnCount: number
  }): void {
    try {
      const storageData: StoredChatState = {
        ...data,
        timestamp: Date.now()
      }
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(storageData))
      console.log('[Storage] Chat session saved')
    } catch (error) {
      console.error('[Storage] Failed to save chat session:', error)
    }
  }
  
  static load(): StoredChatState | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (!stored) return null
      
      const data = JSON.parse(stored) as StoredChatState
      
      // 만료 시간 체크
      if (Date.now() - data.timestamp > this.EXPIRY_TIME) {
        console.log('[Storage] Session expired, clearing storage')
        this.clear()
        return null
      }
      
      console.log('[Storage] Chat session loaded')
      return data
    } catch (error) {
      console.error('[Storage] Failed to load chat session:', error)
      return null
    }
  }
  
  static clear(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY)
      console.log('[Storage] Chat session cleared')
    } catch (error) {
      console.error('[Storage] Failed to clear chat session:', error)
    }
  }
  
  static hasSession(): boolean {
    const session = this.load()
    return session !== null
  }
}

// 자동 저장을 위한 디바운스 함수
export function createAutoSave<T extends (...args: any[]) => void>(
  fn: T,
  delay: number = 1000
): T {
  let timeoutId: NodeJS.Timeout | null = null
  
  return ((...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }) as T
}

// 세션 복구 프롬프트
export function getSessionRecoveryPrompt(): string {
  return "이전 대화가 있습니다. 계속하시겠습니까?"
}