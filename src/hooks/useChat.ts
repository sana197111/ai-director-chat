'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useApp } from '@/contexts/AppContext'
import { generateDirectorResponseLegacy, getInitialGreeting } from '@/lib/gemini'
import { getOfflineResponse, isOnline } from '@/lib/offlineResponses'
import type { Message, Choice } from '@/types'

interface UseChatOptions {
  onError?: (error: Error) => void
  onOfflineMode?: () => void
  maxRetries?: number
}

interface ChatState {
  isLoading: boolean
  isTyping: boolean
  currentChoices: Choice[]
  isOfflineMode: boolean
  error: Error | null
  retryCount: number
}

export function useChat(options: UseChatOptions = {}) {
  const { state, actions } = useApp()
  const { maxRetries = 3 } = options
  
  // Chat state
  const [chatState, setChatState] = useState<ChatState>({
    isLoading: false,
    isTyping: false,
    currentChoices: [],
    isOfflineMode: !isOnline(),
    error: null,
    retryCount: 0
  })
  
  // Refs for cleanup and cancellation
  const abortControllerRef = useRef<AbortController | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Initialize greeting on mount
  useEffect(() => {
    if (state.chat.messages.length === 0 && state.director.selected) {
      const greeting = getInitialGreeting(state.director.selected)
      const greetingMessage: Message = {
        id: generateMessageId(),
        role: 'assistant',
        content: greeting.message,
        timestamp: new Date(),
        choices: greeting.choices
      }
      actions.addMessage(greetingMessage)
      setChatState(prev => ({ ...prev, currentChoices: greeting.choices }))
    }
  }, [])
  
  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setChatState(prev => ({ ...prev, isOfflineMode: false }))
    }
    
    const handleOffline = () => {
      setChatState(prev => ({ ...prev, isOfflineMode: true }))
      options.onOfflineMode?.()
    }
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [options.onOfflineMode])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])
  
  // Generate unique message ID
  const generateMessageId = useCallback(() => {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }, [])
  
  // Send message
  const sendMessage = useCallback(async (content: string): Promise<void> => {
    if (!content.trim() || chatState.isLoading) return
    
    // Cancel any ongoing request
    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()
    
    // Clear typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    
    // Add user message
    const userMessage: Message = {
      id: generateMessageId(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date()
    }
    actions.addMessage(userMessage)
    
    // Update state
    setChatState(prev => ({
      ...prev,
      isLoading: true,
      isTyping: true,
      currentChoices: [],
      error: null
    }))
    
    try {
      let response
      
      if (chatState.isOfflineMode) {
        // Simulate network delay for offline mode
        await new Promise(resolve => {
          typingTimeoutRef.current = setTimeout(resolve, 1000 + Math.random() * 1000)
        })
        
        response = getOfflineResponse(
          state.director.selected!,
          state.chat.currentTurn,
          content
        )
      } else {
        // Call Gemini API with retry logic
        let attempts = 0
        let lastError: Error | null = null
        
        while (attempts < maxRetries) {
          try {
            // 선택된 감정과 컨텐츠를 4-tuple 형식으로 변환
            const selectedEmotion = state.scenario.selectedEmotion
            const selectedContent = selectedEmotion ? state.scenario.cuts[selectedEmotion] : ''
            
            // 4개 씬 배열 만들기 (선택된 감정의 컨텐츠만 포함)
            const scenarioArray: [string, string, string, string] = ['', '', '', '']
            if (selectedEmotion && selectedContent) {
              const emotionIndex = selectedEmotion === 'joy' ? 0 : 
                                  selectedEmotion === 'anger' ? 1 : 
                                  selectedEmotion === 'sadness' ? 2 : 3
              scenarioArray[emotionIndex] = selectedContent
            }
            
            response = await generateDirectorResponseLegacy(
              state.director.selected!,
              scenarioArray,
              content,
              state.chat.messages.map(msg => ({
                role: msg.role,
                content: msg.content
              }))
            )
            
            // Success - reset retry count
            setChatState(prev => ({ ...prev, retryCount: 0 }))
            break
            
          } catch (error) {
            attempts++
            lastError = error as Error
            
            if (attempts < maxRetries) {
              // Wait before retry with exponential backoff
              await new Promise(resolve => 
                setTimeout(resolve, Math.min(1000 * Math.pow(2, attempts), 5000))
              )
            }
          }
        }
        
        // If all retries failed, switch to offline mode
        if (attempts >= maxRetries && lastError) {
          console.error('All API attempts failed:', lastError)
          setChatState(prev => ({ ...prev, isOfflineMode: true }))
          options.onOfflineMode?.()
          
          // Use offline response as fallback
          response = getOfflineResponse(
            state.director.selected!,
            state.chat.currentTurn,
            content
          )
        }
      }
      
      // Stop typing animation
      setChatState(prev => ({ ...prev, isTyping: false }))
      
      // Add AI response
      if (response) {
        const aiMessage: Message = {
          id: generateMessageId(),
          role: 'assistant',
          content: response.message,
          timestamp: new Date(),
          choices: response.choices
        }
        
        actions.addMessage(aiMessage)
        setChatState(prev => ({
          ...prev,
          currentChoices: response.choices || []
        }))
      }
      
    } catch (error) {
      console.error('Chat error:', error)
      const err = error as Error
      
      setChatState(prev => ({
        ...prev,
        isTyping: false,
        error: err
      }))
      
      options.onError?.(err)
      
      // Add error message to chat
      const errorMessage: Message = {
        id: generateMessageId(),
        role: 'system',
        content: '죄송합니다. 일시적인 오류가 발생했습니다. 다시 시도해주세요.',
        timestamp: new Date()
      }
      actions.addMessage(errorMessage)
      
    } finally {
      setChatState(prev => ({
        ...prev,
        isLoading: false,
        isTyping: false
      }))
    }
  }, [
    chatState.isLoading,
    chatState.isOfflineMode,
    state.director.selected,
    state.scenario.selectedEmotion,
    state.scenario.cuts,
    state.chat.messages,
    state.chat.currentTurn,
    actions,
    maxRetries,
    options
  ])
  
  // Send choice
  const sendChoice = useCallback((choice: Choice) => {
    return sendMessage(choice.text)
  }, [sendMessage])
  
  // Regenerate last response
  const regenerateResponse = useCallback(async () => {
    // Find last user message
    const lastUserMessageIndex = state.chat.messages.findLastIndex(
      msg => msg.role === 'user'
    )
    
    if (lastUserMessageIndex === -1) return
    
    const lastUserMessage = state.chat.messages[lastUserMessageIndex]
    
    // Remove all messages after last user message
    const messagesToKeep = state.chat.messages.slice(0, lastUserMessageIndex + 1)
    
    // Reset chat to state before last AI response
    actions.resetChat()
    messagesToKeep.forEach(msg => actions.addMessage(msg))
    
    // Resend the last user message
    await sendMessage(lastUserMessage.content)
  }, [state.chat.messages, actions, sendMessage])
  
  // Clear chat
  const clearChat = useCallback(() => {
    actions.resetChat()
    setChatState({
      isLoading: false,
      isTyping: false,
      currentChoices: [],
      isOfflineMode: !isOnline(),
      error: null,
      retryCount: 0
    })
  }, [actions])
  
  // Get conversation summary
  const getConversationSummary = useCallback(() => {
    const totalMessages = state.chat.messages.length
    const userMessages = state.chat.messages.filter(msg => msg.role === 'user').length
    const aiMessages = state.chat.messages.filter(msg => msg.role === 'assistant').length
    
    return {
      totalMessages,
      userMessages,
      aiMessages,
      duration: Date.now() - state.chat.startTime.getTime(),
      currentTurn: state.chat.currentTurn
    }
  }, [state.chat])
  
  // Export chat history
  const exportChatHistory = useCallback(() => {
    const chatData = {
      director: state.director.data,
      scenario: state.scenario.cuts,
      messages: state.chat.messages,
      summary: getConversationSummary(),
      exportedAt: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(chatData, null, 2)], {
      type: 'application/json'
    })
    
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat-${state.director.selected}-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [state, getConversationSummary])
  
  // Get suggested prompts based on conversation
  const getSuggestedPrompts = useCallback((): string[] => {
    const turn = state.chat.currentTurn
    const director = state.director.selected
    
    const prompts: Record<string, string[]> = {
      bong: [
        '이 장면에서 계급 차이를 어떻게 시각화할까요?',
        '카메라 앵글로 권력관계를 표현하는 방법은?',
        '일상 속 부조리를 포착하는 연출법을 알려주세요',
        '블랙 유머를 효과적으로 사용하려면?'
      ],
      nolan: [
        '시간의 흐름을 비선형적으로 표현하려면?',
        '관객의 인식을 뒤흔드는 반전을 만들려면?',
        '복잡한 서사를 명확하게 전달하는 방법은?',
        '현실과 꿈의 경계를 모호하게 만드는 기법은?'
      ],
      miyazaki: [
        '자연과 인간의 조화를 시각적으로 표현하려면?',
        '성장의 순간을 감동적으로 포착하는 방법은?',
        '판타지 요소를 현실감 있게 녹여내려면?',
        '캐릭터의 내면을 행동으로 보여주는 방법은?'
      ],
      curtis: [
        '일상의 로맨스를 특별하게 만드는 방법은?',
        '유머와 감동의 균형을 맞추려면?',
        '관계의 진정성을 표현하는 대사 쓰기는?',
        '해피엔딩을 진부하지 않게 만드는 방법은?'
      ],
      kani: [
        '감정의 미묘한 변화를 시각화하려면?',
        '풍경으로 마음을 표현하는 방법은?',
        '시간과 거리를 초월한 연결을 그리려면?',
        '빛과 색으로 감정을 전달하는 기법은?'
      ],
      doctor: [
        '상처를 치유하는 과정을 어떻게 그릴까요?',
        '트라우마를 섬세하게 다루는 방법은?',
        '회복력을 시각적으로 표현하려면?',
        '희망의 메시지를 자연스럽게 전달하려면?'
      ]
    }
    
    const directorPrompts = prompts[director!] || prompts.bong
    
    // Return different prompts based on conversation stage
    if (turn < 3) {
      return directorPrompts.slice(0, 2)
    } else if (turn < 7) {
      return directorPrompts.slice(1, 3)
    } else {
      return directorPrompts.slice(2, 4)
    }
  }, [state.chat.currentTurn, state.director.selected])
  
  // Check if should show free input
  const shouldShowFreeInput = useCallback(() => {
    // Show free input after 5 turns or when no choices available
    return state.chat.currentTurn > 5 || chatState.currentChoices.length === 0
  }, [state.chat.currentTurn, chatState.currentChoices])
  
  return {
    // State
    ...chatState,
    messages: state.chat.messages,
    
    // Actions
    sendMessage,
    sendChoice,
    regenerateResponse,
    clearChat,
    
    // Utilities
    getConversationSummary,
    exportChatHistory,
    getSuggestedPrompts,
    shouldShowFreeInput,
    
    // Computed values
    isActive: state.chat.messages.length > 0,
    canRegenerate: state.chat.messages.some(msg => msg.role === 'assistant'),
    messageCount: state.chat.messages.length
  }
}
