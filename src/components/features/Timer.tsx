'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Plus, AlertCircle, X } from 'lucide-react'
import { useApp } from '@/contexts/AppContext'
import { haptic } from '@/lib/haptic'

interface TimerProps {
  onTimeUp: () => void
  onExtend: () => void
}

export const Timer: React.FC<TimerProps> = ({ onTimeUp, onExtend }) => {
  const { state, actions } = useApp()
  const [showWarning, setShowWarning] = useState(false)
  const [isPulsing, setIsPulsing] = useState(false)
  const [timeUpCalled, setTimeUpCalled] = useState(false) // 시간 종료 처리 플래그

  const minutes = Math.floor(state.chat.timeRemaining / 60)
  const seconds = state.chat.timeRemaining % 60
  const totalMinutes = 10 + (state.chat.extensionCount * 3)
  const progress = (state.chat.timeRemaining / (totalMinutes * 60)) * 100

  useEffect(() => {
    if (state.chat.timeRemaining <= 0) {
      // 한 번만 호출하도록 플래그 체크
      if (!timeUpCalled) {
        console.log('Timer: 시간 종료, onTimeUp 호출')
        setTimeUpCalled(true)
        onTimeUp()
      }
      return
    }

    // 시간이 남아있으면 플래그 리셋 (시간 연장 등의 경우)
    if (state.chat.timeRemaining > 0 && timeUpCalled) {
      console.log('Timer: 시간 연장됨, 플래그 리셋')
      setTimeUpCalled(false)
    }

    const timer = setInterval(() => {
      actions.updateTime(state.chat.timeRemaining - 1)
    }, 1000)

    // 1분 남았을 때 경고
    if (state.chat.timeRemaining === 60) {
      setShowWarning(true)
      setIsPulsing(true)
      haptic.warning()
    }

    // 30초 남았을 때 강한 경고
    if (state.chat.timeRemaining === 30) {
      haptic.error()
    }

    return () => clearInterval(timer)
  }, [state.chat.timeRemaining, actions, onTimeUp, timeUpCalled])

  const handleExtend = () => {
    if (state.chat.extensionCount < 3) {
      onExtend()
      actions.extendTime()
      setShowWarning(false)
      setIsPulsing(false)
      haptic.success()
    }
  }

  const getTimerColor = () => {
    if (state.chat.timeRemaining <= 30) return 'text-red-600'
    if (state.chat.timeRemaining <= 60) return 'text-orange-600'
    if (state.chat.timeRemaining <= 180) return 'text-yellow-600'
    return 'text-gray-600'
  }

  const getProgressColor = () => {
    if (state.chat.timeRemaining <= 30) return 'from-red-500 to-red-600'
    if (state.chat.timeRemaining <= 60) return 'from-orange-500 to-orange-600'
    if (state.chat.timeRemaining <= 180) return 'from-yellow-500 to-yellow-600'
    return 'from-yellow-500 to-yellow-600'
  }

  return (
    <>
      {/* 메인 타이머 */}
      <motion.div
        className={`
          flex items-center gap-2 px-3 py-2 rounded-full
          bg-white/90 backdrop-blur-sm shadow-lg
          ${isPulsing ? 'animate-pulse' : ''}
        `}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Clock className={`w-4 h-4 ${getTimerColor()}`} />
        <span className={`font-mono font-medium ${getTimerColor()}`}>
          {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
        </span>
        
        {/* 연장 버튼 */}
        {state.chat.extensionCount < 3 && (
          <motion.button
            className="ml-2 p-1.5 bg-yellow-100 text-yellow-600 rounded-full hover:bg-yellow-200 transition-colors"
            onClick={handleExtend}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title={`시간 연장 (${3 - state.chat.extensionCount}회 남음)`}
          >
            <Plus className="w-3 h-3" />
          </motion.button>
        )}
      </motion.div>

      {/* 진행률 바 */}
      <motion.div
        className="w-full bg-gray-200 rounded-full h-1 mt-2"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          className={`h-1 rounded-full bg-gradient-to-r ${getProgressColor()}`}
          style={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </motion.div>

      {/* 시간 종료 경고 모달 */}
      <AnimatePresence>
        {showWarning && (
          <motion.div
            className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50"
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.3 }}
          >
            <div className="bg-orange-100 border border-orange-300 text-orange-800 px-4 py-3 rounded-lg shadow-lg max-w-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">시간이 얼마 남지 않았습니다!</p>
                    <p className="text-sm">연장 버튼을 눌러 3분을 추가하세요.</p>
                  </div>
                </div>
                
                {/* X 버튼 */}
                <button
                  onClick={() => setShowWarning(false)}
                  className="p-1 hover:bg-orange-200 rounded-full transition-colors flex-shrink-0"
                  title="닫기"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              {/* 연장 버튼 */}
              {state.chat.extensionCount < 3 && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleExtend}
                    className="px-3 py-1.5 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors text-sm font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    3분 연장 ({3 - state.chat.extensionCount}회 남음)
                  </button>
                  <button
                    onClick={() => setShowWarning(false)}
                    className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm"
                  >
                    나중에
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}