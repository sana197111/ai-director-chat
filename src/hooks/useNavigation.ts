'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect } from 'react'
import { useApp } from '@/contexts/AppContext'
import { AppState } from '@/types'
import { haptic } from '@/lib/haptic'

interface NavigationOptions {
  showConfirm?: boolean
  confirmMessage?: string
  onConfirm?: () => void
  onCancel?: () => void
}

export function useNavigation() {
  const router = useRouter()
  const { state, actions } = useApp()

  // 현재 단계에 맞는 경로 확인
  const getCurrentPath = useCallback(() => {
    switch (state.session.currentStep) {
      case 'start':
        return '/'
      case 'director':
        return '/director'
      case 'scenario':
        return '/scenario'
      case 'chat':
        return '/chat'
      default:
        return '/'
    }
  }, [state.session.currentStep])

  // 다음 단계로 이동
  const navigateNext = useCallback((options?: NavigationOptions) => {
    haptic.light()
    
    switch (state.session.currentStep) {
      case 'start':
        if (state.session.id) {
          actions.setStep('director')
          router.push('/director')
        }
        break
        
      case 'director':
        if (state.director.selected) {
          actions.setStep('scenario')
          router.push('/scenario')
        }
        break
        
      case 'scenario':
        if (state.scenario.completed) {
          actions.setStep('chat')
          router.push('/chat')
        }
        break
        
      default:
        break
    }
  }, [state, actions, router])

  // 이전 단계로 이동
  const navigateBack = useCallback((options?: NavigationOptions) => {
    haptic.light()
    
    if (options?.showConfirm) {
      // 확인 모달 표시 로직
      const confirmed = window.confirm(options.confirmMessage || '이전 단계로 돌아가시겠습니까?')
      if (!confirmed) {
        options.onCancel?.()
        return
      }
    }
    
    switch (state.session.currentStep) {
      case 'director':
        actions.setStep('start')
        router.push('/')
        break
        
      case 'scenario':
        actions.setStep('director')
        router.push('/director')
        break
        
      case 'chat':
        actions.setStep('scenario')
        router.push('/scenario')
        break
        
      default:
        router.push('/')
        break
    }
    
    options?.onConfirm?.()
  }, [state.session.currentStep, actions, router])

  // 특정 단계로 직접 이동
  const navigateTo = useCallback((step: AppState['session']['currentStep']) => {
    haptic.light()
    
    // 유효성 검사
    if (step === 'scenario' && !state.director.selected) {
      console.warn('Cannot navigate to scenario without selecting director')
      return
    }
    
    if (step === 'chat' && (!state.director.selected || !state.scenario.completed)) {
      console.warn('Cannot navigate to chat without completing previous steps')
      return
    }
    
    actions.setStep(step)
    
    switch (step) {
      case 'start':
        router.push('/')
        break
      case 'director':
        router.push('/director')
        break
      case 'scenario':
        router.push('/scenario')
        break
      case 'chat':
        router.push('/chat')
        break
    }
  }, [state, actions, router])

  // 세션 초기화 및 처음으로
  const resetAndGoHome = useCallback(() => {
    haptic.heavy()
    actions.resetAll()
    router.push('/')
  }, [actions, router])

  // 브라우저 뒤로가기 버튼 처리
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault()
      
      // 현재 경로와 상태가 일치하는지 확인
      const currentPath = window.location.pathname
      const expectedPath = getCurrentPath()
      
      if (currentPath !== expectedPath) {
        // 상태와 경로 동기화
        router.push(expectedPath)
      }
    }
    
    window.addEventListener('popstate', handlePopState)
    
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [getCurrentPath, router])

  // 페이지 이탈 방지
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.session.currentStep !== 'start' && state.session.id) {
        e.preventDefault()
        e.returnValue = '작성 중인 내용이 있습니다. 정말 나가시겠습니까?'
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [state.session])

  // 현재 단계 진행률 계산
  const getProgress = useCallback(() => {
    const steps = ['start', 'director', 'scenario', 'chat']
    const currentIndex = steps.indexOf(state.session.currentStep)
    return {
      current: currentIndex + 1,
      total: steps.length,
      percentage: ((currentIndex + 1) / steps.length) * 100
    }
  }, [state.session.currentStep])

  // 단계별 완료 상태 확인
  const isStepCompleted = useCallback((step: AppState['session']['currentStep']) => {
    switch (step) {
      case 'start':
        return !!state.session.id
      case 'director':
        return !!state.director.selected
      case 'scenario':
        return state.scenario.completed
      case 'chat':
        return state.chat.messages.length > 0
      default:
        return false
    }
  }, [state])

  // 다음 단계로 진행 가능한지 확인
  const canProceed = useCallback(() => {
    switch (state.session.currentStep) {
      case 'start':
        return !!state.session.id
      case 'director':
        return !!state.director.selected
      case 'scenario':
        return state.scenario.completed
      case 'chat':
        return false // 채팅은 마지막 단계
      default:
        return false
    }
  }, [state])

  return {
    navigateNext,
    navigateBack,
    navigateTo,
    resetAndGoHome,
    getCurrentPath,
    getProgress,
    isStepCompleted,
    canProceed,
    currentStep: state.session.currentStep
  }
}