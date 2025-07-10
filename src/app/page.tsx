'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Film, Sparkles, ChevronRight } from 'lucide-react'
import { TouchButton } from '@/components/ui'
import { useApp } from '@/contexts/AppContext'
import { haptic } from '@/lib/haptic'

export default function StartPage() {
  const router = useRouter()
  const { state, actions } = useApp()
  const [isLoading, setIsLoading] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)

  // 자동으로 세션 초기화
  useEffect(() => {
    if (typeof window !== 'undefined' && !state.session.id) {
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      actions.initSession(newSessionId)
    }
  }, [state.session.id, actions])

  const handleStart = async () => {
    setIsLoading(true)
    haptic.medium()
    
    // 환영 메시지 표시
    setShowWelcome(true)
    
    // 부드러운 전환을 위한 딜레이
    setTimeout(() => {
      actions.setStep('scenario')
      router.push('/scenario')
    }, 1500)
  }

  return (
    <div className="fullscreen-safe flex flex-col items-center justify-center bg-black min-h-screen">
      {/* 배경 효과 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-yellow-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-15 animate-blob animation-delay-4000"></div>
      </div>

      <AnimatePresence mode="wait">
        {!showWelcome ? (
          <motion.div
            key="start"
            className="relative z-10 text-center px-8 max-w-2xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            {/* 로고 영역 */}
            <motion.div
              className="mb-12 flex justify-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5, type: "spring" }}
            >
              <div className="relative">
                <div className="absolute inset-0 bg-white/20 blur-xl rounded-full"></div>
                <Film className="w-24 h-24 text-white relative z-10" />
                <motion.div
                  className="absolute -top-2 -right-2"
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                >
                  <Sparkles className="w-8 h-8 text-yellow-400" />
                </motion.div>
              </div>
            </motion.div>

            {/* 타이틀 */}
            <motion.h1
              className="text-4xl md:text-5xl font-semibold text-white mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              거장과의 대화
            </motion.h1>

            {/* 서브타이틀 */}
            <motion.p
              className="text-lg md:text-xl text-white/80 mb-12 font-normal leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              거장 감독과 함께 인생 My컷을 나누고
              <br />
              맞춤형 연출 조언을 받아보세요
            </motion.p>

            {/* 채팅 예시 */}
            <motion.div
              className="mb-12 max-w-lg mx-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-white/20 overflow-hidden flex-shrink-0">
                        <img 
                          src="/images/directors/bong.jpg" 
                          alt="봉준호 감독"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-white/60 text-xs mt-1 text-center whitespace-nowrap">봉준호 감독</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="bg-white/20 backdrop-blur-sm rounded-xl rounded-bl-md p-4">
                        <p className="text-white text-sm leading-relaxed text-left">
                          당신의 인생 My컷을 보니 흥미로운 이야기가 많네요. <span className="whitespace-nowrap">어떤 장면을 더</span> 발전시켜볼까요?
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="max-w-[75%]">
                      <div className="bg-yellow-500/90 rounded-xl px-4 py-3">
                        <p className="text-black text-sm">
                          첫 번째 장면을 더 드라마틱하게 만들고 싶어요!
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* 시작 버튼 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.9, duration: 0.5, type: "spring" }}
            >
              <TouchButton
                onClick={handleStart}
                size="lg"
                variant="primary"
                className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black px-8 py-3 shadow-xl font-medium rounded-xl"
                loading={isLoading}
              >
                <span className="flex items-center gap-2">
                  대화 시작하기
                  <ChevronRight className="w-4 h-4" />
                </span>
              </TouchButton>
            </motion.div>

          </motion.div>
        ) : (
          <motion.div
            key="welcome"
            className="relative z-10 text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, type: "spring" }}
            >
              <div className="w-32 h-32 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-6">
                <Film className="w-16 h-16 text-white" />
              </div>
            </motion.div>
            
            <motion.h2
              className="text-3xl font-bold text-white mb-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              환영합니다!
            </motion.h2>
            
            <motion.p
              className="text-xl text-yellow-200"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              감독님을 만나러 가볼까요?
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  )
}