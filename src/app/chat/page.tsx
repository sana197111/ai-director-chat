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
  const [showCastingMessage, setShowCastingMessage] = useState(false)

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
        
        let greeting
        if (selectedEmotion && selectedContent) {
          greeting = await generateInitialGreeting(
            director,
            { selectedEmotion, content: selectedContent }
          )
        } else {
          greeting = await generateInitialGreeting(
            director,
            ['', '', '', ''] as [string, string, string, string]
          )
        }
        
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

  /* ───────────────────────────── 15턴 체크 ────────────────────────────────── */

  useEffect(() => {
    // 15턴 도달 시 캐스팅 메시지
    if (state.chat.currentTurn >= 15 && !showCastingMessage && !timeUpHandled) {
      addCastingMessage()
      setTimeout(() => {
        setEndModalType('chat')
        setShowEndModal(true)
      }, 3000)
    }
  }, [state.chat.currentTurn])

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
        
        response = await generateDirectorResponse(
          state.director.selected!,
          scenarioArray,
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

  /* ───────────────────────────── 캐스팅 메시지 처리 ───────────────────────────────── */

  const addCastingMessage = () => {
    if (showCastingMessage) return
    setShowCastingMessage(true)
    
    const directorName = state.director.data?.nameKo || '감독'
    const castingMessage = `🎬 ${directorName} 감독님이 당신에게 깊은 인상을 받았습니다!\n\n"당신의 이야기와 감정 표현이 정말 인상적이었습니다. 우리 영화에 꼭 필요한 배우입니다. 함께 작품을 만들어보시겠습니까?"\n\n✨ 축하합니다! 캐스팅 제안을 받으셨습니다!\n\n다른 감독들도 당신을 기다리고 있습니다. 계속해서 새로운 이야기를 만들어보세요.`
    
    actions.addMessage({
      id: `casting-${Date.now()}`,
      role: 'system',
      content: castingMessage,
      timestamp: new Date()
    })
    
    haptic.success()
    showToast({ message: '🎬 캐스팅 제안을 받으셨습니다!', type: 'success' })
  }

  /* ───────────────────────────── 타이머 종료 ───────────────────────────────── */

  const handleTimeUp = () => {
    if (timeUpHandled) return
    setTimeUpHandled(true)
    
    // 먼저 캐스팅 메시지 추가
    addCastingMessage()
    
    // 작별 메시지 추가
    setTimeout(() => {
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
    }, 1500)
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
              className="flex-shrink-0 border-b border-white/20 bg-black/40 backdrop-blur-sm"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* 데스크톱 헤더 (1280px 이상) */}
              <div className="hidden xl:flex items-center justify-between p-4 gap-3">
                {/* 왼쪽: 다른 감독 버튼 */}
                <div className="flex-shrink-0 min-w-[120px]">
                  <TouchButton
                    onClick={handleBack}
                    variant="ghost"
                    size="sm"
                    className="text-white hover:text-yellow-300 !inline-flex !items-center !justify-center !gap-2 !px-3 !py-2 bg-white/5 rounded-xl border border-white/10 transition-all hover:bg-white/10"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="text-xs font-medium whitespace-nowrap">다른 감독</span>
                  </TouchButton>
                </div>

                {/* 중앙: 정보들 - flex-1로 남은 공간 차지 */}
                <div className="flex items-center gap-2 flex-1 justify-center min-w-0">
                  {/* 턴 카운터 */}
                  <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 flex-shrink-0">
                    <span className="text-xs text-white/70">대화</span>
                    <span className="text-base font-bold text-yellow-300">{state.chat.currentTurn}</span>
                    <span className="text-xs text-white/70">/15</span>
                  </div>
                  
                  {/* 타이머 */}
                  <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 flex-shrink-0">
                    <Timer onTimeUp={handleTimeUp} onExtend={handleTimeExtend} compact />
                  </div>

                  {/* OST 정보 - 화면 크기에 따라 숨김 */}
                  <div className="hidden min-[1400px]:flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 flex-shrink-0">
                    <span className="text-xs text-white/80 font-medium">
                      OST: {directorTheme?.ost && directorTheme.ost.length > 15 ? directorTheme.ost.substring(0, 15) + '...' : directorTheme?.ost}
                    </span>
                    <div className="w-px h-3.5 bg-white/20"></div>
                    <TouchButton
                      onClick={toggleSound}
                      variant="ghost"
                      size="sm"
                      className="text-white hover:text-yellow-300 !p-1 !flex !items-center !justify-center rounded-lg"
                    >
                      {isMuted ? (
                        <VolumeX className="w-3.5 h-3.5" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5" />
                      )}
                    </TouchButton>
                  </div>
                </div>

                {/* 오른쪽: 종료 버튼 */}
                <div className="flex-shrink-0 min-w-[80px]">
                  <TouchButton
                    onClick={() => {
                      if (state.chat.currentTurn >= 5 && !showCastingMessage) {
                        addCastingMessage()
                        setTimeout(() => {
                          setEndModalType('all')
                          setShowEndModal(true)
                        }, 2000)
                      } else {
                        setEndModalType('all')
                        setShowEndModal(true)
                      }
                    }}
                    variant="ghost"
                    size="sm"
                    className="text-white hover:text-yellow-300 !inline-flex !items-center !justify-center !gap-1.5 !px-3 !py-2 bg-white/5 rounded-xl border border-white/10 transition-all hover:bg-white/10"
                  >
                    <RefreshCw className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="text-xs font-medium whitespace-nowrap">종료</span>
                  </TouchButton>
                </div>
              </div>

              {/* 노트북 및 태블릿 헤더 (768px ~ 1279px) */}
              <div className="hidden md:flex xl:hidden items-center justify-between gap-2 p-3">
                {/* 왼쪽: 다른 감독 버튼 */}
                <div className="flex-shrink-0">
                  <TouchButton
                    onClick={handleBack}
                    variant="ghost"
                    size="sm"
                    className="text-white hover:text-yellow-300 !inline-flex !items-center !justify-center !gap-1 !px-2 !py-1.5 bg-white/5 rounded-lg border border-white/10 transition-all hover:bg-white/10"
                  >
                    <ArrowLeft className="w-3 h-3 flex-shrink-0" />
                    <span className="text-[10px] font-medium whitespace-nowrap hidden min-[900px]:inline">다른감독</span>
                    <span className="text-[10px] font-medium whitespace-nowrap min-[900px]:hidden">감독</span>
                  </TouchButton>
                </div>

                {/* 중앙: 정보들 - flex-1로 남은 공간 차지 */}
                <div className="flex items-center gap-1.5 flex-1 justify-center min-w-0">
                  {/* 턴 카운터 */}
                  <div className="flex items-center gap-0.5 bg-white/10 px-2 py-1 rounded-lg border border-white/10 flex-shrink-0">
                    <span className="text-[9px] text-white/70 hidden min-[900px]:inline">대화</span>
                    <span className="text-[11px] font-bold text-yellow-300">{state.chat.currentTurn}</span>
                    <span className="text-[9px] text-white/70">/15</span>
                  </div>

                  {/* 타이머 */}
                  <div className="bg-white/10 px-2 py-1 rounded-lg border border-white/10 flex-shrink-0">
                    <Timer onTimeUp={handleTimeUp} onExtend={handleTimeExtend} compact />
                  </div>

                  {/* OST - 큰 화면에서만 표시 */}
                  <div className="hidden min-[1024px]:flex items-center gap-1 bg-white/10 px-2 py-1 rounded-lg border border-white/10 flex-shrink-0">
                    <span className="text-[9px] text-white/80">OST</span>
                    <TouchButton
                      onClick={toggleSound}
                      variant="ghost"
                      size="sm"
                      className="text-white hover:text-yellow-300 !p-0.5 !flex !items-center !justify-center"
                    >
                      {isMuted ? (
                        <VolumeX className="w-2.5 h-2.5" />
                      ) : (
                        <Volume2 className="w-2.5 h-2.5" />
                      )}
                    </TouchButton>
                  </div>
                </div>

                {/* 오른쪽: 종료 버튼 */}
                <div className="flex-shrink-0">
                  <TouchButton
                    onClick={() => {
                      if (state.chat.currentTurn >= 5 && !showCastingMessage) {
                        addCastingMessage()
                        setTimeout(() => {
                          setEndModalType('all')
                          setShowEndModal(true)
                        }, 2000)
                      } else {
                        setEndModalType('all')
                        setShowEndModal(true)
                      }
                    }}
                    variant="ghost"
                    size="sm"
                    className="text-white hover:text-yellow-300 !inline-flex !items-center !justify-center !gap-1 !px-2 !py-1.5 bg-white/5 rounded-lg border border-white/10 transition-all hover:bg-white/10"
                  >
                    <RefreshCw className="w-3 h-3 flex-shrink-0" />
                    <span className="text-[10px] font-medium whitespace-nowrap">종료</span>
                  </TouchButton>
                </div>
              </div>

              {/* 모바일 헤더 */}
              <div className="flex md:hidden flex-col gap-3 p-3">
                {/* 첫 번째 줄: 네비게이션과 종료 */}
                <div className="flex items-center justify-between">
                  <TouchButton
                    onClick={handleBack}
                    variant="ghost"
                    size="sm"
                    className="text-white hover:text-yellow-300 !inline-flex !items-center !justify-center !gap-1.5 !px-2.5 !py-2 bg-white/5 rounded-lg border border-white/10"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="text-xs font-medium">다른 감독</span>
                  </TouchButton>

                  <TouchButton
                    onClick={() => {
                      if (state.chat.currentTurn >= 5 && !showCastingMessage) {
                        addCastingMessage()
                        setTimeout(() => {
                          setEndModalType('all')
                          setShowEndModal(true)
                        }, 2000)
                      } else {
                        setEndModalType('all')
                        setShowEndModal(true)
                      }
                    }}
                    variant="ghost"
                    size="sm"
                    className="text-white hover:text-yellow-300 !inline-flex !items-center !justify-center !gap-1.5 !px-2.5 !py-2 bg-white/5 rounded-lg border border-white/10"
                  >
                    <RefreshCw className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="text-xs font-medium">종료</span>
                  </TouchButton>
                </div>

                {/* 두 번째 줄: 정보들을 균등 분할 */}
                <div className="grid grid-cols-3 gap-2">
                  {/* 턴 정보 */}
                  <div className="flex flex-col items-center bg-white/10 px-2 py-1.5 rounded-lg border border-white/10">
                    <span className="text-xs text-white/70">대화</span>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-bold text-yellow-300">{state.chat.currentTurn}</span>
                      <span className="text-xs text-white/70">/15</span>
                    </div>
                  </div>

                  {/* 타이머 */}
                  <div className="flex items-center justify-center bg-white/10 px-2 py-1.5 rounded-lg border border-white/10">
                    <Timer onTimeUp={handleTimeUp} onExtend={handleTimeExtend} compact />
                  </div>

                  {/* OST/사운드 */}
                  <div className="flex flex-col items-center bg-white/10 px-2 py-1.5 rounded-lg border border-white/10">
                    <span className="text-xs text-white/70 truncate max-w-full">OST</span>
                    <TouchButton
                      onClick={toggleSound}
                      variant="ghost"
                      size="sm"
                      className="text-white hover:text-yellow-300 !p-1 !flex !items-center !justify-center"
                    >
                      {isMuted ? (
                        <VolumeX className="w-4 h-4" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </TouchButton>
                  </div>
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