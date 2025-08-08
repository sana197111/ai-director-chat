// +// src/app/scenario/page.tsx

'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Info, ChevronRight } from 'lucide-react'
import { FilmStrip } from '@/components/features/FilmStrip'
import { TouchButton, useToast } from '@/components/ui'
import { useApp } from '@/contexts/AppContext'
import { haptic } from '@/lib/haptic'

export default function ScenarioInputPage() {
  const router = useRouter()
  const { state, actions } = useApp()
  const { showToast } = useToast()
  const [isNavigating, setIsNavigating] = useState(false)
  const [showTips, setShowTips] = useState(true)

  // 세션 체크
  useEffect(() => {
    if (state.session.currentStep !== 'scenario' && !isNavigating) {
      router.push('/')
    }
  }, [state.session.currentStep, router, isNavigating])

  const handleBack = () => {
    haptic.light()
    actions.setStep('start')
    router.push('/')
  }

  const handleNext = () => {
    if (!state.scenario.completed) {
      showToast({
        message: '선택한 감정의 장면을 작성해주세요',
        type: 'warning'
      })
      haptic.warning()
      return
    }

    setIsNavigating(true)
    haptic.success()
    
    showToast({
      message: '인생 My컷 입력이 완성되었습니다!',
      type: 'success'
    })

    setTimeout(() => {
      actions.setStep('director')
      router.push('/director')
    }, 500)
  }

  const directorTheme = state.director.data ? {
    color: state.director.data.themeColor,
    gradient: state.director.data.bgGradient
  } : undefined

  const handleCompleteScenario = useCallback(() => {
    actions.completeScenario()
  }, [actions])

  return (
    <div className="fullscreen-safe bg-gradient-to-br from-gray-900 via-black to-gray-800 min-h-screen">
      {/* 배경 효과 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse animation-delay-4000"></div>
      </div>
      {/* 헤더 */}
      <motion.header
        className="relative z-10 flex items-center justify-between p-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <TouchButton
          onClick={handleBack}
          variant="ghost"
          size="sm"
          className="text-white hover:text-yellow-400"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          이전
        </TouchButton>

        {/* 진행 상태 */}
        <div className="flex items-center gap-2 text-sm text-white/70">
          <div className="flex items-center gap-1 text-yellow-400 font-medium">
            <div className="w-6 h-6 rounded-full bg-yellow-500 text-black flex items-center justify-center text-xs font-bold">
              1
            </div>
            <span>인생 My컷</span>
          </div>
          <ChevronRight className="w-4 h-4" />
          <div className="flex items-center gap-1">
            <div className="w-6 h-6 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center text-xs">
              2
            </div>
            <span>감독 선택</span>
          </div>
          <ChevronRight className="w-4 h-4" />
          <div className="flex items-center gap-1">
            <div className="w-6 h-6 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center text-xs">
              3
            </div>
            <span>대화</span>
          </div>
        </div>
      </motion.header>

      {/* 메인 콘텐츠 */}
      <main className="relative z-10 flex-1 px-6 pb-6">

        {/* 안내 메시지 */}
        <AnimatePresence>
          {showTips && (
            <motion.div
              className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-medium text-blue-900 mb-1">1부스에서 작성한 인생 My컷을 입력해주세요</h3>
                  <p className="text-sm text-blue-700 mb-3">
                    오늘 가장 이야기하고 싶은 감정을 하나 선택하여 그 장면을 작성해주세요.
                    감독님이 이를 바탕으로 맞춤형 연출 조언을 드립니다.
                  </p>
                  <div className="text-xs text-blue-600 mb-2">
                    <strong>예시:</strong> “5세, 첫 자전거를 타며 넘어졌지만 웃으며 일어났던 기억”
                  </div>
                  <div className="text-xs text-blue-600 mb-2">
                    <strong>작성 팁:</strong> 몇 살 때 어떤 상황에서 무엇을 느꼈는지 구체적으로 자세히 적어주세요.
                  </div>
                  <button
                    onClick={() => setShowTips(false)}
                    className="text-xs text-blue-600 underline"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 필름 스트립 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <FilmStrip
            selectedEmotion={state.scenario.selectedEmotion}
            cuts={state.scenario.cuts}
            onSelectEmotion={actions.selectEmotion}
            onUpdate={actions.updateScenario}
            onComplete={handleCompleteScenario}
            directorTheme={directorTheme}
          />
        </motion.div>

        {/* 다음 버튼 */}
        <motion.div
          className="mt-8 flex justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <TouchButton
            onClick={handleNext}
            variant="primary"
            size="lg"
            disabled={!state.scenario.completed || isNavigating}
            loading={isNavigating}
            className="px-8"
          >
            <span className="flex items-center gap-2">
감독 선택하기
              <ArrowRight className="w-5 h-5" />
            </span>
          </TouchButton>
        </motion.div>
      </main>
    </div>
  )
}