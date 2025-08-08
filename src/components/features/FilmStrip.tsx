'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Sparkles, Edit3, X, ChevronRight, Lock } from 'lucide-react'
import { Modal, useToast } from '@/components/ui'
import { haptic } from '@/lib/haptic'
import type { EmotionType } from '@/types'

interface FilmStripProps {
  selectedEmotion: EmotionType | null
  cuts: {
    joy?: string
    anger?: string
    sadness?: string
    pleasure?: string
  }
  onSelectEmotion: (emotion: EmotionType) => void
  onUpdate: (emotion: EmotionType, text: string) => void
  onComplete: () => void
  directorTheme?: {
    color: string
    gradient: string
  }
}

interface CutModalProps {
  isOpen: boolean
  onClose: () => void
  emotion: EmotionType
  initialText: string
  onSave: (text: string) => void
}

const CutModal: React.FC<CutModalProps> = ({
  isOpen,
  onClose,
  emotion,
  initialText,
  onSave
}) => {
  const [text, setText] = useState(initialText)
  const [charCount, setCharCount] = useState(initialText.length)
  const maxChars = 1000

  useEffect(() => {
    setText(initialText)
    setCharCount(initialText.length)
  }, [initialText, isOpen])

  const handleSave = () => {
    if (text.trim()) {
      onSave(text.trim())
      haptic.success()
      onClose()
    }
  }

  const emotionData = {
    joy: {
      title: '#01 Joy_기뻤던 장면',
      placeholder: '기뻤던 순간의 상황과 대사를 입력해주세요...',
      example: {
        situation: '초등학교 운동회 50m 달리기에서 2등으로 결승선을 끊자 선생님이 목에 메달을 걸어주던 순간.',
        dialogue: '"이거 들고 바로 엄마한테 뛰어가야지!"'
      }
    },
    anger: {
      title: '#02 Anger_화났던 장면',
      placeholder: '화났던 순간의 상황과 대사를 입력해주세요...',
      example: {
        situation: '중학생 때 애지중지 모은 스티커 앨범을 동생이 허락도 없이 친구들에게 나눠주고 "괜찮지?"라며 웃을 때.',
        dialogue: '"내 보물을 왜 마음대로 가져가?"'
      }
    },
    sadness: {
      title: '#03 Sadness_슬펐던 장면',
      placeholder: '슬펐던 순간의 상황과 대사를 입력해주세요...',
      example: {
        situation: '대학교 겨울방학 전날, 기숙사 앞 버스 정류장에서 연인이 "우리 그만하자"는 말을 남기고 버스에 올라타 멀어지던 밤.',
        dialogue: '"추억도 저 버스랑 같이 떠나는구나…"'
      }
    },
    pleasure: {
      title: '#04 Pleasure_즐거웠던 장면',
      placeholder: '즐거웠던 순간의 상황과 대사를 입력해주세요...',
      example: {
        situation: '취업 준비로 지친 어느 비 오는 토요일 밤, 친구가 편의점 우산 두 개를 들고 찾아와 빗속을 산책하며 끝없이 수다 떨던 시간.',
        dialogue: '"빗소리 덕분에 마음도 말끔해진다."'
      }
    }
  }

  const data = emotionData[emotion]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${data.title} 작성`}
      size="lg"
    >
      <div className="space-y-4">
        <div className="bg-yellow-50 rounded-lg p-4">
          <p className="text-sm text-yellow-700 mb-3">
            💡 <strong>작성 팁:</strong> 상황과 대사를 명확히 구분하여 작성해주세요.
          </p>
          <div className="text-xs text-gray-600 space-y-2">
            <div><strong>예시 형식:</strong></div>
            <div className="bg-white rounded p-3 text-xs space-y-1">
              <div>
                <strong>상황:</strong> {data.example.situation}
              </div>
              <div>
                <strong>대사:</strong> {data.example.dialogue}
              </div>
            </div>
          </div>
        </div>

        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => {
              const newText = e.target.value
              if (newText.length <= maxChars) {
                setText(newText)
                setCharCount(newText.length)
              }
            }}
            placeholder={data.placeholder}
            className="w-full h-48 p-4 border-2 border-gray-200 rounded-lg resize-none focus:border-yellow-500 focus:outline-none transition-colors"
            autoFocus
          />
          
          <div className={`absolute bottom-2 right-2 text-sm ${
            charCount > maxChars * 0.9 ? 'text-red-500' : 'text-gray-400'
          }`}>
            {charCount} / {maxChars}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={!text.trim()}
            className={`
              flex-1 py-3 px-4 rounded-lg font-medium transition-all
              ${text.trim() 
                ? 'bg-yellow-600 text-black hover:bg-yellow-700' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            저장하기
          </button>
        </div>
      </div>
    </Modal>
  )
}

export const FilmStrip: React.FC<FilmStripProps> = ({
  selectedEmotion,
  cuts,
  onSelectEmotion,
  onUpdate,
  onComplete,
  directorTheme
}) => {
  const [showModal, setShowModal] = useState(false)
  const [hoveredCard, setHoveredCard] = useState<EmotionType | null>(null)
  const { showToast } = useToast()
  const hasCalledComplete = useRef(false)

  const emotions: { 
    type: EmotionType
    label: string
    emoji: string
    gradient: string
    bgPattern: string
    description: string
  }[] = [
    { 
      type: 'joy', 
      label: '기쁨', 
      emoji: '😊', 
      gradient: 'from-yellow-400 via-amber-400 to-orange-400',
      bgPattern: 'bg-gradient-to-br from-yellow-50 to-orange-50',
      description: '가장 행복했던 순간'
    },
    { 
      type: 'anger', 
      label: '분노', 
      emoji: '😡', 
      gradient: 'from-red-500 via-rose-500 to-pink-500',
      bgPattern: 'bg-gradient-to-br from-red-50 to-pink-50',
      description: '가장 화났던 순간'
    },
    { 
      type: 'sadness', 
      label: '슬픔', 
      emoji: '😢', 
      gradient: 'from-blue-500 via-indigo-500 to-purple-500',
      bgPattern: 'bg-gradient-to-br from-blue-50 to-indigo-50',
      description: '가장 슬펐던 순간'
    },
    { 
      type: 'pleasure', 
      label: '즐거움', 
      emoji: '😄', 
      gradient: 'from-green-400 via-emerald-400 to-teal-400',
      bgPattern: 'bg-gradient-to-br from-green-50 to-teal-50',
      description: '가장 즐거웠던 순간'
    }
  ]

  // 완료 처리 - 무한 루프 방지
  useEffect(() => {
    if (selectedEmotion && cuts[selectedEmotion] && cuts[selectedEmotion]!.trim().length > 0) {
      if (!hasCalledComplete.current) {
        onComplete()
        hasCalledComplete.current = true
      }
    } else {
      hasCalledComplete.current = false
    }
  }, [selectedEmotion, cuts])

  const handleCardClick = (emotion: EmotionType) => {
    // 이미 감정이 선택되어 있고 내용이 있는 경우
    if (selectedEmotion && cuts[selectedEmotion]) {
      // 같은 감정 클릭 시 수정 모달 열기
      if (selectedEmotion === emotion) {
        setShowModal(true)
      } else {
        // 다른 감정 클릭 시 경고
        showToast({
          message: '다른 감정을 선택하려면 먼저 현재 감정을 초기화해주세요',
          type: 'warning',
          duration: 3000
        })
      }
      return
    }

    // 새로운 감정 선택
    haptic.light()
    onSelectEmotion(emotion)
    setTimeout(() => setShowModal(true), 300)
  }

  const handleSaveCut = (text: string) => {
    if (selectedEmotion) {
      onUpdate(selectedEmotion, text)
      showToast({
        message: '인생 My컷이 저장되었습니다',
        type: 'success',
        duration: 2000
      })
    }
  }

  const handleResetEmotion = () => {
    if (selectedEmotion) {
      haptic.light()
      onUpdate(selectedEmotion, '')
      showToast({
        message: '초기화되었습니다. 다른 감정을 선택할 수 있습니다',
        type: 'info',
        duration: 2000
      })
    }
  }

  const isCompleted = selectedEmotion && cuts[selectedEmotion] && cuts[selectedEmotion]!.trim().length > 0
  const isLocked = isCompleted // 완료되면 다른 카드 잠금

  return (
    <>
      <div className="w-full max-w-5xl mx-auto">
        {/* 헤더 */}
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-3xl font-bold text-white mb-3">
            인생의 한 장면을 선택해주세요
          </h2>
          <p className="text-gray-400 text-lg">
            {isCompleted 
              ? `${emotions.find(e => e.type === selectedEmotion)?.label} 장면이 선택되었습니다`
              : '오늘 가장 이야기하고 싶은 감정 하나를 선택하고 작성해주세요'
            }
          </p>
        </motion.div>

        {/* 감정 카드 그리드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          {emotions.map((emotion, index) => {
            const isSelected = selectedEmotion === emotion.type
            const hasContent = cuts[emotion.type] && cuts[emotion.type]!.trim().length > 0
            const isDisabled = isLocked && !isSelected // 완료 시 선택되지 않은 카드 비활성화
            const isHovered = hoveredCard === emotion.type
            
            return (
              <motion.div
                key={emotion.type}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onMouseEnter={() => !isDisabled && setHoveredCard(emotion.type)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <motion.button
                  className={`
                    relative w-full h-64 rounded-2xl overflow-hidden
                    transition-all duration-300 group
                    ${isSelected 
                      ? 'ring-4 ring-yellow-400 ring-offset-4 ring-offset-gray-900' 
                      : isDisabled
                      ? 'opacity-40 cursor-not-allowed'
                      : 'hover:ring-2 hover:ring-gray-500 hover:ring-offset-2 hover:ring-offset-gray-900'
                    }
                  `}
                  whileHover={!isDisabled ? { scale: 1.02 } : {}}
                  whileTap={!isDisabled ? { scale: 0.98 } : {}}
                  onClick={() => !isDisabled && handleCardClick(emotion.type)}
                  disabled={isDisabled}
                >
                  {/* 배경 그라디언트 */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${emotion.gradient} ${isDisabled ? 'opacity-50' : 'opacity-90'}`} />
                  
                  {/* 패턴 오버레이 */}
                  <div className="absolute inset-0 opacity-20">
                    <div className="absolute inset-0" style={{
                      backgroundImage: `radial-gradient(circle at 20% 50%, transparent 20%, rgba(255,255,255,0.3) 20.5%, rgba(255,255,255,0.3) 30%, transparent 30.5%)`,
                      backgroundSize: '20px 20px'
                    }} />
                  </div>

                  {/* 잠금 표시 */}
                  {isDisabled && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20">
                      <Lock className="w-8 h-8 text-white/60" />
                    </div>
                  )}

                  {/* 선택/완료 배지 */}
                  <AnimatePresence>
                    {isSelected && isCompleted && (
                      <motion.div
                        className="absolute top-3 right-3 z-10"
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: 180 }}
                        transition={{ type: "spring", stiffness: 200 }}
                      >
                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                          <Check className="w-5 h-5 text-white" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* 컨텐츠 */}
                  <div className="relative h-full flex flex-col items-center justify-center p-6 z-10">
                    {/* 이모지 */}
                    <motion.div 
                      className="text-6xl mb-4"
                      animate={{ 
                        scale: isHovered && !isDisabled ? 1.2 : 1,
                        rotate: isHovered && !isDisabled ? [0, -10, 10, -10, 0] : 0
                      }}
                      transition={{ duration: 0.5 }}
                    >
                      {emotion.emoji}
                    </motion.div>

                    {/* 레이블 */}
                    <h3 className="text-xl font-bold text-white mb-1">
                      {emotion.label}
                    </h3>
                    
                    {/* 설명 */}
                    <p className="text-xs text-white/80 mb-3">
                      {emotion.description}
                    </p>

                    {/* 상태 표시 */}
                    {isSelected && hasContent ? (
                      <span className="text-xs text-white/90 bg-white/20 px-3 py-1 rounded-full">
                        작성 완료
                      </span>
                    ) : !isDisabled ? (
                      <span className="text-xs text-white/60">
                        {isSelected ? '작성하기' : '선택하기'}
                      </span>
                    ) : null}
                  </div>

                  {/* 호버 효과 */}
                  <motion.div 
                    className="absolute inset-0 bg-white pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isHovered && !isDisabled ? 0.1 : 0 }}
                  />
                </motion.button>
              </motion.div>
            )
          })}
        </div>

        {/* 진행 상태 및 액션 버튼 */}
        {selectedEmotion && (
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400">선택된 감정:</span>
                  <span className="text-white font-medium flex items-center gap-2 text-lg">
                    {emotions.find(e => e.type === selectedEmotion)?.emoji}
                    {emotions.find(e => e.type === selectedEmotion)?.label}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  {isCompleted && (
                    <>
                      <motion.button
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => setShowModal(true)}
                      >
                        <Edit3 className="w-4 h-4" />
                        <span className="text-sm">수정하기</span>
                      </motion.button>
                      
                      <motion.button
                        className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        onClick={handleResetEmotion}
                      >
                        <X className="w-4 h-4" />
                        <span className="text-sm">다른 감정 선택</span>
                      </motion.button>
                    </>
                  )}
                </div>
              </div>

              {/* 작성한 내용 미리보기 */}
              {isCompleted && cuts[selectedEmotion] && (
                <motion.div
                  className="mb-4 p-4 bg-gray-900 rounded-lg"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-400 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">{emotions.find(e => e.type === selectedEmotion)?.emoji}</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-400 mb-2">작성한 내용</h4>
                      <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                        {cuts[selectedEmotion].length > 200 
                          ? `${cuts[selectedEmotion].substring(0, 200)}...` 
                          : cuts[selectedEmotion]
                        }
                      </p>
                      {cuts[selectedEmotion].length > 200 && (
                        <button
                          onClick={() => setShowModal(true)}
                          className="text-xs text-blue-400 hover:text-blue-300 mt-2"
                        >
                          전체 내용 보기 →
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* 안내 메시지 */}
              {isCompleted && (
                <motion.div
                  className="p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <p className="text-xs text-yellow-400">
                    💡 선택한 감정의 장면만 AI 감독과의 대화에 반영됩니다. 
                    다른 감정을 선택하려면 "다른 감정 선택" 버튼을 클릭하세요.
                  </p>
                </motion.div>
              )}

              {/* 작성 대기 중 */}
              {!isCompleted && (
                <motion.div
                  className="p-4 bg-gray-900 rounded-lg text-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <p className="text-gray-400 text-sm">
                    선택한 감정의 장면을 작성해주세요
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {/* 완료 메시지 */}
        <AnimatePresence>
          {isCompleted && (
            <motion.div
              className="text-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <motion.div 
                className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full shadow-lg"
                animate={{ 
                  boxShadow: [
                    '0 0 20px rgba(34, 197, 94, 0.3)',
                    '0 0 40px rgba(34, 197, 94, 0.5)',
                    '0 0 20px rgba(34, 197, 94, 0.3)'
                  ]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles className="w-5 h-5" />
                <span className="font-medium">감독 선택 단계로 진행할 수 있습니다</span>
                <ChevronRight className="w-5 h-5" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 입력 모달 */}
      {selectedEmotion && (
        <CutModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          emotion={selectedEmotion}
          initialText={cuts[selectedEmotion] || ''}
          onSave={handleSaveCut}
        />
      )}
    </>
  )
}