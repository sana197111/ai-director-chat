// lib/conversation-manager.ts
// 대화 컨텍스트를 체계적으로 관리하는 시스템

import { DirectorType } from '@/types'
import { directors, directorPrompts } from '@/constants/directors'

// 대화 메시지 타입
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: Date
  metadata?: {
    choices?: Array<{ id: string; text: string; icon: string }>
    emotion?: string
    topic?: string
  }
}

// 대화 컨텍스트 타입
export interface ConversationContext {
  director: DirectorType
  scenario: [string, string, string, string]
  messages: ConversationMessage[]
  themes: string[] // 대화에서 나온 주요 테마
  emotionalJourney: string[] // 감정 변화 추적
  keyMoments: string[] // 중요한 순간들
}

// 대화 관리자 클래스
export class ConversationManager {
  private context: ConversationContext
  private maxHistoryLength: number = 20 // 토큰 제한 고려
  
  constructor(
    director: DirectorType,
    scenario: [string, string, string, string]
  ) {
    this.context = {
      director,
      scenario,
      messages: [],
      themes: [],
      emotionalJourney: [],
      keyMoments: []
    }
  }
  
  // 시스템 프롬프트 생성 (감독의 성격과 시나리오 포함)
  private generateSystemPrompt(): string {
    const directorData = directors[this.context.director]
    const directorPrompt = directorPrompts[this.context.director]
    
    return `당신은 ${directorData.nameKo} 감독입니다.
    
성격과 스타일:
${directorPrompt}

사용자의 인생 네 컷:
${this.context.scenario.map((s, idx) => `장면 ${idx + 1}: ${s}`).join('\n')}

대표 작품과 메시지:
${directorData.filmMessages?.map(film => 
  `- ${film.titleKo}: ${film.coreMessage}`
).join('\n') || ''}

핵심 가치관: ${directorData.quote}

이전에 발견한 테마들: ${this.context.themes.join(', ') || '아직 없음'}
감정의 흐름: ${this.context.emotionalJourney.join(' → ') || '탐색 중'}

위 정보를 바탕으로 사용자와 깊이 있는 대화를 나누세요.
사용자의 인생 이야기와 연결하여 통찰력 있는 조언을 제공하세요.`
  }
  
  // 메시지 추가
  addMessage(message: ConversationMessage) {
    this.context.messages.push({
      ...message,
      timestamp: message.timestamp || new Date()
    })
    
    // 히스토리 길이 관리 (오래된 메시지 압축)
    if (this.context.messages.length > this.maxHistoryLength) {
      this.compressHistory()
    }
  }
  
  // 오래된 대화 압축 (중요한 내용만 요약)
  private compressHistory() {
    const recentMessages = this.context.messages.slice(-10)
    const oldMessages = this.context.messages.slice(0, -10)
    
    // 오래된 메시지를 요약
    const summary: ConversationMessage = {
      role: 'system',
      content: `이전 대화 요약: ${oldMessages.length}개의 메시지에서 다음 내용을 다룸: 
      - 주요 주제: ${this.extractThemes(oldMessages).join(', ')}
      - 감정적 포인트: ${this.extractEmotions(oldMessages).join(', ')}`,
      timestamp: oldMessages[0].timestamp
    }
    
    this.context.messages = [summary, ...recentMessages]
  }
  
  // 주제 추출
  private extractThemes(messages: ConversationMessage[]): string[] {
    const themes: string[] = []
    messages.forEach(msg => {
      if (msg.content.includes('가족')) themes.push('가족')
      if (msg.content.includes('꿈')) themes.push('꿈')
      if (msg.content.includes('성장')) themes.push('성장')
      if (msg.content.includes('사랑')) themes.push('사랑')
      if (msg.content.includes('우정')) themes.push('우정')
      if (msg.content.includes('도전')) themes.push('도전')
      // 더 많은 테마 추가 가능
    })
    return [...new Set(themes)]
  }
  
  // 감정 추출
  private extractEmotions(messages: ConversationMessage[]): string[] {
    const emotionKeywords = {
      '기쁨': ['기뻐', '행복', '즐거', '신나'],
      '슬픔': ['슬프', '우울', '눈물', '아프'],
      '두려움': ['무서', '두려', '걱정', '불안'],
      '분노': ['화나', '짜증', '답답', '억울'],
      '놀람': ['놀라', '깜짝', '충격', '예상'],
      '사랑': ['사랑', '좋아', '그리워', '보고싶']
    }
    
    const emotions: string[] = []
    messages.forEach(msg => {
      for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
        if (keywords.some(keyword => msg.content.includes(keyword))) {
          emotions.push(emotion)
        }
      }
    })
    
    return [...new Set(emotions)]
  }
  
  // Gemini API용 프롬프트 생성
  generatePromptForGemini(userMessage: string): string {
    const systemPrompt = this.generateSystemPrompt()
    
    // 최근 대화 히스토리 (전체 컨텍스트 포함)
    const conversationHistory = this.context.messages
      .slice(-15) // 최근 15개 메시지
      .map(msg => {
        const role = msg.role === 'user' ? '사용자' : 
                    msg.role === 'assistant' ? directors[this.context.director].nameKo :
                    '시스템'
        return `${role}: ${msg.content}`
      })
      .join('\n')
    
    return `${systemPrompt}

===== 대화 히스토리 =====
${conversationHistory}

===== 새로운 메시지 =====
사용자: ${userMessage}

위 전체 대화의 맥락을 고려하여 응답해주세요.
이전에 나눈 이야기들을 참조하고, 사용자의 인생 네 컷과 연결지어 답변하세요.

JSON 형식으로 응답:
{
  "message": "감독의 응답 (이전 대화 내용을 참조하여)",
  "choices": [
    { "id": "1", "text": "선택지 1", "icon": "🎬" },
    { "id": "2", "text": "선택지 2", "icon": "🎭" },
    { "id": "3", "text": "선택지 3", "icon": "🎨" }
  ],
  "theme": "이번 대화에서 발견한 주제 (선택사항)",
  "emotion": "현재 대화의 감정적 톤 (선택사항)",
  "shouldEnd": false
}`
  }
  
  // 테마 업데이트
  updateThemes(newTheme?: string) {
    if (newTheme && !this.context.themes.includes(newTheme)) {
      this.context.themes.push(newTheme)
    }
  }
  
  // 감정 여정 업데이트
  updateEmotionalJourney(emotion?: string) {
    if (emotion) {
      this.context.emotionalJourney.push(emotion)
    }
  }
  
  // 중요한 순간 추가
  addKeyMoment(moment: string) {
    this.context.keyMoments.push(moment)
  }
  
  // 대화 요약 생성 (대화 종료 시)
  generateConversationSummary(): {
    totalMessages: number
    themes: string[]
    emotionalJourney: string[]
    keyInsights: string[]
    directorQuote: string
  } {
    const directorData = directors[this.context.director]
    
    // 주요 통찰 추출
    const keyInsights = this.extractKeyInsights()
    
    return {
      totalMessages: this.context.messages.filter(m => m.role !== 'system').length,
      themes: this.context.themes,
      emotionalJourney: this.context.emotionalJourney,
      keyInsights,
      directorQuote: this.generatePersonalizedQuote()
    }
  }
  
  // 주요 통찰 추출
  private extractKeyInsights(): string[] {
    const insights: string[] = []
    
    // 시나리오와 대화 내용을 연결
    if (this.context.themes.includes('가족')) {
      insights.push('가족과의 관계가 당신 인생의 중요한 축이군요')
    }
    if (this.context.themes.includes('성장')) {
      insights.push('끊임없는 성장을 추구하는 모습이 인상적입니다')
    }
    if (this.context.themes.includes('꿈')) {
      insights.push('꿈과 현실 사이에서 균형을 찾아가는 모습이 보입니다')
    }
    
    return insights
  }
  
  // 개인화된 인용구 생성
  private generatePersonalizedQuote(): string {
    const directorData = directors[this.context.director]
    return `${directorData.quote} - 오늘 우리의 대화를 통해 더욱 분명해졌습니다.`
  }
  
  // 전체 컨텍스트 반환
  getFullContext(): ConversationContext {
    return this.context
  }
}