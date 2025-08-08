// src/app/chat/page.tsx

'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  RefreshCw,
  Volume2,
  VolumeX,
  Send,
  Film
} from 'lucide-react'
import {
  ChatBubble,
  ChoiceButtons
} from '@/components/features/ChatBubble'
import { Timer } from '@/components/features/Timer'
import {
  TouchButton,
  Modal,
  TypingAnimation,
  useToast
} from '@/components/ui'
import { EndSessionModal } from '@/components/features/SessionExpiryModal'
import { useApp } from '@/contexts/AppContext'
import { haptic } from '@/lib/haptic'
import {
  generateDirectorResponse,
  generateInitialGreeting,
  getInitialGreeting,
  getFarewellMessage
} from '@/lib/gemini'
import {
  getOfflineResponse,
  isOnline,
  getOfflineModeMessage
} from '@/lib/offlineResponses'
import type { Message, Choice } from '@/types'

export default function ChatPage() {
  const router = useRouter()
  const { state, actions } = useApp()
  const { showToast } = useToast()

  // refs
  const chatEndRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const directorInitMap = useRef<Map<string, boolean>>(new Map())
  const isInitializing = useRef(false)
  const lastUserActionRef = useRef<'choice' | 'input' | null>(null)

  // local state
  const [isLoading, setIsLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isMuted, setIsMuted] = useState(false)
  const [showEndModal, setShowEndModal] = useState(false)
  const [endModalType, setEndModalType] = useState<'chat' | 'all'>('chat')
  const [isOfflineMode, setIsOfflineMode] = useState(!isOnline())
  const [showDirectorInfo, setShowDirectorInfo] = useState(false)
  const [timeUpHandled, setTimeUpHandled] = useState(false)

  /* ───────────────────────────── 현재 선택지 가져오기 ─────────────────────────── */
  
  // 마지막 assistant 메시지의 choices를 가져오는 함수
  const getCurrentChoices = (): Choice[] => {
    const lastAssistantMessage = [...state.chat.messages]
      .reverse()
      .find(msg => msg.role === 'assistant' && msg.choices && msg.choices.length > 0)
    
    return lastAssistantMessage?.choices || []
  }

  /* ───────────────────────────── 세션 / 초기 진입 체크 ─────────────────────────── */

  useEffect(() => {
    if (
      state.session.currentStep !== 'chat' ||
      !state.director.selected ||
      !state.scenario.completed
    ) {
      router.push('/scenario')
    }
  }, [state.session.currentStep, state.director.selected, state.scenario.completed, router])

  /* ───────────────────────────── 초기 인사말 세팅 ─────────────────────────────── */

  useEffect(() => {
    const director = state.director.selected
    if (!director || !state.scenario.completed) return

    // 이미 초기화되었는지 확인
    if (directorInitMap.current.get(director)) {
      console.log(`[Chat] Director ${director} already initialized`)
      return
    }

    // 이미 해당 감독의 메시지가 있는지 확인
    const hasDirectorMessages = state.chat.messages.some(msg => 
      msg.id.includes(director)
    )
    if (hasDirectorMessages) {
      console.log(`[Chat] Director ${director} has existing messages`)
      directorInitMap.current.set(director, true)
      return
    }

    // 초기화 진행 중인지 확인
    if (isInitializing.current) {
      console.log(`[Chat] Initialization already in progress`)
      return
    }

    // 초기화 시작
    console.log(`[Chat] Initializing director ${director}`)
    isInitializing.current = true
    setIsTyping(true)

    const initializeChat = async () => {
      try {
        // 선택된 감정과 컨텐츠 전달
        const selectedEmotion = state.scenario.selectedEmotion
        const selectedContent = selectedEmotion ? state.scenario.cuts[selectedEmotion] : ''
        
        const greeting = await generateInitialGreeting(
          director,
          selectedEmotion && selectedContent ? 
            { selectedEmotion, content: selectedContent } : 
            ['', '', '', ''] as [string, string, string, string] // 폴백
        )
        
        // 다시 한번 체크 (비동기 처리 중 상태가 변했을 수 있음)
        if (!directorInitMap.current.get(director)) {
          actions.addMessage({
            id: `greeting-${director}-${Date.now()}`,
            role: 'assistant',
            content: greeting.message,
            timestamp: new Date(),
            choices: greeting.choices
          })
          directorInitMap.current.set(director, true)
          console.log(`[Chat] Director ${director} initialized with AI greeting`)
        }
      } catch (error) {
        console.error('[Chat] Failed to generate AI greeting:', error)
        // Fallback 사용
        if (!directorInitMap.current.get(director)) {
          const fallback = getInitialGreeting(director)
          actions.addMessage({
            id: `greeting-fallback-${director}-${Date.now()}`,
            role: 'assistant',
            content: fallback.message,
            timestamp: new Date(),
            choices: fallback.choices
          })
          directorInitMap.current.set(director, true)
          console.log(`[Chat] Director ${director} initialized with fallback greeting`)
        }
      } finally {
        setIsTyping(false)
        isInitializing.current = false
      }
    }

    initializeChat()
  }, [state.director.selected, state.scenario.completed, state.scenario.selectedEmotion, state.scenario.cuts, actions, state.chat.messages])

  /* ───────────────────────────── 네트워크 상태 ──────────────────────────────── */

  useEffect(() => {
    const goOnline = () => {
      setIsOfflineMode(false)
      showToast({ message: '온라인 상태로 전환되었습니다', type: 'success' })
    }
    const goOffline = () => {
      setIsOfflineMode(true)
      showToast({ message: getOfflineModeMessage(), type: 'warning' })
    }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [showToast])

  /* ───────────────────────────── 오토 스크롤 ────────────────────────────────── */

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.chat.messages])

  /* ───────────────────────────── BGM 관리 ──────────────────────────────────── */

  useEffect(() => {
    if (!state.director.data || !audioRef.current) return

    audioRef.current.src = `/sounds/bgm/${state.director.selected}.mp3`
    audioRef.current.loop = true
    audioRef.current.volume = 0.3
    const onCanPlay = () => !isMuted && audioRef.current?.play().catch(() => { })
    audioRef.current.addEventListener('canplay', onCanPlay)
    return () => {
      audioRef.current?.pause()
      audioRef.current?.removeEventListener('canplay', onCanPlay)
    }
  }, [state.director.data, state.director.selected, isMuted])

  const toggleSound = () => {
    setIsMuted(p => !p)
    if (audioRef.current) {
      isMuted ? audioRef.current.play() : audioRef.current.pause()
    }
    haptic.light()
  }

  /* ───────────────────────────── 메시지 전송 ────────────────────────────────── */

  const sendMessage = async (content: string, source: 'choice' | 'input' = 'input') => {
    if (!content.trim() || isLoading) return

    // 사용자 액션 추적
    lastUserActionRef.current = source
    console.log(`[Chat] User action: ${source}, content: ${content}`)

    const userMsg: Message = {
      id: `msg-user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date()
    }
    
    actions.addMessage(userMsg)
    setInputValue('')
    setIsLoading(true)
    setIsTyping(true)

    try {
      let response: {
        message: string
        choices?: Choice[]
        error?: string
      }

      if (isOfflineMode) {
        await new Promise(r => setTimeout(r, 1200))
        const offline = getOfflineResponse(
          state.director.selected!,
          state.chat.currentTurn,
          content
        )
        response = { ...offline, error: undefined }
      } else {
        // 선택된 감정과 컨텐츠 전달
        const selectedEmotion = state.scenario.selectedEmotion
        const selectedContent = selectedEmotion ? state.scenario.cuts[selectedEmotion] : ''
        
        response = await generateDirectorResponse(
          state.director.selected!,
          selectedEmotion && selectedContent ? 
            { selectedEmotion, content: selectedContent } : 
            ['', '', '', ''] as [string, string, string, string], // 폴백
          content,
          state.chat.messages.map(m => ({ role: m.role, content: m.content }))
        )
      }

      // 응답 메시지 추가
      actions.addMessage({
        id: `msg-assistant-${Date.now()}`,
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        choices: response.choices || []
      })

      console.log(`[Chat] Assistant response added with ${response.choices?.length || 0} choices`)

      if (!isOfflineMode && response.error) {
        showToast({
          message: 'AI 응답 처리 중 일부 오류가 발생했지만 대화는 계속됩니다.',
          type: 'warning'
        })
      }
    } catch (e) {
      console.error('[Chat] Error generating response:', e)
      setIsOfflineMode(true)
      const off = getOfflineResponse(
        state.director.selected!,
        state.chat.currentTurn,
        content
      )
      actions.addMessage({
        id: `msg-offline-${Date.now()}`,
        role: 'assistant',
        content: off.message,
        timestamp: new Date(),
        choices: off.choices || []
      })
      showToast({ message: '네트워크 오류로 오프라인 모드 전환', type: 'warning' })
    } finally {
      setIsTyping(false)
      setIsLoading(false)
      lastUserActionRef.current = null
    }
  }

  /* ───────────────────────────── 타이머 종료 ───────────────────────────────── */

  const handleTimeUp = () => {
    if (timeUpHandled) return
    setTimeUpHandled(true)
    haptic.error()
    actions.addMessage({
      id: `farewell-${Date.now()}`,
      role: 'system',
      content: getFarewellMessage(state.director.selected!),
      timestamp: new Date()
    })
    showToast({ message: '대화 시간이 종료되었습니다', type: 'info' })
    setTimeout(() => {
      setEndModalType('chat')
      setShowEndModal(true)
    }, 2000)
  }

  const handleTimeExtend = () =>
    showToast({ message: '3분이 추가되었습니다! ⏰', type: 'success' })

  /* ───────────────────────────── 기타 핸들러 ───────────────────────────────── */

  const handleBack = () => {
    haptic.light();
    // 대화는 그대로 두고 감독 선택 화면으로만 이동
    // 현재 감독의 초기화 상태는 유지
    router.push('/director');
  };

  const handleEndSession = () => {
    haptic.heavy();
    setShowEndModal(false);
    setTimeout(() => {
      if (endModalType === 'chat') {
        // 'chat' 타입일 때는 채팅만 리셋하고 감독 선택 화면으로
        actions.resetChat();
        // 초기화 맵도 클리어
        directorInitMap.current.clear();
        setTimeUpHandled(false);
        actions.setStep('director');
        router.push('/director');
      } else {
        // 'all' 타입일 때는 전체 리셋
        actions.resetAll();
        directorInitMap.current.clear();
        router.push('/');
      }
    }, 150)
  }

  /* ───────────────────────────── 렌더 ──────────────────────────────────────── */

  const directorTheme = state.director.data
  const currentChoices = getCurrentChoices()

  return (
    <div className="fullscreen-safe flex flex-col h-screen bg-black">
      {/* hidden audio */}
      <audio ref={audioRef} />

      <div className="flex flex-1 min-h-0">
        {/* ── 좌측 감독 비디오 + 정보 ───────────────────────── */}
        <motion.div
          className="hidden md:flex flex-col flex-shrink-0 relative overflow-hidden"
          style={{ width: '45%', minWidth: 400, maxWidth: 600 }}
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="flex-1 w-full h-full">
            {directorTheme?.avatar ? (
              <video
                src={`/videos/${state.director.selected}.mp4`}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-black">
                <Film className="w-48 h-48 text-white/60" />
              </div>
            )}
          </div>

          {/* 감독 정보 – 화면 하단 고정 */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/80 to-transparent"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-4 text-white">
              <h3 className="text-xl font-bold mb-1">
                {directorTheme?.nameKo}
              </h3>
              <p className="text-sm text-white/80 mb-3">
                {directorTheme?.title}
              </p>
              <div className="flex flex-wrap gap-1">
                {directorTheme?.films.slice(0, 2).map((f, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-white/20 rounded-full text-xs"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* ── 우측 채팅 패널 ──────────────────────────────── */}
        <div
          className="flex-1 flex flex-col relative overflow-hidden min-h-0"
          style={{ background: directorTheme?.themeColor || '#1f2937' }}
        >
          {/* 배경 비디오 / 그라데이션 */}
          <div className="absolute inset-0 overflow-hidden">
            {directorTheme?.avatar ? (
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
                style={{ background: directorTheme?.bgGradient }}
              />
            )}
          </div>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />

          {/* ── 채팅 내부 ─────────────────────────────── */}
          <div className="relative z-10 flex flex-col flex-1 min-h-0">

            {/* 헤더 (고정) */}
            <motion.header
              className="flex-shrink-0 flex items-center justify-between p-4 border-b border-white/20 bg-black/40 backdrop-blur-sm overflow-hidden"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex-shrink-0">
                <TouchButton
                  onClick={handleBack}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:text-yellow-300 !inline-flex !items-center !justify-center !gap-2 !px-3 !py-2 !w-auto !min-w-0 !flex-shrink-0 !whitespace-nowrap"
                >
                  <ArrowLeft className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm font-medium inline-block">다른 감독이랑 대화하기</span>
                </TouchButton>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <Timer onTimeUp={handleTimeUp} onExtend={handleTimeExtend} />
                <div className="flex items-center justify-center gap-2 bg-white/10 px-3 py-1 rounded-full">
                  <span className="hidden sm:inline text-xs text-white/80 truncate">
                    {directorTheme?.ost}
                  </span>
                  <TouchButton
                    onClick={toggleSound}
                    variant="ghost"
                    size="sm"
                    className="text-white hover:text-yellow-300 !p-1 !flex !items-center !justify-center"
                  >
                    {isMuted ? (
                      <VolumeX className="w-5 h-5" />
                    ) : (
                      <Volume2 className="w-5 h-5" />
                    )}
                  </TouchButton>
                </div>
                <div className="flex-shrink-0">
                  <TouchButton
                    onClick={() => { setEndModalType('all'); setShowEndModal(true) }}
                    variant="ghost"
                    size="sm"
                    className="text-white hover:text-yellow-300 !inline-flex !items-center !justify-center !gap-2 !px-3 !py-2 !w-auto !min-w-0 !flex-shrink-0 !whitespace-nowrap"
                  >
                    <RefreshCw className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs font-medium inline-block">종료하기</span>
                  </TouchButton>
                </div>
              </div>
            </motion.header>

            {/* 채팅 로그 (스크롤 영역) */}
            <div className="flex-1 overflow-y-auto px-4 py-6 pb-32 space-y-4 bg-black/25 backdrop-blur-sm min-h-0">
              <AnimatePresence>
                {state.chat.messages.map(m => (
                  <ChatBubble
                    key={m.id}
                    message={m}
                    directorName={directorTheme?.nameKo}
                    directorAvatar={directorTheme?.avatar}
                    isTyping={false}
                  />
                ))}

                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="flex gap-3"
                  >
                    <div className="w-10 h-10 rounded-full bg-yellow-100 flex-shrink-0">
                      {directorTheme?.avatar ? (
                        <img
                          src={directorTheme.avatar}
                          alt={directorTheme.nameKo}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Film className="w-5 h-5 text-yellow-600 m-auto" />
                      )}
                    </div>
                    <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md">
                      <TypingAnimation text={`${directorTheme?.nameKo} 감독이 생각 중`} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={chatEndRef} />
            </div>

            {/* 입력 영역 (고정) */}
            <motion.div
              className="flex-shrink-0 p-4 border-t border-white/20 bg-black/80 backdrop-blur-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {currentChoices.length > 0 && !isLoading && (
                <ChoiceButtons
                  choices={currentChoices}
                  onSelect={c => sendMessage(c.text, 'choice')}
                  disabled={isLoading}
                />
              )}
              <form
                onSubmit={e => { e.preventDefault(); sendMessage(inputValue, 'input') }}
                className="flex gap-2 mt-2"
              >
                <input
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  placeholder={isLoading ? '감독이 답변 중...' : '메시지를 입력하세요'}
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 text-white bg-white/10 border border-white/30 rounded-xl placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-yellow-400 disabled:bg-white/5"
                />
                <TouchButton
                  onClick={() => sendMessage(inputValue, 'input')}
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

      {/* 감독 상세 모달 */}
      <Modal
        isOpen={showDirectorInfo}
        onClose={() => setShowDirectorInfo(false)}
        title={`${directorTheme?.nameKo} 감독`}
        size="md"
      >
        {directorTheme && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {directorTheme.avatar && (
                <img
                  src={directorTheme.avatar}
                  alt={directorTheme.nameKo}
                  className="w-16 h-16 rounded-full object-cover"
                />
              )}
              <div>
                <h4 className="text-lg font-semibold">{directorTheme.nameKo}</h4>
                <p className="text-sm text-gray-400">{directorTheme.title}</p>
              </div>
            </div>
            <div>
              <h5 className="text-sm font-medium text-gray-300">대표 작품</h5>
              <ul className="list-disc list-inside text-gray-200">
                {directorTheme.films.map((film, idx) => (
                  <li key={idx}>{film}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Modal>

      {/* 세션 종료 모달 */}
      <EndSessionModal
        isOpen={showEndModal}
        onClose={() => setShowEndModal(false)}
        onConfirm={handleEndSession}
        type={endModalType}
      />
    </div>
  )
}