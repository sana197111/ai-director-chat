// src/components/features/ScenarioDisplay.tsx

'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Film, ChevronDown, ChevronUp, Sparkles, Clock } from 'lucide-react'
import type { ConversationStage } from '@/lib/gemini'

interface ScenarioDisplayProps {
  stage: ConversationStage
  scenario?: string
  originalStory?: string
  className?: string
}

export function ScenarioDisplay({ 
  stage, 
  scenario, 
  originalStory,
  className = ''
}: ScenarioDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // 스테이지별 라벨과 색상
  const stageInfo = {
    initial: { label: '시작', color: 'text-gray-400', bgColor: 'bg-gray-900/50' },
    detail_1: { label: '이야기 수집 중 (1/3)', color: 'text-blue-400', bgColor: 'bg-blue-900/20' },
    detail_2: { label: '이야기 수집 중 (2/3)', color: 'text-blue-400', bgColor: 'bg-blue-900/30' },
    detail_3: { label: '이야기 수집 중 (3/3)', color: 'text-blue-400', bgColor: 'bg-blue-900/40' },
    draft: { label: '시나리오 초안 작성', color: 'text-yellow-400', bgColor: 'bg-yellow-900/30' },
    feedback: { label: '시나리오 수정 중', color: 'text-orange-400', bgColor: 'bg-orange-900/30' },
    final: { label: '시나리오 완성!', color: 'text-green-400', bgColor: 'bg-green-900/30' }
  }
  
  const currentStageInfo = stageInfo[stage] || stageInfo.initial
  const hasScenario = scenario && (stage === 'draft' || stage === 'feedback' || stage === 'final')
  
  return (
    <motion.div
      className={`relative overflow-hidden rounded-xl border border-white/10 ${className}`}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* 헤더 */}
      <motion.button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full p-3 flex items-center justify-between ${currentStageInfo.bgColor} backdrop-blur-sm hover:bg-white/5 transition-all`}
      >
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-white/60" />
          <span className={`text-sm font-medium ${currentStageInfo.color}`}>
            {currentStageInfo.label}
          </span>
          {stage === 'final' && (
            <Sparkles className="w-4 h-4 text-yellow-400 animate-pulse" />
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {hasScenario && (
            <span className="text-xs text-white/50">
              {isExpanded ? '접기' : '시나리오 보기'}
            </span>
          )}
          {hasScenario && (
            isExpanded ? 
              <ChevronUp className="w-4 h-4 text-white/50" /> : 
              <ChevronDown className="w-4 h-4 text-white/50" />
          )}
        </div>
      </motion.button>
      
      {/* 진행 상태 바 */}
      <div className="h-1 bg-white/5">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
          initial={{ width: '0%' }}
          animate={{ 
            width: stage === 'initial' ? '14%' :
                   stage === 'detail_1' ? '28%' :
                   stage === 'detail_2' ? '42%' :
                   stage === 'detail_3' ? '57%' :
                   stage === 'draft' ? '71%' :
                   stage === 'feedback' ? '85%' :
                   '100%'
          }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      
      {/* 확장 컨텐츠 */}
      <AnimatePresence>
        {isExpanded && hasScenario && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-black/30 backdrop-blur-sm">
              {/* 원본 스토리 */}
              {originalStory && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-white/50 mb-2">
                    원본 이야기
                  </h4>
                  <p className="text-sm text-white/70 italic">
                    "{originalStory}"
                  </p>
                </div>
              )}
              
              {/* 시나리오 */}
              <div>
                <h4 className="text-xs font-medium text-white/50 mb-2 flex items-center gap-1">
                  {stage === 'draft' ? '초안' : 
                   stage === 'feedback' ? '수정 중' : 
                   '최종 시나리오'}
                  {stage === 'final' && (
                    <Sparkles className="w-3 h-3 text-yellow-400" />
                  )}
                </h4>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed">
                    {scenario}
                  </p>
                </div>
              </div>
              
              {/* 스테이지별 추가 정보 */}
              {stage === 'feedback' && (
                <div className="mt-3 flex items-center gap-2 text-xs text-orange-400">
                  <Clock className="w-3 h-3" />
                  <span>감독님의 피드백을 반영 중입니다...</span>
                </div>
              )}
              
              {stage === 'final' && (
                <div className="mt-3 flex items-center gap-2 text-xs text-green-400">
                  <Sparkles className="w-3 h-3" />
                  <span>시나리오가 완성되었습니다!</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// 컴팩트 버전 (채팅 화면용)
export function ScenarioStatusBadge({ 
  stage,
  hasScenario = false,
  className = ''
}: {
  stage: ConversationStage
  hasScenario?: boolean
  className?: string
}) {
  const stageInfo = {
    initial: { icon: '🎬', label: '시작' },
    detail_1: { icon: '📝', label: '수집 1/3' },
    detail_2: { icon: '📝', label: '수집 2/3' },
    detail_3: { icon: '📝', label: '수집 3/3' },
    draft: { icon: '✍️', label: '초안' },
    feedback: { icon: '🔧', label: '수정' },
    final: { icon: '✨', label: '완성' }
  }
  
  const current = stageInfo[stage] || stageInfo.initial
  
  return (
    <motion.div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/10 border border-white/20 ${className}`}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05 }}
    >
      <span className="text-xs">{current.icon}</span>
      <span className="text-xs text-white/80 font-medium">
        {current.label}
      </span>
      {hasScenario && stage !== 'initial' && (
        <motion.div
          className="w-1.5 h-1.5 rounded-full bg-green-400"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
        />
      )}
    </motion.div>
  )
}