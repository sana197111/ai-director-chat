'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeft, 
  RefreshCw, 
  Volume2, 
  VolumeX, 
  Send,
  MessageCircle,
  Sparkles,
  Film,
  Clock,
  ChevronRight
} from 'lucide-react'
import { ChatBubble, ChoiceButtons, SystemMessage } from '@/components/features/ChatBubble'
import { Timer } from '@/components/features/Timer'
import { TouchButton, useToast, Modal, TypingAnimation } from '@/components/ui'
import { EndSessionModal } from '@/components/features/SessionExpiryModal'
import { useApp } from '@/contexts/AppContext'
import { haptic } from '@/lib/haptic'
import { generateDirectorResponse, generateInitialGreeting, getInitialGreeting, getFarewellMessage, testGeminiAPI } from '@/lib/gemini'
import { getOfflineResponse, isOnline, getOfflineModeMessage } from '@/lib/offlineResponses'
import type { Message, Choice } from '@/types'

export default function ChatPage() {
  const router = useRouter()
  const { state, actions } = useApp()
  const { showToast } = useToast()
  
  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const isInitialized = useRef(false)
  const currentDirector = useRef<string | null>(null) // 현재 감독 추적
  
  // Local state
  const [isLoading, setIsLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [currentChoices, setCurrentChoices] = useState<Choice[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isMuted, setIsMuted] = useState(false)
  const [showEndModal, setShowEndModal] = useState(false)
  const [endModalType, setEndModalType] = useState<'chat' | 'all'>('chat')
  const [isOfflineMode, setIsOfflineMode] = useState(!isOnline())
  const [showDirectorInfo, setShowDirectorInfo] = useState(false)
  const [timeUpHandled, setTimeUpHandled] = useState(false) // 시간 종료 처리 플래그

  // Session validation
  useEffect(() => {
    if (state.session.currentStep !== 'chat' || !state.director.selected || !state.scenario.completed) {
      router.push('/scenario')
    }
  }, [state.session.currentStep, state.director.selected, state.scenario.completed, router])

  // Initialize chat with greeting (감독별로 한 번만)
  useEffect(() => {
    // 감독이 변경되었는지 확인
    if (currentDirector.current !== state.director.selected) {
      currentDirector.current = state.director.selected
      isInitialized.current = false // 감독이 바뀌면 초기화 플래그 리셋
      console.log('감독 변경 감지:', state.director.selected)
    }
    
    // 안정적인 초기화 조건 체크
    const hasMessages = state.chat.messages.length > 0
    const hasValidDirector = state.director.selected && state.director.data
    const hasValidScenario = state.scenario.completed && state.scenario.cuts.every(cut => cut.trim().length > 0)
    const alreadyInitialized = isInitialized.current
    
    // 이미 초기화되었거나 메시지가 있으면 완전히 중단
    if (alreadyInitialized || hasMessages) {
      console.log('초기화 건너뜀:', { alreadyInitialized, hasMessages })
      return
    }
    
    // 필요 조건이 부족하면 중단  
    if (!hasValidDirector || !hasValidScenario) {
      console.log('초기화 조건 부족:', { hasValidDirector, hasValidScenario })
      return
    }

    console.log('=== 채팅 초기화 시작 ===', {
      director: state.director.selected,
      directorName: state.director.data?.nameKo,
      scenario: state.scenario.cuts[0].substring(0, 30) + '...'
    })
    
    // 즉시 플래그 설정으로 재진입 완전 차단
    isInitialized.current = true
    
    // 초기화 실행
    const initializeChat = async () => {
      try {
        console.log('=== AI 초기 인사말 생성 시작 ===')
        
        // AI 생성된 개인화된 인사말 시도
        const greeting = await generateInitialGreeting(
          state.director.selected!,
          state.scenario.cuts
        )
        
        // 메시지 ID에 타임스탬프와 랜덤값 추가로 중복 방지
        const greetingMessage: Message = {
          id: `greeting-${state.director.selected}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: 'assistant',
          content: greeting.message,
          timestamp: new Date(),
          choices: greeting.choices
        }
        
        console.log('=== AI 인사말 메시지 생성 완료 ===', {
          id: greetingMessage.id,
          contentLength: greetingMessage.content.length,
          choicesCount: greeting.choices.length
        })
        
        // 메시지 추가 전 중복 체크
        const isDuplicate = state.chat.messages.some(msg => 
          msg.content === greetingMessage.content && 
          msg.role === 'assistant'
        )
        
        if (!isDuplicate) {
          actions.addMessage(greetingMessage)
          setCurrentChoices(greeting.choices)
          console.log('=== AI 인사말 추가 완료 ===')
        } else {
          console.log('=== 중복 메시지 감지, 추가 건너뜀 ===')
        }
      } catch (error) {
        console.error('AI 인사말 생성 오류:', error)
        
        // 폴백으로 기본 인사말 사용
        console.log('=== 폴백: 기본 인사말 사용 ===')
        const greeting = getInitialGreeting(state.director.selected!)
        const greetingMessage: Message = {
          id: `greeting-fallback-${state.director.selected}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: 'assistant',
          content: greeting.message,
          timestamp: new Date(),
          choices: greeting.choices
        }
        
        // 중복 체크
        const isDuplicate = state.chat.messages.some(msg => 
          msg.content === greetingMessage.content && 
          msg.role === 'assistant'
        )
        
        if (!isDuplicate) {
          actions.addMessage(greetingMessage)
          setCurrentChoices(greeting.choices)
        }
      }
    }

    initializeChat()
  }, [state.director.selected, state.scenario.completed, state.chat.messages.length])

  // Reset initialization flag when director actually changes  
  useEffect(() => {
    console.log('감독 상태 변경:', state.director.selected)
    // 감독이 실제로 바뀔 때만 리셋 (null이 아닌 값으로)
    if (state.director.selected) {
      const wasInitialized = isInitialized.current
      isInitialized.current = false
      console.log('감독 변경으로 초기화 플래그 리셋:', state.director.selected, { wasInitialized })
    }
  }, [state.director.selected])

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOfflineMode(false)
      showToast({
        message: '온라인 상태로 전환되었습니다',
        type: 'success'
      })
    }
    
    const handleOffline = () => {
      setIsOfflineMode(true)
      showToast({
        message: getOfflineModeMessage(),
        type: 'warning'
      })
    }
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [showToast])

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.chat.messages])

  // Background music management
  useEffect(() => {
    if (state.director.data && audioRef.current) {
      // Load director-specific BGM
      audioRef.current.src = `/sounds/bgm/${state.director.selected}.mp3`
      audioRef.current.loop = true
      audioRef.current.volume = 0.3
      
      // Handle audio loading errors
      const handleAudioError = () => {
        console.log('Background music file not available or empty')
      }
      
      const handleAudioCanPlay = () => {
        if (!isMuted) {
          audioRef.current?.play().catch(err => {
            console.log('Audio autoplay prevented:', err)
          })
        }
      }
      
      audioRef.current.addEventListener('error', handleAudioError)
      audioRef.current.addEventListener('canplay', handleAudioCanPlay)
      
      return () => {
        if (audioRef.current) {
          audioRef.current.removeEventListener('error', handleAudioError)
          audioRef.current.removeEventListener('canplay', handleAudioCanPlay)
          audioRef.current.pause()
        }
      }
    }
    
    return () => {
      audioRef.current?.pause()
    }
  }, [state.director.data, state.director.selected, isMuted])

  // Handle sound toggle
  const toggleSound = () => {
    setIsMuted(!isMuted)
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.play()
      } else {
        audioRef.current.pause()
      }
    }
    haptic.light()
  }

  // Send message to AI
  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return
    
    // Add user message
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date()
    }
    actions.addMessage(userMessage)
    setInputValue('')
    setCurrentChoices([])
    setIsLoading(true)
    setIsTyping(true)
    
    try {
      let response
      
      if (isOfflineMode) {
        // Use offline responses
        await new Promise(resolve => setTimeout(resolve, 1500)) // Simulate delay
        response = getOfflineResponse(
          state.director.selected!,
          state.chat.currentTurn,
          content
        )
      } else {
        // Use Gemini API with improved JSON mode
        console.log('=== Gemini API 호출 (JSON 모드) ===')
        console.log('Director:', state.director.selected)
        console.log('User message:', content)
        console.log('Previous messages count:', state.chat.messages.length)
        
        response = await generateDirectorResponse(
          state.director.selected!,
          state.scenario.cuts,
          content,
          state.chat.messages.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        )
        
        console.log('=== Gemini API 응답 수신 ===')
        console.log('Response message length:', response.message.length)
        console.log('Response choices count:', response.choices?.length || 0)
        console.log('Response theme:', response.theme || 'None')
        console.log('Response emotion:', response.emotion || 'None')
        console.log('Response error:', response.error || 'None')
      }
      
      // Add AI response
      const aiMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        choices: response.choices
      }
      
      setIsTyping(false)
      actions.addMessage(aiMessage)
      
      // Always set choices if they exist
      setCurrentChoices(response.choices || [])
      
      // Show error if any
      if (response.error && !isOfflineMode) {
        console.warn('API 응답에 오류 포함:', response.error)
        showToast({
          message: 'API 응답 처리 중 일부 문제가 발생했지만 대화는 계속됩니다.',
          type: 'warning'
        })
        // 오류가 있어도 응답이 있으면 계속 진행
      }
      
    } catch (error) {
      console.error('Chat error:', error)
      setIsTyping(false)
      
      // Fallback to offline mode
      console.log('=== 오프라인 모드로 전환 ===')
      setIsOfflineMode(true)
      const offlineResponse = getOfflineResponse(
        state.director.selected!,
        state.chat.currentTurn,
        content
      )
      
      console.log('=== 오프라인 응답 사용 ===')
      console.log('Message length:', offlineResponse.message.length)
      console.log('Choices count:', offlineResponse.choices.length)
      
      const aiMessage: Message = {
        id: `msg-offline-${Date.now()}`,
        role: 'assistant',
        content: offlineResponse.message,
        timestamp: new Date(),
        choices: offlineResponse.choices
      }
      
      actions.addMessage(aiMessage)
      setCurrentChoices(offlineResponse.choices || [])
      
      showToast({
        message: '네트워크 오류로 오프라인 모드로 전환되었습니다',
        type: 'warning'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle choice selection
  const handleChoiceSelect = (choice: Choice) => {
    haptic.light()
    sendMessage(choice.text)
  }

  // Handle input submit
  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim() && !isLoading) {
      sendMessage(inputValue)
    }
  }

  // Handle time up with duplicate prevention
  const handleTimeUp = () => {
    // 이미 처리되었으면 중복 실행 방지
    if (timeUpHandled) {
      console.log('시간 종료 이미 처리됨, 중복 실행 방지')
      return
    }
    
    console.log('시간 종료 처리 시작')
    setTimeUpHandled(true)
    haptic.error()
    
    // Add farewell message
    const farewellMessage: Message = {
      id: `farewell-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'system',
      content: getFarewellMessage(state.director.selected!),
      timestamp: new Date()
    }
    actions.addMessage(farewellMessage)
    
    showToast({
      message: '대화 시간이 종료되었습니다',
      type: 'info'
    })
    
    // Show end modal after delay
    setTimeout(() => {
      console.log('시간 종료 모달 표시')
      setEndModalType('chat')
      setShowEndModal(true)
    }, 2000)
  }

  // Handle time extension
  const handleTimeExtend = () => {
    showToast({
      message: '3분이 추가되었습니다! ⏰',
      type: 'success'
    })
  }

  // Handle back navigation
  const handleBack = () => {
    haptic.light()
    actions.setStep('director')
    router.push('/director')
  }

  // Handle session end confirmation
  const handleEndSession = () => {
    console.log('세션 종료 확인:', endModalType)
    haptic.heavy()
    
    // 모달 닫기
    setShowEndModal(false)
    
    // 상태 정리 및 네비게이션
    setTimeout(() => {
      if (endModalType === 'chat') {
        console.log('채팅만 리셋, 감독 선택 페이지로')
        actions.resetChat()
        // 시간 종료 플래그도 리셋
        setTimeUpHandled(false)
        router.push('/director')
      } else {
        console.log('전체 리셋, 홈페이지로')
        actions.resetAll()
        router.push('/')
      }
    }, 100) // 모달 애니메이션이 끝난 후 실행
  }

  // Director theme styles
  const directorTheme = state.director.data ? {
    primary: state.director.data.themeColor,
    gradient: state.director.data.bgGradient,
    avatar: state.director.data.avatar
  } : null

  return (
    <div className="fullscreen-safe bg-black flex flex-col h-screen">
      {/* Hidden audio element */}
      <audio ref={audioRef} />
      
      <div className="flex flex-1 min-h-0">
        {/* Director video panel - fixed aspect ratio */}
        <motion.div 
          className="video-panel hidden md:flex flex-col flex-shrink-0 relative overflow-hidden"
          style={{
            width: '45%', // 고정 너비
            minWidth: '400px',
            maxWidth: '600px',
            height: '100%' // 부모의 전체 높이를 차지하도록 설정
          }}
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Director video full screen */}
          <div className="relative flex-1 w-full h-full">
            {state.director.data?.avatar ? (
              <video
                src={`/videos/${state.director.selected}.mp4`}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-black flex items-center justify-center">
                <Film className="w-48 h-48 text-white/60" />
              </div>
            )}
          </div>
          
          {/* Director info overlay - bottom left */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 p-8 z-10 bg-gradient-to-t from-black/80 to-transparent"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-4 text-white">
              <h3 className="text-xl font-bold mb-2">
                {state.director.data?.nameKo}
              </h3>
              <p className="text-white/80 text-sm mb-3">
                {state.director.data?.title}
              </p>
              {/* Representative works as tags */}
              <div className="flex flex-wrap gap-1">
                {state.director.data?.films.slice(0, 2).map((film, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white/90 rounded-full text-xs font-medium"
                  >
                    {film}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
        
        {/* Right panel - Chat interface */}
        <div 
          className="chat-panel flex-1 flex flex-col relative overflow-hidden"
          style={{ 
            background: state.director.data?.themeColor || '#1f2937'
          }}
        >
          {/* Video background for chat panel */}
          <div className="absolute inset-0 overflow-hidden">
            {state.director.data?.avatar ? (
              <video
                src={`/videos/${state.director.selected}.mp4`}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover opacity-35 scale-110 blur-sm"
              />
            ) : (
              <div 
                className="w-full h-full opacity-30"
                style={{ background: directorTheme?.gradient }}
              />
            )}
          </div>
          
          {/* Semi-transparent overlay */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />
          
          <div className="relative z-10 flex flex-col flex-1">
            {/* Chat header */}
            <motion.header 
              className="chat-header flex-shrink-0 flex items-center justify-between p-4 border-b border-white/20 bg-black/30 backdrop-blur-sm"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center gap-3">
                <TouchButton
                  onClick={handleBack}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:text-yellow-300"
                >
                  <ArrowLeft className="w-5 h-5" />
                </TouchButton>
              </div>
              
              <div className="flex items-center gap-4">
                <Timer onTimeUp={handleTimeUp} onExtend={handleTimeExtend} />
                <div className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1">
                  <span className="text-xs text-white/80 truncate hidden sm:inline">
                    {state.director.data?.ost}
                  </span>
                  <TouchButton
                    onClick={toggleSound}
                    variant="ghost"
                    size="sm"
                    className="relative text-white hover:text-yellow-300 !p-1"
                  >
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </TouchButton>
                </div>
                <TouchButton
                  onClick={() => { setEndModalType('all'); setShowEndModal(true); }}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:text-yellow-300"
                >
                  <RefreshCw className="w-5 h-5" />
                </TouchButton>
              </div>
            </motion.header>
            
            {/* Chat messages area */}
            <div className="chat-log flex-1 overflow-y-auto px-4 py-6 space-y-4 bg-black/30 backdrop-blur-sm">
              <AnimatePresence>
                {state.chat.messages.map((message) => (
                  <div key={`wrapper-${message.id}`} className="message-wrapper">
                    <ChatBubble
                      key={message.id}
                      message={message}
                      directorName={state.director.data?.nameKo}
                      directorAvatar={state.director.data?.avatar}
                      isTyping={false}
                    />
                  </div>
                ))}
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="flex gap-3"
                  >
                    <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {state.director.data?.avatar ? (
                        <img src={state.director.data.avatar} alt={state.director.data.name} className="w-full h-full object-cover" />
                      ) : (
                        <Film className="w-5 h-5 text-yellow-600" />
                      )}
                    </div>
                    <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md">
                      <TypingAnimation text={`${state.director.data?.nameKo} 감독이 생각 중`} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={chatEndRef} />
            </div>
            
            {/* Input area - Fixed at bottom */}
            <motion.div 
              className="chat-inputs flex-shrink-0 p-4 border-t border-white/20 bg-black/90 backdrop-blur-sm z-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {currentChoices.length > 0 && !isLoading && (
                <ChoiceButtons choices={currentChoices} onSelect={handleChoiceSelect} disabled={isLoading} />
              )}
              <form onSubmit={handleInputSubmit} className="flex gap-2 mt-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={isLoading ? "감독이 답변 중..." : "메시지를 입력하세요"}
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 border border-white/30 rounded-xl bg-white/10 backdrop-blur-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-yellow-400 disabled:bg-white/5 disabled:cursor-not-allowed"
                />
                <TouchButton
                  onClick={() => handleInputSubmit({ preventDefault: () => {} } as any)}
                  disabled={!inputValue.trim() || isLoading}
                  variant="primary"
                  size="md"
                  className="px-4"
                >
                  <Send className="w-5 h-5" />
                </TouchButton>
              </form>
            </motion.div>
          </div>
        </div>
      </div>
      
      {/* Modals */}
      <Modal isOpen={showDirectorInfo} onClose={() => setShowDirectorInfo(false)} title={`${state.director.data?.nameKo} 감독`} size="md">
        {/* ... modal content ... */}
      </Modal>
      <EndSessionModal isOpen={showEndModal} onClose={() => setShowEndModal(false)} onConfirm={handleEndSession} type={endModalType} />
    </div>
  )
}
