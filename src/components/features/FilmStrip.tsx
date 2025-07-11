'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Film, Plus, Check, Edit3, Sparkles } from 'lucide-react'
import { Modal, useToast } from '@/components/ui'
import { haptic } from '@/lib/haptic'

interface FilmStripProps {
  cuts: [string, string, string, string]
  onUpdate: (index: number, text: string) => void
  onComplete: () => void
  directorTheme?: {
    color: string
    gradient: string
  }
}

interface CutModalProps {
  isOpen: boolean
  onClose: () => void
  cutIndex: number
  initialText: string
  onSave: (text: string) => void
}

const CutModal: React.FC<CutModalProps> = ({
  isOpen,
  onClose,
  cutIndex,
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

  const cutTitles = [
    '#01 Joy_기빴던 장면',
    '#02 Anger_화났던 장면',
    '#03 Sadness_슬펐던 장면',
    '#04 Pleasure_즐거웠던 장면'
  ]

  const placeholders = [
    '기빴던 순간의 상황과 대사를 입력해주세요...',
    '화났던 순간의 상황과 대사를 입력해주세요...',
    '슬펐던 순간의 상황과 대사를 입력해주세요...',
    '즐거웠던 순간의 상황과 대사를 입력해주세요...'
  ]

  // 각 감정별로 다른 예시
  const examples = [
    {
      // Joy - 기쁨
      situation: '초등학교 운동회 50m 달리기에서 2등으로 결승선을 끊자 선생님이 목에 메달을 걸어주던 순간.',
      dialogue: '"이거 들고 바로 엄마한테 뛰어가야지!"'
    },
    {
      // Anger - 화남
      situation: '중학생 때 애지중지 모은 스티커 앨범을 동생이 허락도 없이 친구들에게 나눠주고 "괜찮지?"라며 웃을 때.',
      dialogue: '"내 보물을 왜 마음대로 가져가?"'
    },
    {
      // Sadness - 슬픔
      situation: '대학교 겨울방학 전날, 기숙사 앞 버스 정류장에서 연인이 "우리 그만하자"는 말을 남기고 버스에 올라타 멀어지던 밤.',
      dialogue: '"추억도 저 버스랑 같이 떠나는구나…"'
    },
    {
      // Pleasure - 즐거움
      situation: '취업 준비로 지친 어느 비 오는 토요일 밤, 친구가 편의점 우산 두 개를 들고 찾아와 빗속을 산책하며 끝없이 수다 떨던 시간.',
      dialogue: '"빗소리 덕분에 마음도 말끔해진다."'
    }
  ]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${cutTitles[cutIndex]} 작성`}
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
                <strong>상황:</strong> {examples[cutIndex].situation}
              </div>
              <div>
                <strong>대사:</strong> {examples[cutIndex].dialogue}
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
            placeholder={placeholders[cutIndex]}
            className="w-full h-48 p-4 border-2 border-gray-200 rounded-lg resize-none focus:border-yellow-500 focus:outline-none transition-colors"
            autoFocus
          />
          
          {/* 문자 수 카운터 */}
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
  cuts,
  onUpdate,
  onComplete,
  directorTheme
}) => {
  const [selectedCut, setSelectedCut] = useState<number | null>(null)
  const [completedCuts, setCompletedCuts] = useState<boolean[]>([false, false, false, false])
  const { showToast } = useToast()

  useEffect(() => {
    const newCompletedCuts = cuts.map(cut => cut.trim().length > 0)
    setCompletedCuts(newCompletedCuts)
  }, [cuts])

  useEffect(() => {
    // 모든 컷이 완성되었는지 체크
    if (completedCuts.every(completed => completed) && cuts.every(cut => cut.trim().length > 0)) {
      onComplete()
    }
  }, [completedCuts, cuts])

  const handleCutClick = (index: number) => {
    haptic.light()
    setSelectedCut(index)
  }

  const handleSaveCut = (index: number, text: string) => {
    onUpdate(index, text)
    showToast({
      message: '자동 저장되었습니다',
      type: 'success',
      duration: 2000
    })
  }

  const getProgress = () => {
    return completedCuts.filter(completed => completed).length
  }

  return (
    <>
      <div className="w-full max-w-4xl mx-auto">
        {/* 진행률 표시 */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">
              {getProgress()}/4 컷 완성
            </span>
            {getProgress() === 4 && (
              <motion.span
                className="flex items-center gap-1 text-sm text-green-600"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Check className="w-4 h-4" />
                모든 컷 완성!
              </motion.span>
            )}
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-yellow-500 to-yellow-600"
              initial={{ width: 0 }}
              animate={{ width: `${(getProgress() / 4) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </motion.div>

        {/* 필름 스트립 */}
        <div className="relative">
          {/* 필름 구멍 효과 - 더 정교한 디자인 */}
          <div className="absolute -top-6 left-0 right-0 h-6 flex justify-between px-4">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="w-2 h-4 bg-gray-800 rounded-sm shadow-md"
                style={{ 
                  transform: i % 2 === 0 ? 'translateY(1px)' : 'translateY(-1px)',
                  opacity: 0.8 + (i % 3) * 0.1
                }}
              />
            ))}
          </div>
          <div className="absolute -bottom-6 left-0 right-0 h-6 flex justify-between px-4">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="w-2 h-4 bg-gray-800 rounded-sm shadow-md"
                style={{ 
                  transform: i % 2 === 0 ? 'translateY(-1px)' : 'translateY(1px)',
                  opacity: 0.8 + (i % 3) * 0.1
                }}
              />
            ))}
          </div>

          {/* 컷 그리드 - 필름 스트립 느낌 강화 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-8 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl border-4 border-gray-700 shadow-2xl">
            <AnimatePresence>
              {cuts.map((cut, index) => {
                const isCompleted = completedCuts[index]
                
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <motion.button
                      className={`
                        relative w-full aspect-[3/4] rounded-xl overflow-hidden
                        transition-all duration-300 group shadow-lg
                        ${isCompleted 
                          ? 'ring-3 ring-green-400 ring-offset-3 ring-offset-gray-900 shadow-green-500/20' 
                          : 'ring-3 ring-gray-600 ring-offset-3 ring-offset-gray-900 hover:ring-yellow-500/50 hover:shadow-yellow-500/20'
                        }
                      `}
                      onClick={() => handleCutClick(index)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {/* 배경 - 필름 프레임 느낌 */}
                      <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-750 to-gray-700" />
                      <div 
                        className="absolute inset-1 bg-gradient-to-br from-gray-700 to-gray-600 rounded-lg"
                        style={isCompleted && directorTheme ? {
                          background: directorTheme.gradient,
                          opacity: 0.4
                        } : {}}
                      />
                      
                      {/* 컷 번호 - 필름 라벨 스타일 */}
                      <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm rounded-md px-3 py-1 border border-gray-600">
                        <span className="text-xs text-yellow-300 font-bold tracking-wider">
                          #{index + 1}
                        </span>
                      </div>

                      {/* 콘텐츠 */}
                      <div className="relative h-full flex items-center justify-center p-4">
                        {isCompleted ? (
                          <div className="text-center space-y-2">
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto"
                            >
                              {['😊', '😡', '😢', '😄'][index]}
                            </motion.div>
                            <div className="text-xs text-white/80">
                              <p className="font-medium mb-1">{['기빴던 장면', '화났던 장면', '슬펐던 장면', '즐거웠던 장면'][index]}</p>
                              <p className="line-clamp-2 text-white/60">
                                {cut.substring(0, 40)}...
                              </p>
                            </div>
                            <p className="text-xs text-white/60 group-hover:text-white/80 transition-colors">
                              탭하여 수정
                            </p>
                          </div>
                        ) : (
                          <div className="text-center space-y-3">
                            <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mx-auto group-hover:bg-gray-500 transition-colors text-2xl">
                              {['😊', '😡', '😢', '😄'][index]}
                            </div>
                            <div className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
                              <p className="font-medium">{['기빴던 장면', '화났던 장면', '슬펐던 장면', '즐거웠던 장면'][index]}</p>
                              <p className="text-xs mt-1">탭하여 작성</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 호버 효과 */}
                      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors" />
                    </motion.button>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* 완성 시 이펙트 */}
        {getProgress() === 4 && (
          <motion.div
            className="mt-6 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-600 to-yellow-700 text-black rounded-full">
              <Sparkles className="w-5 h-5" />
              <span className="font-medium">준비 완료! 대화를 시작할 수 있습니다</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* 입력 모달 */}
      {selectedCut !== null && (
        <CutModal
          isOpen={true}
          onClose={() => setSelectedCut(null)}
          cutIndex={selectedCut}
          initialText={cuts[selectedCut]}
          onSave={(text) => handleSaveCut(selectedCut, text)}
        />
      )}
    </>
  )
}