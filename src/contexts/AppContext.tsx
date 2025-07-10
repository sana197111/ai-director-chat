// src/contexts/AppContext.tsx

'use client'

import React, { createContext, useContext, useReducer, useEffect, useState } from 'react'
import { AppState, DirectorType, Message, Choice } from '@/types'
import { storage } from '@/lib/storage'
import { directors } from '@/constants/directors'

/* ─── per-director 채팅 ↔ localStorage 헬퍼 ─── */
function saveChatToLS(director: string | null, messages: Message[]) {
  if (!director) return;
  localStorage.setItem(`chat_${director}`, JSON.stringify(messages));
}

function loadChatFromLS(director: string | null): Message[] {
  if (!director) return [];
  try {
    return JSON.parse(localStorage.getItem(`chat_${director}`) || '[]');
  } catch {
    return [];
  }
}

// Initial state
const initialState: AppState = {
  session: {
    id: '',
    startTime: new Date(),
    currentStep: 'start',
    lastActivity: new Date()
  },
  director: {
    selected: null,
    data: null
  },
  scenario: {
    cuts: ['', '', '', ''],
    completed: false
  },
  chat: {
    messages: [],
    currentTurn: 0,
    startTime: new Date(),
    timeRemaining: 600, // 10 minutes in seconds
    isExtended: false,
    extensionCount: 0
  }
}

// Action types
type AppAction =
  | { type: 'INIT_SESSION'; payload: { id: string } }
  | { type: 'SET_STEP'; payload: AppState['session']['currentStep'] }
  | { type: 'SELECT_DIRECTOR'; payload: DirectorType }
  | { type: 'CLEAR_DIRECTOR' }
  | { type: 'UPDATE_SCENARIO'; payload: { index: number; text: string } }
  | { type: 'COMPLETE_SCENARIO' }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'UPDATE_TIME'; payload: number }
  | { type: 'EXTEND_TIME' }
  | { type: 'RESET_CHAT' }
  | { type: 'RESET_ALL' }
  | { type: 'LOAD_STATE'; payload: Partial<AppState> }
  | { type: 'UPDATE_ACTIVITY' }

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'INIT_SESSION':
      return {
        ...state,
        session: {
          ...state.session,
          id: action.payload.id,
          startTime: new Date(),
          lastActivity: new Date()
        }
      }

    case 'SET_STEP':
      return {
        ...state,
        session: {
          ...state.session,
          currentStep: action.payload,
          lastActivity: new Date()
        }
      }

    case 'SELECT_DIRECTOR':
      const directorData = directors[action.payload]
      // 감독이 변경되면 해당 감독의 채팅 기록을 로드
      const savedMessages = loadChatFromLS(action.payload)
      return {
        ...state,
        director: {
          selected: action.payload,
          data: directorData
        },
        chat: {
          ...state.chat,
          messages: savedMessages,
          currentTurn: savedMessages.length,
          startTime: savedMessages.length > 0 ? state.chat.startTime : new Date()
        },
        session: {
          ...state.session,
          lastActivity: new Date()
        }
      }

    case 'CLEAR_DIRECTOR':
      return {
        ...state,
        director: {
          selected: null,
          data: null
        },
        session: {
          ...state.session,
          lastActivity: new Date()
        }
      }

    case 'UPDATE_SCENARIO':
      const newCuts = [...state.scenario.cuts] as [string, string, string, string]
      newCuts[action.payload.index] = action.payload.text
      const isCompleted = newCuts.every(cut => cut.trim().length > 0)
      
      return {
        ...state,
        scenario: {
          cuts: newCuts,
          completed: isCompleted,
          savedAt: new Date()
        },
        session: {
          ...state.session,
          lastActivity: new Date()
        }
      }

    case 'COMPLETE_SCENARIO':
      return {
        ...state,
        scenario: {
          ...state.scenario,
          completed: true
        }
      }

    case 'ADD_MESSAGE':
      // 메시지 ID 중복 체크
      const messageExists = state.chat.messages.some(msg => msg.id === action.payload.id)
      if (messageExists) {
        console.log('중복 메시지 ID 감지, 추가하지 않음:', action.payload.id)
        return state
      }
      
      // 인사말 메시지의 경우 추가 중복 체크
      const isGreeting = action.payload.id.includes('greeting')
      if (isGreeting && state.chat.messages.some(msg => msg.id.includes('greeting'))) {
        console.log('인사말 메시지 이미 존재, 추가하지 않음:', action.payload.id)
        return state
      }
      
      console.log('메시지 추가:', action.payload.id, action.payload.content.substring(0, 50) + '...')
      
      return {
        ...state,
        chat: {
          ...state.chat,
          messages: [...state.chat.messages, action.payload],
          currentTurn: state.chat.currentTurn + 1
        },
        session: {
          ...state.session,
          lastActivity: new Date()
        }
      }

    case 'UPDATE_TIME':
      return {
        ...state,
        chat: {
          ...state.chat,
          timeRemaining: action.payload
        }
      }

    case 'EXTEND_TIME':
      return {
        ...state,
        chat: {
          ...state.chat,
          timeRemaining: state.chat.timeRemaining + 180, // Add 3 minutes
          isExtended: true,
          extensionCount: state.chat.extensionCount + 1
        }
      }

    case 'RESET_CHAT':
      // 현재 감독의 채팅 기록만 삭제
      if (state.director.selected) {
        localStorage.removeItem(`chat_${state.director.selected}`)
      }
      return {
        ...state,
        chat: {
          ...initialState.chat,
          startTime: new Date()
        }
      }

    case 'RESET_ALL':
      return {
        ...initialState,
        session: {
          ...initialState.session,
          id: state.session.id
        }
      }

    case 'LOAD_STATE':
      return {
        ...state,
        ...action.payload
      }

    case 'UPDATE_ACTIVITY':
      return {
        ...state,
        session: {
          ...state.session,
          lastActivity: new Date()
        }
      }

    default:
      return state
  }
}

// Context
interface AppContextValue {
  state: AppState
  dispatch: React.Dispatch<AppAction>
  actions: {
    initSession: (id: string) => void
    setStep: (step: AppState['session']['currentStep']) => void
    selectDirector: (director: DirectorType) => void
    clearDirector: () => void
    updateScenario: (index: number, text: string) => void
    completeScenario: () => void
    addMessage: (message: Message) => void
    updateTime: (time: number) => void
    extendTime: () => void
    resetChat: () => void
    resetAll: () => void
    updateActivity: () => void
  }
}

const AppContext = createContext<AppContextValue | null>(null)

// Provider component
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState)
  const [mounted, setMounted] = useState(false)

  // Set mounted state
  useEffect(() => {
    setMounted(true)
  }, [])

  // Load saved state on mount
  useEffect(() => {
    // Only run on client side to avoid hydration issues
    if (typeof window === 'undefined') return

    const savedSession = storage.get<AppState['session']>('SESSION')
    const savedDirector = storage.get<AppState['director']>('DIRECTOR')
    const savedScenario = storage.get<AppState['scenario']>('SCENARIO')
    const savedMessages  = loadChatFromLS(savedDirector?.selected ?? null);

    if (savedSession && !storage.isSessionExpired(savedSession.lastActivity)) {
      dispatch({
        type: 'LOAD_STATE',
        payload: {
          session: savedSession,
          director: savedDirector || initialState.director,
          scenario: savedScenario || initialState.scenario,
          chat: {
            ...initialState.chat,
            messages:    savedMessages,
            currentTurn: savedMessages.length
          }
        }
      })
    } else {
      // Generate new session
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      dispatch({ type: 'INIT_SESSION', payload: { id: newSessionId } })
    }
  }, [])

  // Save state changes to localStorage
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return
    
    if (state.session.id) {
      storage.set('SESSION', state.session)
      storage.set('DIRECTOR', state.director)
      storage.set('SCENARIO', state.scenario)

      saveChatToLS(state.director.selected, state.chat.messages)
    }
  }, [state])

  // Session expiration check
  useEffect(() => {
    const checkInterval = setInterval(() => {
      if (storage.isSessionExpired(state.session.lastActivity)) {
        // Show session expired modal here
        console.log('Session expired')
      }
    }, 60000) // Check every minute

    return () => clearInterval(checkInterval)
  }, [state.session.lastActivity])

  // Actions
  const actions: AppContextValue['actions'] = {
    initSession: (id: string) => dispatch({ type: 'INIT_SESSION', payload: { id } }),
    setStep: (step) => dispatch({ type: 'SET_STEP', payload: step }),
    selectDirector: (director) => dispatch({ type: 'SELECT_DIRECTOR', payload: director }),
    clearDirector: () => dispatch({ type: 'CLEAR_DIRECTOR' }),
    updateScenario: (index, text) => dispatch({ type: 'UPDATE_SCENARIO', payload: { index, text } }),
    completeScenario: () => dispatch({ type: 'COMPLETE_SCENARIO' }),
    addMessage: (message: Message) => dispatch({ type: 'ADD_MESSAGE', payload: message }),
    updateTime: (time) => dispatch({ type: 'UPDATE_TIME', payload: time }),
    extendTime: () => dispatch({ type: 'EXTEND_TIME' }),
    resetChat: () => dispatch({ type: 'RESET_CHAT' }),
    resetAll: () => {
      storage.clearAll();   // 공통 키 제거

      // 감독별 chat_… 기록 모두 삭제
      Object.keys(localStorage)
        .filter(k => k.startsWith('chat_'))
        .forEach(k => localStorage.removeItem(k));

      dispatch({ type: 'RESET_ALL' });
    },
    updateActivity: () => dispatch({ type: 'UPDATE_ACTIVITY' })
  }

  // Prevent hydration issues by only showing full content after mounting
  if (!mounted) {
    return (
      <AppContext.Provider value={{ state, dispatch, actions }}>
        {children}
      </AppContext.Provider>
    )
  }

  return (
    <AppContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </AppContext.Provider>
  )
}

// Hook to use the context
export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within AppProvider')
  }
  return context
}
