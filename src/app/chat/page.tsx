// src/app/chat/page.tsx

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
  Film
} from 'lucide-react'
import {
  ChatBubble,
  ChoiceButtons
} from '@/components/features/ChatBubble'
import { Timer } from '@/components/features/Timer'
import { ScenarioDisplay, ScenarioStatusBadge } from '@/components/features/ScenarioDisplay'
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
import { ChatStorage, createAutoSave, getSessionRecoveryPrompt } from '@/lib/storage'
import type { Message, Choice, EmotionType } from '@/types'
import type { ConversationStage, ScenarioContext } from '@/lib/gemini'

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
  
  // 시나리오 컨텍스트 및 스테이지 관리
  const [conversationStage, setConversationStage] = useState<ConversationStage>('initial')
  const [scenarioContext, setScenarioContext] = useState<ScenarioContext | null>(null)
  const [finalScenario, setFinalScenario] = useState<string>('')
  const [sessionRestored, setSessionRestored] = useState(false)

  /* ───────────────────────────── 현재 선택지 가져오기 ─────────────────────────── */
  
  // 마지막 assistant 메시지의 choices를 가져오는 함수
  const getCurrentChoices = (): Choice[] => {
    const lastAssistantMessage = [...state.chat.messages]
      .reverse()
      .find(msg => msg.role === 'assistant' && msg.choices && msg.choices.length > 0)
    
    return lastAssistantMessage?.choices || []
  }
  
  // 스테이지 진행 헬퍼
  const getNextStage = (current: ConversationStage): ConversationStage => {
    const stages: ConversationStage[] = [
      'initial', 'detail_1', 'detail_2', 'detail_3', 
      'draft', 'feedback', 'final'
    ]
    const idx = stages.indexOf(current)
    return stages[Math.min(idx + 1, stages.length - 1)] as ConversationStage
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

  /* ───────────────────────────── 세션 복구 ──────────────────────────────────── */
  
  useEffect(() => {
    // 페이지 로드 시 세션 복구 시도
    if (!sessionRestored) {
      if (ChatStorage.hasSession()) {
        const savedSession = ChatStorage.load()
        if (savedSession && savedSession.director === state.director.selected) {
          const shouldRestore = window.confirm(getSessionRecoveryPrompt())
          
          if (shouldRestore) {
            // 메시지 복구
            savedSession.messages.forEach(msg => actions.addMessage(msg))
            
            // 컨텍스트 복구
            setScenarioContext(savedSession.scenarioContext)
            setConversationStage(savedSession.conversationStage)
            
            console.log('[Chat] Session restored from storage')
            showToast({ message: '이전 대화가 복구되었습니다', type: 'success' })
          } else {
            ChatStorage.clear()
          }
        }
      }
      // 세션 체크 완료 표시 (세션 유무와 관계없이)
      setSessionRestored(true)
    }
  }, [sessionRestored, state.director.selected, actions, showToast])

  /* ───────────────────────────── 자동 저장 ────────────────────────────────── */
  
  // 자동 저장 함수
  const autoSave = useCallback(
    createAutoSave(() => {
      if (state.chat.messages.length > 0 && state.director.selected) {
        ChatStorage.save({
          messages: state.chat.messages,
          scenarioContext,
          conversationStage,
          director: state.director.selected,
          turnCount: state.chat.currentTurn
        })
      }
    }, 2000), // 2초 디바운싱
    [state.chat.messages, state.director.selected, scenarioContext, conversationStage, state.chat.currentTurn]
  )
  
  // 상태 변경 시마다 자동 저장
  useEffect(() => {
    autoSave()
  }, [state.chat.messages, scenarioContext, conversationStage])

  /* ───────────────────────────── 초기 인사말 세팅 ─────────────────────────────── */

  useEffect(() => {
    const director = state.director.selected
    if (!director || !state.scenario.completed) return
    
    // 세션 복구가 완료되기 전에는 초기화 대기
    if (!sessionRestored) return

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
        // 선택된 감정과 컨텐츠 가져오기
        const selectedEmotion = state.scenario.selectedEmotion
        const selectedContent = selectedEmotion ? state.scenario.cuts[selectedEmotion] : ''
        
        let greeting
        
        // 시나리오가 있든 없든 항상 컨텍스트 초기화
        if (selectedEmotion && selectedContent && selectedContent.trim()) {
          // 실제 컨텐츠가 있는 경우
          greeting = await generateInitialGreeting(
            director,
            { selectedEmotion, content: selectedContent }
          )
          
          // 시나리오 컨텍스트 초기화
          setScenarioContext({
            originalStory: selectedContent,
            emotion: selectedEmotion,
            collectedDetails: {},
            currentStage: 'initial',
            previousMessages: []
          })
          setConversationStage('initial')
          console.log(`[Chat] Context initialized with story: ${selectedContent.substring(0, 50)}...`)
          
        } else {
          // 컨텐츠가 없는 경우 - 기본 스토리 사용
          const defaultStory = "오늘 제 이야기를 들어주세요"
          const defaultEmotion: EmotionType = 'joy'
          
          greeting = await generateInitialGreeting(
            director,
            { selectedEmotion: defaultEmotion, content: defaultStory }
          )
          
          // 기본 컨텍스트로 초기화
          setScenarioContext({
            originalStory: defaultStory,
            emotion: defaultEmotion,
            collectedDetails: {},
            currentStage: 'initial',
            previousMessages: []
          })
          setConversationStage('initial')
          console.log(`[Chat] Context initialized with default story`)
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
        // Fallback 사용 - 기본 컨텍스트도 설정
        if (!directorInitMap.current.get(director)) {
          const fallback = getInitialGreeting(director)
          actions.addMessage({
            id: `greeting-fallback-${director}-${Date.now()}`,
            role: 'assistant',
            content: fallback.message,
            timestamp: new Date(),
            choices: fallback.choices
          })
          
          // Fallback에서도 기본 컨텍스트 설정
          setScenarioContext({
            originalStory: "오늘 제 이야기를 들어주세요",
            emotion: 'joy',
            collectedDetails: {},
            currentStage: 'initial',
            previousMessages: []
          })
          setConversationStage('initial')
          
          directorInitMap.current.set(director, true)
          console.log(`[Chat] Director ${director} initialized with fallback`)
        }
      } finally {
        setIsTyping(false)
        isInitializing.current = false
      }
    }

    initializeChat()
  }, [state.director.selected, state.scenario.completed, state.scenario.selectedEmotion, state.scenario.cuts, actions, state.chat.messages, sessionRestored])

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

  /* ───────────────────────────── 20턴 체크 ────────────────────────────────── */

  useEffect(() => {
    // 20턴 도달 시 캐스팅 메시지
    if (state.chat.currentTurn >= 20 && !showCastingMessage && !timeUpHandled) {
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
    
    // "감독이 생각 중" 메시지를 약간 지연시켜서 자연스럽게 표시
    setTimeout(() => {
      setIsTyping(true)
    }, 800)

    // 에러 복구를 위한 재시도 로직
    const MAX_RETRIES = 3
    let retryCount = 0
    let lastError: Error | null = null
    
    let response: {
      message: string
      choices?: Choice[]
      error?: string
      scenario?: string
      casting?: string
      stage?: ConversationStage
    } | undefined

    while (retryCount <= MAX_RETRIES) {
      try {

      if (isOfflineMode) {
        await new Promise(r => setTimeout(r, 1200))
        const offline = getOfflineResponse(
          state.director.selected!,
          state.chat.currentTurn,
          content
        )
        response = { 
          ...offline, 
          stage: 'initial' as ConversationStage // 오프라인 모드에서는 initial stage 사용
        }
      } else {
        // 시나리오 컨텍스트가 있으면 새 시스템 사용
        if (scenarioContext) {
          // 현재 스테이지에 따라 다음 스테이지 결정
          let nextStage = conversationStage
          
          // 유연한 스테이지 진행 로직
          if (conversationStage === 'initial') {
            // 충분한 정보가 있으면 detail 단계 건너뛰기 가능
            const hasEnoughDetail = content.length > 100 || 
              content.includes('이야기') || content.includes('경험')
            nextStage = hasEnoughDetail ? 'detail_2' : 'detail_1'
          } else if (conversationStage.startsWith('detail')) {
            const currentDetail = parseInt(conversationStage.split('_')[1])
            // 사용자가 많은 정보를 제공하면 빠르게 진행
            const detailLevel = content.length > 150 ? 2 : 1
            const nextDetail = Math.min(currentDetail + detailLevel, 3)
            
            if (nextDetail >= 3 || state.chat.currentTurn >= 12) {
              // 충분한 디테일이 수집되었거나 대화가 길어지면 draft로
              nextStage = 'draft'
            } else {
              nextStage = `detail_${nextDetail}` as ConversationStage
            }
          } else if (conversationStage === 'draft') {
            // 사용자 피드백에 따라 결정
            const positiveWords = ['좋', '완벽', '마음에', '최고', '감동', '멋']
            const negativeWords = ['아니', '다시', '수정', '변경', '별로']
            
            const hasPositive = positiveWords.some(word => content.includes(word))
            const hasNegative = negativeWords.some(word => content.includes(word))
            
            if (hasPositive && !hasNegative) {
              nextStage = 'final'
            } else if (hasNegative || content.length > 50) {
              nextStage = 'feedback'
            } else {
              // 짧고 중립적인 응답은 추가 확인
              nextStage = 'feedback'
            }
          } else if (conversationStage === 'feedback') {
            nextStage = 'final'
          }
          
          // 디테일 수집 - detail 단계에서만
          const updatedDetails = { ...scenarioContext.collectedDetails }
          if (conversationStage.startsWith('detail')) {
            const detailKey = `detail_${conversationStage.split('_')[1]}`
            updatedDetails[detailKey] = content
          }
          
          const updatedContext: ScenarioContext = {
            ...scenarioContext,
            currentStage: nextStage,
            collectedDetails: updatedDetails,
            previousMessages: [...scenarioContext.previousMessages, 
              { role: 'user', content: content }
            ],
            // draft 단계에서 생성된 시나리오 보존
            draftScenario: scenarioContext.draftScenario
          }
          
          console.log(`[Chat] Stage transition: ${conversationStage} -> ${nextStage}`)
          console.log(`[Chat] Collected details:`, updatedDetails)
          
          response = await generateDirectorResponse(
            state.director.selected!,
            updatedContext
          )
          
          // 시나리오가 생성되면 저장
          if (response.scenario) {
            updatedContext.draftScenario = response.scenario
            console.log(`[Chat] Scenario generated at stage ${nextStage}`)
          }
          
          // 컨텍스트와 스테이지 업데이트
          setScenarioContext(updatedContext)
          setConversationStage(nextStage)
          
          // 최종 시나리오 저장
          if (response.scenario && nextStage === 'final') {
            setFinalScenario(response.scenario)
            console.log(`[Chat] Final scenario saved`)
          }
          
        } else {
          // 컨텍스트가 없는 경우 - 초기화 시도
          console.warn('[Chat] No scenario context, initializing default')
          
          const defaultContext: ScenarioContext = {
            originalStory: content,
            emotion: 'joy' as EmotionType,
            collectedDetails: {},
            currentStage: 'detail_1',
            previousMessages: [{ role: 'user', content: content }]
          }
          
          setScenarioContext(defaultContext)
          setConversationStage('detail_1')
          
          response = await generateDirectorResponse(
            state.director.selected!,
            defaultContext
          )
        }
      }

      // 응답 메시지 추가
      if (response) {
        actions.addMessage({
          id: `msg-assistant-${Date.now()}`,
          role: 'assistant',
          content: response.message,
          timestamp: new Date(),
          choices: response.choices || []
        })

        console.log(`[Chat] Assistant response added:`)
        console.log(`  - Stage: ${conversationStage}`)
        console.log(`  - Choices: ${response.choices?.length || 0}`)
        console.log(`  - Has scenario: ${!!response.scenario}`)

      }
      
      // 성공시 재시도 루프 종료
      break
      
    } catch (e) {
      console.error(`[Chat] Error generating response (attempt ${retryCount + 1}):`, e)
      lastError = e as Error
      retryCount++
      
      // 재시도 가능한 경우
      if (retryCount <= MAX_RETRIES) {
        // 지수 백오프로 대기
        const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000)
        console.log(`[Chat] Retrying in ${delay}ms...`)
        
        showToast({
          message: `연결 재시도 중... (${retryCount}/${MAX_RETRIES})`,
          type: 'info'
        })
        
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      
      // 모든 재시도 실패 시 오프라인 모드로 폴백
      console.error('[Chat] All retries failed, switching to offline mode')
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
      break
    }
    } // while 루프 종료
    
    // finally 블록에 해당하는 정리 작업
    try {
      setIsTyping(false)
      setIsLoading(false)
      lastUserActionRef.current = null
    } catch {} // 정리 작업 중 에러 무시
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
    
    // 로컬 상태 초기화
    setIsLoading(false);
    setIsTyping(false);
    setInputValue('');
    setTimeUpHandled(false);
    setShowCastingMessage(false);
    isInitializing.current = false;
    lastUserActionRef.current = null;
    
    // 로컬 스토리지 초기화
    localStorage.clear();
    ChatStorage.clear(); // ChatStorage도 명시적으로 초기화
    
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
                    <span className="text-xs text-white/70">/20</span>
                  </div>
                  
                  {/* 시나리오 상태 배지 */}
                  {scenarioContext && (
                    <ScenarioStatusBadge 
                      stage={conversationStage}
                      hasScenario={!!scenarioContext.draftScenario || !!finalScenario}
                    />
                  )}
                  
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
                      <span className="text-xs text-white/70">/20</span>
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
              {/* 시나리오 상태 표시 */}
              {scenarioContext && (
                <ScenarioDisplay
                  stage={conversationStage}
                  scenario={scenarioContext.draftScenario || finalScenario}
                  originalStory={scenarioContext.originalStory}
                  className="mb-4 sticky top-0 z-10"
                />
              )}
              
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
                    <div className="w-10 h-10 rounded-full bg-yellow-100 flex-shrink-0 overflow-hidden">
                      {directorTheme?.avatar ? (
                        <img
                          src={directorTheme.avatar}
                          alt={directorTheme.nameKo}
                          className="w-full h-full object-cover rounded-full"
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