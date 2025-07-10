'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import { ChevronLeft, ChevronRight, Quote, Film, Sparkles } from 'lucide-react'
import { directors } from '@/constants/directors'
import { DirectorType } from '@/types'
import { haptic } from '@/lib/haptic'
import Image from 'next/image'

interface DirectorCarouselProps {
  onSelect: (director: DirectorType) => void
  selectedDirector: DirectorType | null
  onSelectionComplete?: () => void
}

export const DirectorCarousel: React.FC<DirectorCarouselProps> = ({
  onSelect,
  selectedDirector,
  onSelectionComplete
}) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState<{ [key: string]: boolean }>({})
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const directorArray = Object.entries(directors)
  const totalDirectors = directorArray.length

  // 프리로드 이미지
  useEffect(() => {
    directorArray.forEach(([_, director]) => {
      if (director.avatar) {
        const img = new window.Image()
        img.src = director.avatar
      }
    })
  }, [])

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false)
    const threshold = 50
    
    if (info.offset.x > threshold) {
      navigateTo(currentIndex - 1)
    } else if (info.offset.x < -threshold) {
      navigateTo(currentIndex + 1)
    }
  }

  const navigateTo = (index: number) => {
    haptic.selection()
    let newIndex = index
    
    if (index < 0) {
      newIndex = totalDirectors - 1
    } else if (index >= totalDirectors) {
      newIndex = 0
    }
    
    setCurrentIndex(newIndex)
  }

  const handleCardClick = (directorId: string, index: number, e: React.MouseEvent) => {
    if (index === currentIndex) {
      // 현재 카드 클릭 시 뒤집기 + 감독 선택
      haptic.light()
      setIsFlipped(prev => ({ ...prev, [directorId]: !prev[directorId] }))
      
      // 감독 선택
      onSelect(directorId as DirectorType)
      haptic.success()
    } else {
      // 다른 카드 클릭 시 해당 인덱스로 이동
      navigateTo(index)
    }
  }

  const getCardTransform = (index: number) => {
    const diff = index - currentIndex
    const angle = diff * 60
    const translateZ = -200
    const translateX = diff * 150
    const scale = index === currentIndex ? 1 : 0.8
    const opacity = Math.abs(diff) <= 1 ? 1 : 0.3
    
    return {
      transform: `translate(-50%, -50%) translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${angle}deg) scale(${scale})`,
      opacity,
      zIndex: index === currentIndex ? 10 : 5 - Math.abs(diff)
    }
  }

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden">
      {/* 진행 표시기 */}
      <div className="flex-shrink-0 px-8 pt-4 pb-2 z-20">
        <div className="flex items-center justify-center gap-2">
          <div className="flex items-center gap-2 text-white/60">
            <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-medium">
              ✓
            </div>
            <span className="text-sm">인생 My컷</span>
          </div>
          <ChevronRight className="w-4 h-4 text-white/40" />
          <div className="flex items-center gap-2 text-white/80">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-medium">
              2
            </div>
            <span className="text-sm">감독 선택</span>
          </div>
          <ChevronRight className="w-4 h-4 text-white/40" />
          <div className="flex items-center gap-2 text-white/40">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm">
              3
            </div>
            <span className="text-sm">대화</span>
          </div>
        </div>
      </div>

      {/* 타이틀 */}
      <motion.div 
        className="flex-shrink-0 text-center px-8 py-6 z-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
          어떤 감독님과 대화하시겠어요?
        </h2>
        <p className="text-base text-yellow-200">
          카드를 스와이프하거나 탭하여 감독을 선택하세요
        </p>
      </motion.div>

      {/* 캐러셀 컨테이너 */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div 
          ref={containerRef}
          className="relative w-full max-w-5xl h-[520px] perspective-1000 flex items-center justify-center"
          style={{ perspective: '1000px' }}
        >
        <AnimatePresence>
          {directorArray.map(([id, director], index) => {
            const cardStyle = getCardTransform(index)
            const isCenter = index === currentIndex
            const isSelected = selectedDirector === director.id
            
            return (
              <motion.div
                key={id}
                className="absolute w-72 h-[440px] cursor-pointer"
                style={{
                  left: '50%',
                  top: '50%',
                  transformStyle: 'preserve-3d',
                  transformOrigin: 'center center'
                }}
                animate={cardStyle}
                transition={{ 
                  duration: 0.5, 
                  ease: [0.23, 1, 0.32, 1]
                }}
                drag={isCenter ? "x" : false}
                dragConstraints={{ left: -100, right: 100 }}
                dragElastic={0.2}
                onDragStart={() => setIsDragging(true)}
                onDragEnd={handleDragEnd}
                onClick={(e) => handleCardClick(id, index, e)}
                whileHover={isCenter ? { scale: 1.05 } : {}}
              >
                {/* 카드 컨테이너 */}
                <div 
                  className={`
                    relative w-full h-full rounded-2xl shadow-2xl
                    ${isFlipped[id] ? 'rotate-y-180' : ''}
                    transition-transform duration-600 transform-style-preserve-3d
                  `}
                  style={{
                    transformStyle: 'preserve-3d',
                    transform: isFlipped[id] ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    transition: 'transform 0.6s'
                  }}
                >
                  {/* 카드 앞면 */}
                  <div 
                    className={`
                      absolute inset-0 rounded-2xl overflow-hidden
                      ${isSelected ? 'ring-4 ring-yellow-400 ring-offset-4 ring-offset-transparent' : ''}
                    `}
                    style={{
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden'
                    }}
                  >
                    {/* 배경 그라데이션 */}
                    <div 
                      className="absolute inset-0"
                      style={{ background: director.bgGradient }}
                    />
                    
                    {/* 콘텐츠 */}
                    <div className="relative h-full flex flex-col p-6 text-white">
                      {/* 선택됨 표시 */}
                      {isSelected && (
                        <motion.div
                          className="absolute top-4 right-4"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring" }}
                        >
                          <div className="bg-yellow-400 text-black rounded-full p-2">
                            <Sparkles className="w-5 h-5" />
                          </div>
                        </motion.div>
                      )}
                      
                      {/* 프로필 이미지 */}
                      <div className="flex-1 flex items-center justify-center mb-4">
                        <div className="relative">
                          <div className="w-40 h-40 rounded-full bg-white/20 backdrop-blur-sm overflow-hidden">
                            {director.avatar ? (
                              <Image
                                src={director.avatar}
                                alt={director.name}
                                width={160}
                                height={160}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Film className="w-20 h-20 text-white/60" />
                              </div>
                            )}
                          </div>
                          {isCenter && (
                            <motion.div
                              className="absolute -bottom-2 -right-2 bg-white/90 backdrop-blur-sm rounded-full p-2"
                              animate={{ rotate: [0, 10, -10, 0] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            >
                              <Quote className="w-4 h-4 text-gray-800" />
                            </motion.div>
                          )}
                        </div>
                      </div>
                      
                      {/* 감독 정보 */}
                      <div className="text-center">
                        <h3 className="text-2xl font-bold mb-2">{director.nameKo}</h3>
                        <p className="text-sm text-white/80 mb-3">{director.name}</p>
                        <p className="text-xs text-white/60 mb-3">{director.title}</p>
                        
                        {/* 대표작 태그 */}
                        <div className="flex flex-wrap justify-center gap-1 mb-2">
                          {director.films.slice(0, 2).map((film, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-medium"
                            >
                              {film}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      {/* 탭하여 뒤집기 힌트 */}
                      {isCenter && (
                        <motion.div
                          className="flex justify-center mt-2"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.5 }}
                        >
                          <span className="text-xs text-white/70 bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full">
                            탭하여 선택하고 자세히 보기
                          </span>
                        </motion.div>
                      )}
                    </div>
                  </div>
                  
                  {/* 카드 뒷면 */}
                  <div 
                    className="absolute inset-0 rounded-2xl overflow-hidden"
                    style={{
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)'
                    }}
                  >
                    <div 
                      className="absolute inset-0"
                      style={{ background: director.bgGradient }}
                    />
                    
                    <div className="relative h-full flex flex-col p-6 text-white">
                      <div className="flex-1 space-y-3 overflow-y-auto">
                        {/* 명언 */}
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                          <Quote className="w-5 h-5 mb-2 text-white/60" />
                          <p className="text-xs italic leading-relaxed">
                            "{director.quote}"
                          </p>
                        </div>
                        
                        {/* 대표작 */}
                        <div>
                          <h4 className="text-sm font-semibold mb-2 text-white/80">대표작</h4>
                          <div className="flex flex-wrap gap-1">
                            {director.films.map((film, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-white/15 backdrop-blur-sm rounded-full text-xs font-medium"
                              >
                                {film}
                              </span>
                            ))}
                          </div>
                        </div>
                        
                        {/* 설명 */}
                        <div>
                          <p className="text-xs leading-relaxed text-white/90">
                            {director.description}
                          </p>
                        </div>
                      </div>
                      
                      {/* 선택 버튼 - 디스플레이용 */}
                      <div 
                        className={`
                          mt-4 w-full py-3 px-4 rounded-xl font-semibold text-center transition-all duration-300
                          ${isSelected 
                            ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-black shadow-lg border-2 border-yellow-300' 
                            : 'bg-white/20 backdrop-blur-sm text-white border border-white/30'
                          }
                        `}
                      >
                        <div className="flex items-center justify-center gap-2">
                          {isSelected && (
                            <div className="w-5 h-5 bg-black/20 rounded-full flex items-center justify-center">
                              <span className="text-xs">✓</span>
                            </div>
                          )}
                          <span>{isSelected ? '선택됨' : '이 감독 선택'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
        </div>
      </div>

      {/* 네비게이션 버튼 */}
      <div className="absolute top-1/2 left-4 right-4 flex justify-between pointer-events-none transform -translate-y-1/2">
        <motion.button
          className="pointer-events-auto p-3 bg-white/10 backdrop-blur-sm rounded-full text-white hover:bg-white/20 transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => navigateTo(currentIndex - 1)}
        >
          <ChevronLeft className="w-6 h-6" />
        </motion.button>
        
        <motion.button
          className="pointer-events-auto p-3 bg-white/10 backdrop-blur-sm rounded-full text-white hover:bg-white/20 transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => navigateTo(currentIndex + 1)}
        >
          <ChevronRight className="w-6 h-6" />
        </motion.button>
      </div>

      {/* 인디케이터 */}
      <div className="flex-shrink-0 flex justify-center gap-2 py-4 z-20">
        {directorArray.map((_, index) => (
          <motion.button
            key={index}
            className={`
              w-2 h-2 rounded-full transition-all
              ${index === currentIndex ? 'w-8 bg-white' : 'bg-white/30'}
            `}
            onClick={() => navigateTo(index)}
            whileHover={{ scale: 1.2 }}
          />
        ))}
      </div>

      <style jsx>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
        .duration-600 {
          transition-duration: 600ms;
        }
        .transform-style-preserve-3d {
          transform-style: preserve-3d;
        }
      `}</style>
    </div>
  )
}