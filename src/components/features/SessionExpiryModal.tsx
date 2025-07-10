'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Clock, AlertCircle } from 'lucide-react'
import { Modal } from '@/components/ui'
import { useApp } from '@/contexts/AppContext'
import { haptic } from '@/lib/haptic'

export const SessionExpiryModal: React.FC = () => {
  const { state, actions } = useApp()
  const [isOpen, setIsOpen] = useState(false)
  const [timeLeft, setTimeLeft] = useState(60) // 60초 카운트다운

  useEffect(() => {
    let warningTimer: NodeJS.Timeout
    let countdownInterval: NodeJS.Timeout

    const checkSessionExpiry = () => {
      const lastActivity = new Date(state.session.lastActivity).getTime()
      const now = Date.now()
      const nineMinutes = 9 * 60 * 1000
      const tenMinutes = 10 * 60 * 1000
      
      // 9분 경과 시 경고 표시
      if (now - lastActivity > nineMinutes && now - lastActivity < tenMinutes) {
        setIsOpen(true)
        haptic.warning()
        
        // 카운트다운 시작
        countdownInterval = setInterval(() => {
          setTimeLeft(prev => {
            if (prev <= 1) {
              handleExpiry()
              return 0
            }
            return prev - 1
          })
        }, 1000)
      }
    }

    // 10초마다 체크
    warningTimer = setInterval(checkSessionExpiry, 10000)
    
    return () => {
      clearInterval(warningTimer)
      clearInterval(countdownInterval)
    }
  }, [state.session.lastActivity])

  const handleContinue = () => {
    haptic.success()
    actions.updateActivity()
    setIsOpen(false)
    setTimeLeft(60)
  }

  const handleExpiry = () => {
    haptic.error()
    setIsOpen(false)
    actions.resetAll()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}} // 닫기 버튼 비활성화
      closeOnOverlayClick={false}
      size="sm"
    >
      <div className="text-center py-4">
        <motion.div
          className="w-16 h-16 bg-warning/20 rounded-full flex items-center justify-center mx-auto mb-4"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Clock className="w-8 h-8 text-warning" />
        </motion.div>

        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          세션이 곧 만료됩니다
        </h3>
        
        <p className="text-gray-600 mb-6">
          계속하시려면 아래 버튼을 눌러주세요
        </p>

        <div className="mb-6">
          <div className="text-3xl font-bold text-primary mb-2">
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-warning to-error"
              animate={{ width: `${(timeLeft / 60) * 100}%` }}
              transition={{ duration: 1 }}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleExpiry}
            className="flex-1 py-3 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            종료하기
          </button>
          <button
            onClick={handleContinue}
            className="flex-1 py-3 px-4 bg-primary text-white rounded-lg hover:bg-opacity-90 transition-all"
          >
            계속하기
          </button>
        </div>
      </div>
    </Modal>
  )
}

// 종료 확인 모달
interface EndSessionModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  type: 'chat' | 'all'
}

export const EndSessionModal: React.FC<EndSessionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  type
}) => {
  const title = type === 'chat' ? '대화를 종료하시겠습니까?' : '전체 세션을 종료하시겠습니까?'
  const message = type === 'chat' 
    ? '현재 감독과의 대화만 종료됩니다. 다른 감독을 선택할 수 있습니다.'
    : '모든 데이터가 삭제되며 처음부터 다시 시작하게 됩니다.'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
    >
      <div className="py-4">
        <div className="flex items-start gap-3 mb-6">
          <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <p className="text-gray-600">{message}</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className={`
              flex-1 py-3 px-4 rounded-lg text-white transition-all
              ${type === 'all' ? 'bg-error hover:bg-opacity-90' : 'bg-warning hover:bg-opacity-90'}
            `}
          >
            {type === 'chat' ? '대화 종료' : '전체 종료'}
          </button>
        </div>
      </div>
    </Modal>
  )
}