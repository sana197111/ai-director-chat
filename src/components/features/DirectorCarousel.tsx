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
  const [cardDimensions, setCardDimensions] = useState({ width: 288, height: 440 })
  const containerRef = useRef<HTMLDivElement>(null)

  const directorArray = Object.entries(directors)
  const totalDirectors = directorArray.length

  // 화면 크기에 따른 카드 크기 조절
  useEffect(() => {
    const updateCardSize = () => {
      const vh = window.innerHeight
      const vw = window.innerWidth
      
      // 기본 크기 (더 크게 조정)
      let cardWidth = 280
      let cardHeight = 420
      
      // 화면 높이에 따른 조절
      if (vh < 650) {
        // 매우 작은 화면
        cardHeight = Math.min(340, vh * 0.52)
        cardWidth = cardHeight * 0.66
      } else if (vh < 750) {
        // 작은 화면
        cardHeight = Math.min(380, vh * 0.5)
        cardWidth = cardHeight * 0.66
      } else if (vh < 850) {
        // 중간 크기 화면
        cardHeight = Math.min(420, vh * 0.49)
        cardWidth = cardHeight * 0.66
      } else {
        // 큰 화면
        cardHeight = Math.min(480, vh * 0.48)
        cardWidth = cardHeight * 0.66
      }
      
      // 화면 너비도 고려
      const maxWidth = vw * 0.3 // 더 큰 카드 허용
      if (cardWidth > maxWidth && vw < 768) {
        cardWidth = maxWidth
        cardHeight = cardWidth / 0.66
      }
      
      setCardDimensions({ width: cardWidth, height: cardHeight })
    }

    updateCardSize()
    window.addEventListener('resize', updateCardSize)
    return () => window.removeEventListener('resize', updateCardSize)
  }, [])

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
      haptic.light()
      setIsFlipped(prev => ({ ...prev, [directorId]: !prev[directorId] }))
      onSelect(directorId as DirectorType)
      haptic.success()
    } else {
      navigateTo(index)
    }
  }

  const getCardTransform = (index: number) => {
    const diff = index - currentIndex
    const angle = diff * 45  // 60도에서 45도로 줄여서 카드 간격 확보
    const translateZ = -150  // -200에서 -150으로 줄여서 더 가깝게
    const translateX = diff * (cardDimensions.width * 0.7)  // 0.52에서 0.7로 늘려서 간격 확보
    const scale = index === currentIndex ? 1 : 0.75  // 0.8에서 0.75로 줄여서 주변 카드 더 작게
    const opacity = Math.abs(diff) <= 1 ? 1 : 0.3
    
    return {
      transform: `translate(-50%, -50%) translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${angle}deg) scale(${scale})`,
      opacity,
      zIndex: index === currentIndex ? 10 : 5 - Math.abs(diff)
    }
  }

  // 반응형 텍스트 크기 계산
  const getResponsiveTextSize = () => {
    const baseSize = cardDimensions.height / 400
    return {
      title: `${Math.max(1.75, 2.25 * baseSize)}rem`,      // 더 큰 제목
      subtitle: `${Math.max(1, 1.125 * baseSize)}rem`,     // 더 큰 부제목
      small: `${Math.max(0.875, 1 * baseSize)}rem`,        // 더 큰 일반 텍스트
      tiny: `${Math.max(0.75, 0.875 * baseSize)}rem`       // 더 큰 작은 텍스트
    }
  }

  const textSizes = getResponsiveTextSize()

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden">
      {/* 진행 표시기 - 작은 화면에서는 숨김 */}
      <div className="hidden sm:flex flex-shrink-0 px-4 pt-1 pb-0 z-20">
        <div className="flex items-center justify-center gap-1 text-xs">
          <div className="flex items-center gap-1 text-white/60">
            <div className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px] font-medium">
              ✓
            </div>
            <span className="text-[11px]">인생 My컷</span>
          </div>
          <ChevronRight className="w-3 h-3 text-white/40" />
          <div className="flex items-center gap-1 text-white/80">
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-medium">
              2
            </div>
            <span className="text-[11px]">감독 선택</span>
          </div>
          <ChevronRight className="w-3 h-3 text-white/40" />
          <div className="flex items-center gap-1 text-white/40">
            <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px]">
              3
            </div>
            <span className="text-[11px]">대화</span>
          </div>
        </div>
      </div>

      {/* 타이틀 */}
      <motion.div 
        className="flex-shrink-0 text-center px-4 py-2 z-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-lg md:text-xl lg:text-2xl font-bold text-white mb-0.5">
          어떤 감독님과 대화하시겠어요?
        </h2>
        <p className="text-xs md:text-sm text-yellow-200">
          카드를 스와이프하거나 탭하여 감독을 선택하세요
        </p>
      </motion.div>

      {/* 캐러셀 컨테이너 */}
      <div className="flex-1 flex items-center justify-center px-2 min-h-0">
        <div 
          ref={containerRef}
          className="relative w-full max-w-6xl h-full perspective-1000 flex items-center justify-center"
          style={{ 
            perspective: '1000px',
            height: `${cardDimensions.height + 20}px`
          }}
        >
        <AnimatePresence>
          {directorArray.map(([id, director], index) => {
            const cardStyle = getCardTransform(index)
            const isCenter = index === currentIndex
            const isSelected = selectedDirector === director.id
            
            return (
              <motion.div
                key={id}
                className="absolute cursor-pointer"
                style={{
                  width: `${cardDimensions.width}px`,
                  height: `${cardDimensions.height}px`,
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
                      ${isSelected ? 'ring-2 md:ring-4 ring-yellow-400 ring-offset-2 md:ring-offset-4 ring-offset-transparent' : ''}
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
                    <div className="relative h-full flex flex-col p-4 md:p-6 text-white">
                      {/* 선택됨 표시 */}
                      {isSelected && (
                        <motion.div
                          className="absolute top-2 md:top-4 right-2 md:right-4"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring" }}
                        >
                          <div className="bg-yellow-400 text-black rounded-full p-1.5 md:p-2">
                            <Sparkles className="w-4 h-4 md:w-5 md:h-5" />
                          </div>
                        </motion.div>
                      )}
                      
                      {/* 프로필 이미지 */}
                      <div className="flex items-center justify-center mb-2">
                        <div className="relative">
                          <div 
                            className="rounded-full bg-white/20 backdrop-blur-sm overflow-hidden"
                            style={{
                              width: `${cardDimensions.width * 0.4}px`,
                              height: `${cardDimensions.width * 0.4}px`
                            }}
                          >
                            {director.avatar ? (
                              <Image
                                src={director.avatar}
                                alt={director.name}
                                width={cardDimensions.width * 0.4}
                                height={cardDimensions.width * 0.4}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Film className="w-1/2 h-1/2 text-white/60" />
                              </div>
                            )}
                          </div>
                          {isCenter && (
                            <motion.div
                              className="absolute -bottom-1 -right-1 bg-white/90 backdrop-blur-sm rounded-full p-1"
                              animate={{ rotate: [0, 10, -10, 0] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            >
                              <Quote className="w-3 h-3 text-gray-800" />
                            </motion.div>
                          )}
                        </div>
                      </div>
                      
                      {/* 감독 정보 */}
                      <div className="text-center flex-1 flex flex-col justify-center">
                        <h3 className="font-bold mb-1" style={{ fontSize: textSizes.title }}>
                          {director.nameKo}
                        </h3>
                        <p className="text-white/80 mb-1" style={{ fontSize: textSizes.subtitle }}>
                          {director.name}
                        </p>
                        <p className="text-white/60 mb-2" style={{ fontSize: textSizes.tiny }}>
                          {director.title}
                        </p>
                        
                        {/* 대표작 태그 */}
                        <div className="flex flex-wrap justify-center gap-1">
                          {director.films.slice(0, 2).map((film, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 bg-white/20 backdrop-blur-sm rounded-full font-medium"
                              style={{ fontSize: textSizes.tiny }}
                            >
                              {film}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      {/* 탭하여 뒤집기 힌트 */}
                      {isCenter && (
                        <motion.div
                          className="flex justify-center mt-1"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.5 }}
                        >
                          <span 
                            className="text-white/70 bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-full"
                            style={{ fontSize: textSizes.tiny }}
                          >
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
                    
                    <div className="relative h-full flex flex-col p-4 md:p-6 text-white">
                      <div className="flex-1 flex flex-col">
                        {/* 명언 - 컴팩트하게 */}
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2 mb-2">
                          <div className="flex items-start gap-1">
                            <Quote className="w-3 h-3 text-white/60 flex-shrink-0 mt-0.5" />
                            <p className="italic leading-tight" style={{ fontSize: textSizes.small }}>
                              "{director.quote}"
                            </p>
                          </div>
                        </div>
                        
                        {/* 대표작 - 컴팩트하게 */}
                        <div className="mb-2">
                          <h4 className="font-semibold mb-1 text-white/80" style={{ fontSize: textSizes.subtitle }}>
                            대표작
                          </h4>
                          <div className="flex flex-wrap gap-1">
                            {director.films.slice(0, 3).map((film, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 bg-white/15 backdrop-blur-sm rounded-full font-medium"
                                style={{ fontSize: textSizes.tiny }}
                              >
                                {film}
                              </span>
                            ))}
                          </div>
                        </div>
                        
                        {/* 설명 - 짧게 요약 */}
                        <div className="flex-1">
                          <p className="leading-snug text-white/90 line-clamp-3" style={{ fontSize: textSizes.small }}>
                            {director.description}
                          </p>
                        </div>
                      </div>
                      
                      {/* 선택 버튼 - 컴팩트하게 */}
                      <div 
                        className={`
                          mt-2 w-full py-2 px-3 rounded-xl font-semibold text-center transition-all duration-300
                          ${isSelected 
                            ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-black shadow-lg border-2 border-yellow-300' 
                            : 'bg-white/20 backdrop-blur-sm text-white border border-white/30'
                          }
                        `}
                        style={{ fontSize: textSizes.subtitle }}
                      >
                        <div className="flex items-center justify-center gap-1">
                          {isSelected && (
                            <div className="w-4 h-4 bg-black/20 rounded-full flex items-center justify-center">
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
      <div className="absolute top-1/2 left-2 md:left-4 right-2 md:right-4 flex justify-between pointer-events-none transform -translate-y-1/2">
        <motion.button
          className="pointer-events-auto p-2 md:p-3 bg-white/10 backdrop-blur-sm rounded-full text-white hover:bg-white/20 transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => navigateTo(currentIndex - 1)}
        >
          <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
        </motion.button>
        
        <motion.button
          className="pointer-events-auto p-2 md:p-3 bg-white/10 backdrop-blur-sm rounded-full text-white hover:bg-white/20 transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => navigateTo(currentIndex + 1)}
        >
          <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
        </motion.button>
      </div>

      {/* 인디케이터 */}
      <div className="flex-shrink-0 flex justify-center gap-1 py-1 z-20">
        {directorArray.map((_, index) => (
          <motion.button
            key={index}
            className={`
              h-1 rounded-full transition-all
              ${index === currentIndex ? 'w-5 bg-white' : 'w-1 bg-white/30'}
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