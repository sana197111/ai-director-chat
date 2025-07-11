// src/app/director/page.tsx

'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { DirectorCarousel } from '@/components/features/DirectorCarousel'
import { TouchButton } from '@/components/ui'
import { useApp } from '@/contexts/AppContext'
import { useToast } from '@/components/ui'
import { haptic } from '@/lib/haptic'

export default function DirectorSelectionPage() {
  const router = useRouter()
  const { state, actions } = useApp()
  const { showToast } = useToast()
  const [isNavigating, setIsNavigating] = useState(false)
  const hasInitialized = useRef(false)

  // 페이지 진입 시 감독 선택만 초기화 (채팅은 유지)
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true
      // 감독 선택 페이지 진입 시 감독 선택만 초기화
      console.log('감독 선택 페이지 진입 - 감독 선택만 초기화')
      actions.clearDirector() // 감독 선택만 초기화
      // resetChat()는 제거 - 각 감독별 채팅 기록은 유지
    }
  }, [actions])

  // 세션 체크 - 시나리오 완성되지 않으면 시나리오 페이지로
  useEffect(() => {
    // chat에서 왔을 경우를 위해 step 체크 조건 수정
    if (!state.scenario.completed && !isNavigating) {
      router.push('/scenario')
    } else if (state.session.currentStep === 'start' && !isNavigating) {
      router.push('/')
    }
  }, [state.scenario.completed, state.session.currentStep, router, isNavigating])

  const handleBack = () => {
    haptic.light()
    actions.setStep('scenario')
    router.push('/scenario')
  }

  const handleNext = () => {
    console.log('현재 선택된 감독:', state.director.selected)
    console.log('감독 데이터:', state.director.data)
    
    if (!state.director.selected) {
      showToast({
        message: '감독을 선택해주세요',
        type: 'warning'
      })
      haptic.warning()
      return
    }

    setIsNavigating(true)
    haptic.success()
    
    showToast({
      message: `${state.director.data?.nameKo} 감독님을 선택하셨습니다`,
      type: 'success'
    })

    setTimeout(() => {
      actions.setStep('chat')
      router.push('/chat')
    }, 500)
  }

  return (
    <div className="fullscreen-safe bg-black flex flex-col h-screen">
      {/* 배경 애니메이션 효과 */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-0 left-0 w-full h-full"
          animate={{
            background: [
              'radial-gradient(circle at 20% 80%, rgba(255, 255, 150, 0.1) 0%, transparent 50%)',
              'radial-gradient(circle at 80% 20%, rgba(255, 255, 200, 0.15) 0%, transparent 50%)',
              'radial-gradient(circle at 20% 80%, rgba(255, 255, 150, 0.1) 0%, transparent 50%)',
            ]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* 헤더 - 더 컴팩트하게 */}
      <motion.header
        className="relative z-20 flex-shrink-0 flex items-center justify-between p-3 md:p-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-1">
          <TouchButton
            onClick={handleBack}
            variant="ghost"
            size="sm"
            className="text-white h-8 px-2 text-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            뒤로
          </TouchButton>
        </div>

        {state.director.selected && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full"
          >
            <p className="text-white text-xs">
              선택: <span className="font-medium">{state.director.data?.nameKo}</span>
            </p>
          </motion.div>
        )}
      </motion.header>

      {/* 캐러셀 컨테이너 */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-2 min-h-0">
        <div className="w-full h-full max-w-6xl mx-auto flex items-center justify-center">
          <DirectorCarousel
            onSelect={(directorId) => {
              console.log('감독 선택됨:', directorId)
              // resetChat() 제거 - 각 감독별 채팅 기록 유지
              actions.selectDirector(directorId)
            }}
            selectedDirector={state.director.selected}
            onSelectionComplete={handleNext}
          />
        </div>
      </div>

      {/* 하단 네비게이션 - 더 컴팩트하게 */}
      <motion.div
        className="relative z-20 flex-shrink-0 p-3 md:p-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <div className="max-w-md mx-auto">
          <TouchButton
            onClick={handleNext}
            size="lg"
            variant="primary"
            fullWidth
            disabled={!state.director.selected}
            loading={isNavigating}
            className={`
              h-12 text-base
              transition-all duration-300
              ${state.director.selected 
                ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black' 
                : 'bg-gray-700 cursor-not-allowed text-white'
              }
            `}
          >
            <span className="flex items-center justify-center gap-2">
              다음 단계로
              <ArrowRight className="w-4 h-4" />
            </span>
          </TouchButton>
          
          {!state.director.selected && (
            <motion.p
              className="text-center text-white/60 text-xs mt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              감독을 선택하면 다음 단계로 진행할 수 있습니다
            </motion.p>
          )}
        </div>
      </motion.div>
    </div>
  )
}