'use client'

import React, { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { User, Film } from 'lucide-react'
import { Message } from '@/types'
import { TypingAnimation } from '@/components/ui'

interface ChatBubbleProps {
  message: Message
  directorName?: string
  directorAvatar?: string
  isTyping?: boolean
  onAnimationComplete?: () => void
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  directorName,
  directorAvatar,
  isTyping = false,
  onAnimationComplete
}) => {
  const bubbleRef = useRef<HTMLDivElement>(null)
  const isUser = message.role === 'user'

  // 자동 스크롤
  useEffect(() => {
    if (bubbleRef.current) {
      bubbleRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [])

  // 타이핑 효과를 위한 텍스트 분할
  const words = message.content.split(' ')
  
  return (
    <motion.div
      ref={bubbleRef}
      className={`flex gap-3 mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* 아바타 */}
      {!isUser && (
        <motion.div
          className="flex-shrink-0"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring' }}
        >
          <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center overflow-hidden">
            {directorAvatar ? (
              <img
                src={directorAvatar}
                alt={directorName}
                className="w-full h-full object-cover"
              />
            ) : (
              <Film className="w-5 h-5 text-yellow-600" />
            )}
          </div>
        </motion.div>
      )}

      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[70%]`}>
        {/* 이름 표시 */}
        {!isUser && directorName && (
          <motion.span
            className="text-xs text-gray-500 mb-1 ml-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {directorName}
          </motion.span>
        )}

        {/* 메시지 버블 */}
        <motion.div
          className={`
            relative px-4 py-3 rounded-2xl
            ${isUser 
              ? 'bg-yellow-600 text-black' 
              : 'bg-gray-100 text-gray-900'
            }
            ${isUser ? 'rounded-br-md' : 'rounded-bl-md'}
          `}
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring' }}
        >
          {isTyping ? (
            <TypingAnimation />
          ) : (
            <div className="whitespace-pre-wrap break-words">
              {/* 타이핑 애니메이션 효과 */}
              {!isUser ? (
                <motion.span>
                  {words.map((word, index) => (
                    <motion.span
                      key={index}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{
                        delay: index * 0.03,
                        duration: 0.1
                      }}
                      onAnimationComplete={
                        index === words.length - 1 ? onAnimationComplete : undefined
                      }
                    >
                      {word}{' '}
                    </motion.span>
                  ))}
                </motion.span>
              ) : (
                <span>{message.content}</span>
              )}
            </div>
          )}

          {/* 메시지 꼬리 */}
          <div
            className={`
              absolute w-0 h-0 
              ${isUser 
                ? 'right-0 bottom-0 border-l-[8px] border-l-yellow-600 border-t-[8px] border-t-transparent' 
                : 'left-0 bottom-0 border-r-[8px] border-r-gray-100 border-t-[8px] border-t-transparent'
              }
            `}
          />
        </motion.div>

        {/* 타임스탬프 */}
        <motion.span
          className="text-xs text-gray-400 mt-1 px-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {new Date(message.timestamp).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </motion.span>
      </div>

      {/* 사용자 아바타 */}
      {isUser && (
        <motion.div
          className="flex-shrink-0"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring' }}
        >
          <div className="w-10 h-10 rounded-full bg-yellow-600 flex items-center justify-center">
            <User className="w-5 h-5 text-black" />
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

// 선택지 버튼 컴포넌트
interface ChoiceButtonsProps {
  choices: Array<{ id: string; text: string; icon?: string }>
  onSelect: (choice: { id: string; text: string }) => void
  disabled?: boolean
}

export const ChoiceButtons: React.FC<ChoiceButtonsProps> = ({
  choices,
  onSelect,
  disabled = false
}) => {
  return (
    <motion.div
      className="flex flex-wrap gap-2 mb-6 px-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      {choices.map((choice, index) => (
        <motion.button
          key={choice.id}
          className={`
            flex items-center gap-2 px-4 py-2.5 rounded-xl
            bg-white border-2 border-gray-200
            hover:border-yellow-400 hover:bg-yellow-50
            active:scale-95 transition-all
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 * index, type: 'spring' }}
          onClick={() => !disabled && onSelect(choice)}
          disabled={disabled}
          whileHover={!disabled ? { scale: 1.05 } : {}}
          whileTap={!disabled ? { scale: 0.95 } : {}}
        >
          <span className="text-lg">{choice.icon || '💬'}</span>
          <span className="text-sm font-medium text-gray-700">{choice.text}</span>
        </motion.button>
      ))}
    </motion.div>
  )
}

// 시스템 메시지 컴포넌트
interface SystemMessageProps {
  message: string
  type?: 'info' | 'warning' | 'success'
}

export const SystemMessage: React.FC<SystemMessageProps> = ({
  message,
  type = 'info'
}) => {
  const colors = {
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    warning: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    success: 'bg-green-50 text-green-700 border-green-200'
  }

  return (
    <motion.div
      className={`mx-4 mb-4 px-4 py-3 rounded-lg border ${colors[type]} text-sm text-center`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      {message}
    </motion.div>
  )
}
