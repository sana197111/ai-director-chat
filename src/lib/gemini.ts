// src/lib/gemini.ts - 개선된 버전

import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  SchemaType
} from '@google/generative-ai'
import type { DirectorType, Choice, EmotionType } from '@/types'
import {
  directors,
  directorPrompts,
  defaultDirectorQuestions,
  directorStyles,
  emotionKeywords
} from '@/constants/directors'

/* ═══════════════ 0. 공통 초기화 ═══════════════ */
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
console.log('[Gemini] key loaded:', !!API_KEY)

const genAI = new GoogleGenerativeAI(API_KEY)

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
]

/* ═══════════════ 1. 모델 변경 - gemini-2.5-flash 사용 ═══════════════ */

// JSON 응답 스키마 정의
const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    message: {
      type: SchemaType.STRING,
      description: "감독의 응답 메시지"
    },
    choices: {
      type: SchemaType.ARRAY,
      description: "사용자가 선택할 수 있는 질문들",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: {
            type: SchemaType.STRING,
            description: "선택지 ID (1, 2, 3)"
          },
          text: {
            type: SchemaType.STRING,
            description: "질문 내용"
          },
          icon: {
            type: SchemaType.STRING,
            description: "이모티콘",
            nullable: true
          }
        },
        required: ["id", "text"]
      },
      minItems: 3,
      maxItems: 3
    }
  },
  required: ["message", "choices"]
}

/* ★ 개선된 JSON 타입 응답 전용 모델 팩토리 */
function jsonModel(model = 'gemini-2.5-flash') {
  try {
    // gemini-2.5-flash는 responseSchema 지원
    return genAI.getGenerativeModel({
      model,
      safetySettings,
      generationConfig: {
        temperature: 0.7,  // 낮춰서 일관성 향상
        topK: 30,          // 낮춰서 변동성 감소
        topP: 0.9,         // 약간 낮춤
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        responseSchema: responseSchema  // 스키마 적용
      }
    })
  } catch (error) {
    console.warn('responseSchema not supported, falling back to basic config')
    // 폴백: responseSchema 미지원 시
    return genAI.getGenerativeModel({
      model,
      safetySettings,
      generationConfig: {
        temperature: 0.5,  // 더 낮춤
        topK: 20,
        topP: 0.8,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json'
      }
    })
  }
}

/* ═══════════════ 3. 강력한 후처리 파이프라인 ═══════════════ */

// 개선된 choices 검증 함수
function validateChoices(choices: any): Choice[] | null {
  if (!Array.isArray(choices) || choices.length !== 3) {
    console.error('[Gemini] Invalid choices array:', choices)
    return null
  }
  
  // 예시 텍스트 감지
  const invalidTexts = [
    '질문 예시 1', '질문 예시 2', '질문 예시 3',
    '예시 질문 1', '예시 질문 2', '예시 질문 3',
    'text: "질문', 'text": "질문'
  ]
  
  const validChoices = choices.map((choice, idx) => {
    // 기본 검증
    if (!choice || typeof choice !== 'object') {
      console.error(`[Gemini] Invalid choice at index ${idx}:`, choice)
      return null
    }
    
    // ID 검증 및 수정
    const id = choice.id || String(idx + 1)
    
    // 텍스트 검증
    let text = choice.text
    if (!text || typeof text !== 'string' || text.trim() === '') {
      console.error(`[Gemini] Invalid text at index ${idx}:`, text)
      return null
    }
    
    // 예시 텍스트 검사
    if (invalidTexts.some(invalid => text.includes(invalid))) {
      console.error(`[Gemini] Example text detected at index ${idx}:`, text)
      return null
    }
    
    // 아이콘 처리
    const icon = choice.icon || ''
    
    return { id, text: text.trim(), icon }
  })
  
  // 모든 choice가 유효한지 확인
  if (validChoices.some(c => c === null)) {
    return null
  }
  
  return validChoices as Choice[]
}

function extractJSON(text: string): any {
  // 1. 직접 파싱 시도
  try {
    const trimmed = text.trim()
    const parsed = JSON.parse(trimmed)
    console.log('[Gemini] Direct JSON parse success')
    return parsed
  } catch (e) {
    console.log('[Gemini] Direct JSON parse failed, trying patterns...')
  }
  
  // 2. 다양한 패턴으로 JSON 추출
  const patterns = [
    /\{[\s\S]*\}$/,                      // 마지막 중괄호 세트
    /^\{[\s\S]*\}/,                      // 첫 중괄호 세트
    /```json\s*(\{[\s\S]*?\})\s*```/,   // 마크다운 JSON 코드 블록
    /```\s*(\{[\s\S]*?\})\s*```/,       // 일반 코드 블록
    /JSON:\s*(\{[\s\S]*?\})/,           // JSON: prefix
    /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/  // 중첩된 객체 포함
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      try {
        const jsonStr = match[1] || match[0]
        const parsed = JSON.parse(jsonStr)
        console.log('[Gemini] Pattern JSON parse success with pattern:', pattern)
        return parsed
      } catch (e) {
        console.log('[Gemini] Pattern parse failed:', pattern)
      }
    }
  }
  
  // 3. 일반적인 문제 수정 후 재시도
  let cleaned = text
    .replace(/^[^{]*/, '')      // { 이전 모든 것 제거
    .replace(/[^}]*$/, '')      // } 이후 모든 것 제거
    .replace(/,\s*}/g, '}')     // 마지막 쉼표 제거
    .replace(/,\s*]/g, ']')     // 배열 마지막 쉼표
    .replace(/'/g, '"')         // 작은따옴표 → 큰따옴표
    .replace(/(\w+):/g, '"$1":') // 따옴표 없는 키
    .replace(/\\n/g, '\n')      // 이스케이프된 줄바꿈
    .replace(/\n\s*\n/g, '\n')  // 여러 줄바꿈 정리
  
  try {
    const parsed = JSON.parse(cleaned)
    console.log('[Gemini] Cleaned JSON parse success')
    return parsed
  } catch {
    console.error('[Gemini] All JSON extraction attempts failed for:', text.substring(0, 200))
    return null
  }
}

/* ═══════════════ 4. 개선된 재시도 전략 ═══════════════ */

async function askWithRetry(
  model: ReturnType<typeof jsonModel>,
  prompt: string,
  maxTry = 5,
  validateFn?: (data: any) => boolean
) {
  let lastError: any = null
  
  for (let i = 0; i < maxTry; i++) {
    try {
      console.log(`[Gemini] Attempt ${i + 1}/${maxTry}`)
      
      // 재시도마다 프롬프트 강화
      let enhancedPrompt = prompt
      
      if (i === 1) {
        enhancedPrompt = `CRITICAL: You MUST output ONLY valid JSON. No explanations, no markdown, no backticks.
The JSON must have exactly these fields:
- message: string (your response)
- choices: array of exactly 3 objects with {id: string, text: string, icon: string}

${prompt}`
      } else if (i === 2) {
        enhancedPrompt = `YOU MUST OUTPUT ONLY VALID JSON.
Start with { and end with }
NO BACKTICKS. NO MARKDOWN. NO EXPLANATIONS.
EXACTLY 3 CHOICES WITH REAL QUESTIONS, NOT EXAMPLES.

${prompt}`
      } else if (i >= 3) {
        // Temperature 조정을 위한 모델 재생성
        const adjustedModel = genAI.getGenerativeModel({
          model: model.model,
          safetySettings,
          generationConfig: {
            temperature: Math.max(0.1, 0.7 - (i * 0.2)), // 재시도마다 낮춤
            topK: 20,
            topP: 0.8,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json'
          }
        })
        
        const { response } = await adjustedModel.generateContent(enhancedPrompt)
        const text = response.text()
        console.log(`[Gemini] Adjusted response (attempt ${i + 1}):`, text.substring(0, 200))
        
        const data = extractJSON(text)
        if (data && data.message && Array.isArray(data.choices)) {
          // 추가 검증
          if (validateFn && !validateFn(data)) {
            throw new Error('Validation failed')
          }
          console.log('[Gemini] JSON parsed and validated successfully with adjusted model')
          return data
        }
      } else {
        const { response } = await model.generateContent(enhancedPrompt)
        const text = response.text()
        console.log(`[Gemini] Raw response (attempt ${i + 1}):`, text.substring(0, 200))
        
        const data = extractJSON(text)
        if (data && data.message && Array.isArray(data.choices)) {
          // 추가 검증
          if (validateFn && !validateFn(data)) {
            throw new Error('Validation failed')
          }
          console.log('[Gemini] JSON parsed and validated successfully')
          return data
        }
      }
      
      throw new Error('Invalid JSON structure or validation failed')
      
    } catch (e) {
      lastError = e
      console.error(`[Gemini] Attempt ${i + 1} failed:`, e)
      
      // 짧은 대기 후 재시도
      if (i < maxTry - 1) {
        await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)))
      }
    }
  }
  
  throw new Error(`JSON parse failed after ${maxTry} attempts: ${lastError}`)
}

/* ═══════════════ 2. 프롬프트 개선 - 더 명확한 JSON 지시 ═══════════════ */

const greetingPrompt = (
  director: DirectorType,
  scenario: [string, string, string, string]
) => {
  const dir = directors[director]
  const analysis = analyzeScenario(scenario)
  
  // 모든 시나리오를 활용
  const scenarioText = `
장면 1 (기뻤던 장면): "${scenario[0]}"
장면 2 (화났던 장면): "${scenario[1]}"
장면 3 (슬펐던 장면): "${scenario[2]}"
장면 4 (즐거웠던 장면): "${scenario[3]}"
`

  // 감독별 말투 설정
  const speechStyle = ['bong', 'miyazaki', 'docter'].includes(director) ? '반말' : '존댓말'

  // 실제 질문 예시로 변경
  const actualQuestions = generateScenarioQuestions(director, scenario, 'early')
  const jsonExample = JSON.stringify({
    message: `안녕하세요! "${scenario[0]}" 이 장면이 정말 인상적이네요. 함께 이야기 나눠볼까요?`,
    choices: actualQuestions
  }, null, 2)

  return `YOU MUST OUTPUT ONLY JSON. Example format:
${jsonExample}

당신은 ${dir.nameKo} 감독입니다. 당신의 대표작은 ${dir.films.slice(0, 2).join(', ')} 등입니다.
${speechStyle}로 조언해주고, 대답하세요.

일반인 배우(사용자)가 인생의 중요한 네 장면을 공유했습니다:
${scenarioText}

지시사항:
1. 네 장면 중에서 가장 인상 깊은 2개 장면을 반드시 골라서 언급하세요
2. 선택한 장면을 그대로 인용하며 깊이 공감하세요
3. 그 장면들을 당신의 영화 작품과 연결지어 설명하세요
4. 시나리오에 있는 내용만 사용하세요. 추가로 상상하지 마세요
5. 5-7문장으로 따뜻하게 인사하세요
6. message에서 2-3문장마다 \\n\\n으로 줄바꿈을 하세요 (두 번 줄바꿈)
7. 답변 중간이나 마지막에 자연스럽게 이모티콘 2-3개를 넣으세요
8. choices는 반드시 배우가 감독에게 묻는 실제 질문 3개여야 합니다 (예시 텍스트 금지)

OUTPUT ONLY VALID JSON:`
}

const replyPrompt = (
  director: DirectorType,
  scenario: string[],
  history: string,
  user: string
) => {
  const dir = directors[director]
  
  // 감독별 말투 설정
  const speechStyle = ['bong', 'miyazaki', 'docter'].includes(director) ? '반말' : '존댓말'
  
  // 대화 분석
  const questionType = analyzeQuestionType(user)
  const mentionedScenarios = extractMentionedScenarios(history)
  const conversationDepth = analyzeConversationDepth(
    history.split('\n').map(line => {
      const [role, ...content] = line.split(': ')
      return { role: role === '나' ? 'user' : 'assistant', content: content.join(': ') }
    })
  )
  
  // 현재 대화와 가장 관련 있는 시나리오 찾기
  let relevantScenario = ''
  let scenarioLabel = ''
  let scenarioIndex = -1
  
  // 이전 대화에서 언급된 시나리오 추적
  const prevMentioned = history.includes('기쁨') || history.includes('1번') ? 0 :
                       history.includes('화남') || history.includes('2번') ? 1 :
                       history.includes('슬픔') || history.includes('3번') ? 2 :
                       history.includes('즐거움') || history.includes('4번') ? 3 : -1
  
  // 사용자 메시지에서 관련 시나리오 찾기
  if (user.includes('기쁨') || user.includes('행복') || user.includes('좋았')) {
    relevantScenario = scenario[0]
    scenarioLabel = '기뻤던 순간'
    scenarioIndex = 0
  } else if (user.includes('화') || user.includes('분노') || user.includes('답답')) {
    relevantScenario = scenario[1]
    scenarioLabel = '화났던 순간'
    scenarioIndex = 1
  } else if (user.includes('슬픔') || user.includes('눈물') || user.includes('아프')) {
    relevantScenario = scenario[2]
    scenarioLabel = '슬펐던 순간'
    scenarioIndex = 2
  } else if (user.includes('즐거') || user.includes('재미') || user.includes('웃음')) {
    relevantScenario = scenario[3]
    scenarioLabel = '즐거웠던 순간'
    scenarioIndex = 3
  } else if (prevMentioned >= 0) {
    // 이전 대화에서 언급된 시나리오 이어가기
    relevantScenario = scenario[prevMentioned]
    scenarioLabel = ['기뻤던 순간', '화났던 순간', '슬펐던 순간', '즐거웠던 순간'][prevMentioned]
    scenarioIndex = prevMentioned
  } else {
    // 랜덤하게 하나 선택
    const idx = Math.floor(Math.random() * 4)
    relevantScenario = scenario[idx]
    scenarioLabel = ['기뻤던 순간', '화났던 순간', '슬펐던 순간', '즐거웠던 순간'][idx]
    scenarioIndex = idx
  }

  // 실제 질문으로 JSON 예시 생성
  const stage = conversationDepth === 0 ? 'early' : conversationDepth === 1 ? 'mid' : 'late'
  const actualQuestions = generateScenarioQuestions(director, scenario, stage)
  const jsonExample = JSON.stringify({
    message: "감독의 답변입니다.",
    choices: actualQuestions
  }, null, 2)

  return `YOU MUST OUTPUT ONLY JSON. Example format:
${jsonExample}

당신은 ${dir.nameKo} 감독입니다. 대표작: ${dir.films.slice(0, 2).join(', ')}
${speechStyle}로 대답하세요.

배우의 인생 네 장면:
1. 기뻤던 순간: "${scenario[0]}"
2. 화났던 순간: "${scenario[1]}"
3. 슬펐던 순간: "${scenario[2]}" 
4. 즐거웠던 순간: "${scenario[3]}"

현재 대화 맥락:
- 주로 다루고 있는 장면: ${scenarioLabel} (인덱스: ${scenarioIndex})
- 질문 유형: ${questionType}
- 대화 깊이: ${conversationDepth} (0=얕음, 1=보통, 2=깊음, 3=매우깊음)
- 이전에 언급된 시나리오 수: ${mentionedScenarios.length}

최근 대화:
${history}

사용자의 현재 질문: "${user}"

중요 지시사항:
1. **반복 금지**: 이미 언급한 시나리오를 그대로 반복하지 마세요. 
   - 처음 언급: 전체 인용 가능
   - 두번째부터: "그때", "그 순간", "그 감정" 등으로 축약
   - 절대 같은 문장을 복사-붙여넣기 하지 마세요

2. **질문에 맞는 답변**:
   - how 질문 → 구체적인 방법이나 과정 설명
   - why 질문 → 이유나 배경 설명
   - experience 질문 → 감독 자신의 경험 공유
   - feeling 질문 → 감정적 공감과 이해 표현

3. **대화 진전**:
   - 같은 주제를 다른 각도로 접근
   - 대화가 깊어질수록 더 구체적이고 개인적인 이야기
   - 감독의 영화 철학이나 개인 경험 추가

4. **자연스러운 연결**:
   - 이전 대화를 자연스럽게 이어받아 발전
   - "아까 말한", "그래서", "그런 의미에서" 등 연결어 사용

5. message에서 2-4문장으로 답변하되, 대화가 깊어질수록 조금 더 길게
6. message에서 2문장마다 \\n\\n으로 줄바꿈
7. 마지막에 감독 특성에 맞는 이모티콘 하나
8. choices는 반드시 배우가 감독에게 묻는 실제 질문 3개 (예시 텍스트 절대 금지)

OUTPUT ONLY VALID JSON:`
}

/* ═══════════════ 기존 헬퍼 함수들 - 모두 유지 ═══════════════ */

/* 여러 줄 → 원하는 줄까지만 자르기 */
const firstLines = (txt: string, n = 10) =>
  txt.split('\n').slice(0, n).join('\n').trim()

/* 한 문장만 남기기 유틸 */
const oneLine = (txt = ''): string =>
  txt.replace(/\n/g, ' ').split(/[.!?]\s/)[0]?.trim() || ''

/* <NL> 토큰을 실제 줄바꿈으로 변환 */
const tidy = (raw: string) =>
  raw.replace(/<NL>/g, '\n\n').trim()

/* 잘못된 choice 값 보정 */
function safeChoice(raw: unknown, idx: number, dir: DirectorType): Choice {
  const fb = defaultDirectorQuestions[dir][idx] || {
    id: String(idx + 1),
    text: `질문 ${idx + 1}`,
    icon: ''
  }
  const r = raw as Partial<Choice> | undefined
  return {
    id: r?.id || fb.id,
    text: oneLine(r?.text) || fb.text,
    icon: r?.icon ?? fb.icon
  }
}

/* ═══════════════ 시나리오 분석 헬퍼 ═══════════════ */
const analyzeScenario = (scenario: string[]): { 
  mainTheme: string, 
  emotions: string[], 
  keyMoments: string[],
  details: Record<string, string[]>
} => {
  // 각 장면에서 구체적 디테일 추출
  const details: Record<string, string[]> = {
    joy: extractDetails(scenario[0]),
    anger: extractDetails(scenario[1]),
    sadness: extractDetails(scenario[2]),
    pleasure: extractDetails(scenario[3])
  }
  
  // 시나리오에서 주요 테마와 감정 추출
  const allText = scenario.join(' ')
  
  const emotions = []
  if (allText.includes('기쁨') || allText.includes('성취') || allText.includes('행복')) emotions.push('기쁨')
  if (allText.includes('화남') || allText.includes('분노') || allText.includes('답답')) emotions.push('분노')
  if (allText.includes('슬픔') || allText.includes('눈물') || allText.includes('아픔')) emotions.push('슬픔')
  if (allText.includes('즐거움') || allText.includes('웃음') || allText.includes('재미')) emotions.push('즐거움')
  if (allText.includes('사랑') || allText.includes('연인') || allText.includes('좋아')) emotions.push('사랑')
  
  return {
    mainTheme: emotions[0] || '감정',
    emotions,
    keyMoments: scenario.filter(s => s.length > 20),
    details
  }
}

// 장면에서 구체적 디테일 추출
function extractDetails(scene: string): string[] {
  const details = []
  
  // 장소
  const places = scene.match(/(학교|집|공원|버스|정류장|카페|도서관|운동장|교실|방)/g)
  if (places) details.push(...places)
  
  // 시간/계절
  const times = scene.match(/(봄|여름|가을|겨울|아침|점심|저녁|밤|방학|주말)/g)
  if (times) details.push(...times)
  
  // 특별한 대사나 표현
  const quotes = scene.match(/"([^"]+)"/g)
  if (quotes) details.push(...quotes.map(q => q.replace(/"/g, '')))
  
  return details
}

/* ═══════════════ 대화 분석 헬퍼 ═══════════════ */

// 이전 대화에서 언급된 시나리오 추출
function extractMentionedScenarios(history: string): string[] {
  const mentioned = []
  
  // 전체 시나리오 언급 찾기
  const fullScenarioPattern = /"([^"]+)"/g
  const matches = history.match(fullScenarioPattern)
  if (matches) {
    mentioned.push(...matches.map(m => m.replace(/"/g, '')))
  }
  
  // 축약된 언급 찾기 (그때, 그 순간, 그 시절 등)
  if (history.includes('그때') || history.includes('그 순간') || history.includes('그 시절')) {
    mentioned.push('previous_moment')
  }
  
  return mentioned
}

// 질문 유형 분석
function analyzeQuestionType(userMessage: string): string {
  if (userMessage.includes('어떻게') || userMessage.includes('방법')) return 'how'
  if (userMessage.includes('왜') || userMessage.includes('이유')) return 'why'
  if (userMessage.includes('무엇') || userMessage.includes('뭐')) return 'what'
  if (userMessage.includes('언제')) return 'when'
  if (userMessage.includes('누구')) return 'who'
  if (userMessage.includes('경험') || userMessage.includes('있나요') || userMessage.includes('있으신가요')) return 'experience'
  if (userMessage.includes('느낌') || userMessage.includes('감정')) return 'feeling'
  return 'general'
}

// 대화 단계 분석 (더 정교하게)
function analyzeConversationDepth(messages: Array<{ role: string; content: string }>): number {
  let depth = 0
  const userMessages = messages.filter(m => m.role === 'user')
  
  // 같은 주제로 대화가 이어지고 있는지 확인
  if (userMessages.length > 2) {
    const lastThreeTopics = userMessages.slice(-3).map(m => detectTopic(m.content))
    if (lastThreeTopics.every(t => t === lastThreeTopics[0])) {
      depth += 2 // 같은 주제로 깊이 있게 대화 중
    }
  }
  
  // 구체적인 질문이 이어지고 있는지
  const lastUserMsg = userMessages[userMessages.length - 1]?.content || ''
  if (lastUserMsg.includes('구체적') || lastUserMsg.includes('예를 들어') || lastUserMsg.includes('어떻게')) {
    depth += 1
  }
  
  return depth
}

/* 주제 감지 헬퍼 - 더 정교하게 */
function detectTopic(text: string): string {
  const topics = {
    기쁨: ['기쁨', '행복', '좋아', '즐거', '웃음', '미소', '설레'],
    분노: ['화', '분노', '짜증', '답답', '억울', '불공평'],
    슬픔: ['슬픔', '눈물', '아픔', '외로움', '그리움', '쓸쓸'],
    즐거움: ['즐거움', '재미', '신나', '흥미', '웃음', '유쾌'],
    사랑: ['사랑', '연인', '좋아', '설레', '애정', '마음'],
    가족: ['가족', '부모', '엄마', '아빠', '형제', '동생', '누나'],
    꿈: ['꿈', '목표', '미래', '희망', '도전', '포부'],
    성장: ['성장', '변화', '어른', '철들', '깨달음'],
    일상: ['하루', '일상', '평범', '매일', '오늘']
  }
  
  let maxCount = 0
  let detectedTopic = '일상'
  
  for (const [topic, keywords] of Object.entries(topics)) {
    const count = keywords.filter(keyword => text.includes(keyword)).length
    if (count > maxCount) {
      maxCount = count
      detectedTopic = topic
    }
  }
  
  return detectedTopic
}

/* ═══════════════ 시나리오 기반 동적 질문 생성 ═══════════════ */

export const generateScenarioQuestions = (
  director: DirectorType, 
  scenario: string[],
  stage: 'early' | 'mid' | 'late',
  currentTopic?: string
): Choice[] => {
  const analysis = analyzeScenario(scenario)
  
  // 감독별 시나리오 기반 질문 - 사용자가 감독에게 묻는 형식
  const scenarioQuestions: Record<DirectorType, Record<string, Choice[]>> = {
    bong: {
      early: [
        { 
          id: '1', 
          text: '제 감정들도 사회적 의미가 있을까요?', 
          icon: '🎭' 
        },
        { 
          id: '2', 
          text: '평범한 일상에도 계급이 숨어있나요?', 
          icon: '🔍' 
        },
        { 
          id: '3', 
          text: '감정의 온도차도 계급차일까요?', 
          icon: '🌡️' 
        }
      ],
      mid: [
        { 
          id: '1', 
          text: '제 인생의 계단은 어디에 있을까요?', 
          icon: '🪜' 
        },
        { 
          id: '2', 
          text: '작은 감정에도 큰 의미가 있을까요?', 
          icon: '✨' 
        },
        { 
          id: '3', 
          text: '감정의 변화가 삶을 바꿀 수 있나요?', 
          icon: '🔄' 
        }
      ],
      late: [
        { 
          id: '1', 
          text: '지금의 저는 어느 계층일까요?', 
          icon: '🏠' 
        },
        { 
          id: '2', 
          text: '제 인생의 반전을 만들려면?', 
          icon: '🎬' 
        },
        { 
          id: '3', 
          text: '감독님이 제 이야기를 영화로 만든다면?', 
          icon: '📽️' 
        }
      ]
    },
    
    nolan: {
      early: [
        { 
          id: '1', 
          text: '제 기억도 퍼즐처럼 조각나있을까요?', 
          icon: '🧩' 
        },
        { 
          id: '2', 
          text: '시간을 되돌릴 수 있다면 무엇을 바꿀까요?', 
          icon: '⏳' 
        },
        { 
          id: '3', 
          text: '감정의 시간은 다르게 흐르나요?', 
          icon: '🌀' 
        }
      ],
      mid: [
        { 
          id: '1', 
          text: '평행우주의 저는 어떤 감정일까요?', 
          icon: '🌌' 
        },
        { 
          id: '2', 
          text: '작은 순간이 큰 변화를 만들 수 있나요?', 
          icon: '🦋' 
        },
        { 
          id: '3', 
          text: '기억하고 싶은 순간을 영원히 간직하려면?', 
          icon: '💎' 
        }
      ],
      late: [
        { 
          id: '1', 
          text: '우리 대화도 시공간에 남을까요?', 
          icon: '♾️' 
        },
        { 
          id: '2', 
          text: '끝이 새로운 시작이 될 수 있을까요?', 
          icon: '🔮' 
        },
        { 
          id: '3', 
          text: '시간의 미로에서 나를 찾는 방법은?', 
          icon: '🗝️' 
        }
      ]
    },
    
    miyazaki: {
      early: [
        { 
          id: '1', 
          text: '제 감정들에도 정령이 있을까요?', 
          icon: '🌸' 
        },
        { 
          id: '2', 
          text: '어린 시절의 순수함을 되찾을 수 있을까요?', 
          icon: '✨' 
        },
        { 
          id: '3', 
          text: '자연이 주는 위로를 느끼는 방법은?', 
          icon: '🍃' 
        }
      ],
      mid: [
        { 
          id: '1', 
          text: '진짜 나를 찾아가는 여정은 어떤가요?', 
          icon: '🎭' 
        },
        { 
          id: '2', 
          text: '성장하면서 얻은 마법은 무엇인가요?', 
          icon: '🌟' 
        },
        { 
          id: '3', 
          text: '일상 속 작은 기적을 발견하려면?', 
          icon: '🧚' 
        }
      ],
      late: [
        { 
          id: '1', 
          text: '제 마음의 숲은 어떤 모습일까요?', 
          icon: '🌲' 
        },
        { 
          id: '2', 
          text: '내일은 어떤 모험이 기다릴까요?', 
          icon: '🌅' 
        },
        { 
          id: '3', 
          text: '어른이 되어도 동심을 지키는 방법은?', 
          icon: '💝' 
        }
      ]
    },
    
    curtis: {
      early: [
        { 
          id: '1', 
          text: '모든 감정이 사랑의 한 형태일까요?', 
          icon: '💕' 
        },
        { 
          id: '2', 
          text: '일상이 특별해지는 순간은 언제인가요?', 
          icon: '✨' 
        },
        { 
          id: '3', 
          text: '작은 행복을 큰 기쁨으로 만드는 법은?', 
          icon: '🎁' 
        }
      ],
      mid: [
        { 
          id: '1', 
          text: '운명적인 순간은 어떻게 알아볼까요?', 
          icon: '⭐' 
        },
        { 
          id: '2', 
          text: '다시 살고 싶은 하루가 있나요?', 
          icon: '⏰' 
        },
        { 
          id: '3', 
          text: '완벽하지 않아도 사랑스러운 이유는?', 
          icon: '💝' 
        }
      ],
      late: [
        { 
          id: '1', 
          text: '오늘도 누군가의 러브스토리일까요?', 
          icon: '💌' 
        },
        { 
          id: '2', 
          text: '사랑을 표현하는 가장 좋은 방법은?', 
          icon: '🌹' 
        },
        { 
          id: '3', 
          text: '행복한 엔딩은 어떻게 만들까요?', 
          icon: '🌈' 
        }
      ]
    },
    
    chazelle: {
      early: [
        { 
          id: '1', 
          text: '제 인생도 음악처럼 리듬이 있나요?', 
          icon: '🎵' 
        },
        { 
          id: '2', 
          text: '열정과 현실 사이의 균형점은?', 
          icon: '⚖️' 
        },
        { 
          id: '3', 
          text: '꿈을 향한 첫 발걸음은 어떻게?', 
          icon: '👣' 
        }
      ],
      mid: [
        { 
          id: '1', 
          text: '인생을 즉흥 연주하는 방법은?', 
          icon: '🎷' 
        },
        { 
          id: '2', 
          text: '완벽보다 중요한 것은 무엇일까요?', 
          icon: '💫' 
        },
        { 
          id: '3', 
          text: '실패도 아름다울 수 있나요?', 
          icon: '🎨' 
        }
      ],
      late: [
        { 
          id: '1', 
          text: '제 인생의 OST는 무엇일까요?', 
          icon: '🎬' 
        },
        { 
          id: '2', 
          text: '내일의 멜로디를 어떻게 만들까요?', 
          icon: '🎹' 
        },
        { 
          id: '3', 
          text: '앙코르를 외치고 싶은 순간은?', 
          icon: '👏' 
        }
      ]
    },
    
    docter: {
      early: [
        { 
          id: '1', 
          text: '모든 감정이 필요한 이유는?', 
          icon: '🌈' 
        },
        { 
          id: '2', 
          text: '감정들이 서로 대화한다면?', 
          icon: '💬' 
        },
        { 
          id: '3', 
          text: '오늘의 주인공 감정은 누구인가요?', 
          icon: '🎭' 
        }
      ],
      mid: [
        { 
          id: '1', 
          text: '소중한 기억이 만들어지는 순간은?', 
          icon: '💫' 
        },
        { 
          id: '2', 
          text: '잊혀진 감정을 되찾을 수 있나요?', 
          icon: '🔍' 
        },
        { 
          id: '3', 
          text: '제 스파크는 무엇일까요?', 
          icon: '✨' 
        }
      ],
      late: [
        { 
          id: '1', 
          text: '오늘 생긴 새로운 감정의 이름은?', 
          icon: '🎨' 
        },
        { 
          id: '2', 
          text: '모든 감정이 모여 만든 저는?', 
          icon: '🌟' 
        },
        { 
          id: '3', 
          text: '내일은 어떤 감정과 시작할까요?', 
          icon: '🌅' 
        }
      ]
    }
  }
  
  return scenarioQuestions[director]?.[stage] || easyDirectorQuestions[director][stage]
}

/* ═══════════════ 실용적 추천 질문 ═══════════════ */

// 영화 지식 없이도 답할 수 있는 일상 질문들
export const easyDirectorQuestions: Record<DirectorType, {
  early: Choice[],
  mid: Choice[],
  late: Choice[]
}> = {
  bong: {
    early: [
      { id: '1', text: '오늘 하루 가장 웃겼던 순간은?', icon: '😄' },
      { id: '2', text: '평범해 보이지만 특별했던 일은?', icon: '🔍' },
      { id: '3', text: '최근에 깨달은 작은 진실이 있다면?', icon: '💡' }
    ],
    mid: [
      { id: '1', text: '나만 아는 우리 동네 비밀 장소는?', icon: '🏘️' },
      { id: '2', text: '겉과 속이 다른 나의 모습은?', icon: '🎭' },
      { id: '3', text: '계단 오르듯 성장한 경험은?', icon: '📈' }
    ],
    late: [
      { id: '1', text: '오늘 대화로 바뀐 생각이 있나요?', icon: '🌟' },
      { id: '2', text: '내일 당장 시도해볼 것은?', icon: '🚀' },
      { id: '3', text: '마지막으로 나누고 싶은 이야기는?', icon: '💬' }
    ]
  },
  
  nolan: {
    early: [
      { id: '1', text: '시간이 멈춘다면 뭘 하고 싶나요?', icon: '⏸️' },
      { id: '2', text: '가장 선명하게 기억나는 꿈은?', icon: '💭' },
      { id: '3', text: '10년 전 나에게 한마디 한다면?', icon: '⏪' }
    ],
    mid: [
      { id: '1', text: '인생의 중요한 선택의 순간은?', icon: '🎯' },
      { id: '2', text: '반복하고 싶은 하루가 있다면?', icon: '🔄' },
      { id: '3', text: '미래의 나는 어떤 모습일까요?', icon: '🔮' }
    ],
    late: [
      { id: '1', text: '시간의 의미를 새롭게 느낀 점은?', icon: '⏰' },
      { id: '2', text: '오늘부터 바꿔볼 일상 습관은?', icon: '✨' },
      { id: '3', text: '이 순간을 어떻게 기억하고 싶나요?', icon: '📸' }
    ]
  },
  
  miyazaki: {
    early: [
      { id: '1', text: '어릴 때 상상했던 마법 같은 일은?', icon: '✨' },
      { id: '2', text: '자연에서 위로받았던 순간은?', icon: '🌿' },
      { id: '3', text: '순수했던 어린 시절 기억은?', icon: '🎈' }
    ],
    mid: [
      { id: '1', text: '나를 지켜주는 것이 있다면?', icon: '🛡️' },
      { id: '2', text: '성장하면서 잃어버린 것과 얻은 것은?', icon: '🌱' },
      { id: '3', text: '가장 아름다웠던 풍경은?', icon: '🌅' }
    ],
    late: [
      { id: '1', text: '마음속 순수함을 지키는 방법은?', icon: '💝' },
      { id: '2', text: '내일 자연과 함께할 계획은?', icon: '🍃' },
      { id: '3', text: '어린아이처럼 해보고 싶은 것은?', icon: '🎪' }
    ]
  },
  
  curtis: {
    early: [
      { id: '1', text: '최근에 받은 따뜻한 말 한마디는?', icon: '💌' },
      { id: '2', text: '웃음이 터졌던 엉뚱한 순간은?', icon: '😂' },
      { id: '3', text: '사랑을 느낀 작은 순간은?', icon: '❤️' }
    ],
    mid: [
      { id: '1', text: '고맙지만 표현 못한 사람이 있나요?', icon: '🤗' },
      { id: '2', text: '인생 최고의 크리스마스 기억은?', icon: '🎄' },
      { id: '3', text: '평범하지만 특별한 나의 하루는?', icon: '🌟' }
    ],
    late: [
      { id: '1', text: '오늘 전하고 싶은 사랑의 메시지는?', icon: '💕' },
      { id: '2', text: '내일 만날 사람에게 할 일은?', icon: '🎁' },
      { id: '3', text: '행복을 나누는 나만의 방법은?', icon: '🌈' }
    ]
  },
  
  chazelle: {
    early: [
      { id: '1', text: '나만의 리듬이 있는 순간은?', icon: '🎵' },
      { id: '2', text: '열정적으로 빠져본 취미는?', icon: '🔥' },
      { id: '3', text: '꿈과 현실 사이 나의 위치는?', icon: '⚖️' }
    ],
    mid: [
      { id: '1', text: '완벽보다 중요한 가치는?', icon: '💎' },
      { id: '2', text: '실패했지만 배운 경험은?', icon: '📚' },
      { id: '3', text: '나를 춤추게 하는 것은?', icon: '💃' }
    ],
    late: [
      { id: '1', text: '인생의 템포를 조절하는 법은?', icon: '🎹' },
      { id: '2', text: '내일의 나를 위한 연습은?', icon: '🎯' },
      { id: '3', text: '삶의 앙코르를 외치고 싶은 순간은?', icon: '👏' }
    ]
  },
  
  docter: {
    early: [
      { id: '1', text: '오늘 느낀 감정들의 색깔은?', icon: '🎨' },
      { id: '2', text: '가장 소중한 추억 하나는?', icon: '💫' },
      { id: '3', text: '나를 웃게 하는 작은 것들은?', icon: '😊' }
    ],
    mid: [
      { id: '1', text: '슬픔도 필요하다고 느낀 순간은?', icon: '💙' },
      { id: '2', text: '감정을 솔직하게 표현하는 법은?', icon: '💬' },
      { id: '3', text: '마음속 진짜 나의 모습은?', icon: '🪞' }
    ],
    late: [
      { id: '1', text: '모든 감정을 인정하는 방법은?', icon: '🤲' },
      { id: '2', text: '내일 만들 새로운 추억은?', icon: '🎪' },
      { id: '3', text: '오늘 발견한 나의 스파크는?', icon: '✨' }
    ]
  }
}

/* ═══════════════ 쉬운 대화를 위한 헬퍼 함수들 ═══════════════ */

// 영화 제목 형식 정리 (「」 기호 제거)
function cleanMovieTitle(text: string): string {
  const replacements = {
    '「기생충」': '기생충',
    '「인셉션」': '인셉션',
    '「토토로」': '토토로',
    '「러브 액츄얼리」': '러브 액츄얼리',
    '「라라랜드」': '라라랜드',
    '「인사이드 아웃」': '인사이드 아웃',
    '「인터스텔라」': '인터스텔라',
    '「메멘토」': '메멘토',
    '「테넷」': '테넷',
    '「센과 치히로의 행방불명」': '센과 치히로',
    '「하울의 움직이는 성」': '하울',
    '「노팅힐」': '노팅힐',
    '「어바웃 타임」': '어바웃 타임',
    '「위플래쉬」': '위플래쉬',
    '「소울」': '소울',
    '「업」': '업'
  }
  
  let cleaned = text
  for (const [movie, simple] of Object.entries(replacements)) {
    cleaned = cleaned.replace(movie, simple)
  }
  
  return cleaned
}

// 실용적 조언 생성
function generatePracticalTip(director: DirectorType, topic: string, scenario?: string[]): string {
  const tips: Record<DirectorType, Record<string, string>> = {
    bong: {
      default: '오늘 지하철에서 사람들을 10초씩 관찰해보세요',
      기쁨: '그 기쁜 순간을 사진으로 남겨보세요',
      분노: '화났던 상황을 다른 시각으로 바라봐보세요',
      슬픔: '슬픔을 일기로 써서 정리해보세요',
      즐거움: '즐거웠던 순간을 친구와 나눠보세요'
    },
    curtis: {
      default: '오늘 만나는 사람에게 진심 담은 칭찬 한마디 하기',
      기쁨: '기쁨을 주변 사람들과 나누기',
      분노: '화가 났던 사람을 이해해보기',
      슬픔: '슬픔을 따뜻한 차 한 잔과 함께 달래기',
      즐거움: '즐거운 기억을 편지로 써보기'
    },
    miyazaki: {
      default: '점심시간에 5분만 하늘 구경하기',
      기쁨: '기쁜 순간을 그림으로 그려보기',
      분노: '자연 속에서 10분 걷기',
      슬픔: '좋아하는 나무를 찾아 대화하기',
      즐거움: '바람 소리에 귀 기울이기'
    },
    nolan: {
      default: '하루를 거꾸로 일기 써보기',
      기쁨: '그 순간을 영화의 한 장면처럼 기록하기',
      분노: '화났던 순간을 다른 각도에서 분석하기',
      슬픔: '슬픔의 타임라인 만들어보기',
      즐거움: '즐거운 기억을 퍼즐처럼 재구성하기'
    },
    chazelle: {
      default: '좋아하는 노래 들으며 5분 자유롭게 움직이기',
      기쁨: '기쁨을 리듬으로 표현해보기',
      분노: '화를 드럼 치듯 풀어보기',
      슬픔: '슬픈 감정을 멜로디로 만들기',
      즐거움: '즐거움을 춤으로 표현하기'
    },
    docter: {
      default: '오늘 느낀 감정 3개를 색으로 표현해보기',
      기쁨: '기쁨이에게 편지 쓰기',
      분노: '분노와 대화해보기',
      슬픔: '슬픔이를 따뜻하게 안아주기',
      즐거움: '모든 감정들과 파티하기'
    }
  }
  
  const directorTips = tips[director]
  
  // 시나리오 내용을 참고해서 더 구체적인 팁 생성
  if (scenario && topic === '기쁨' && scenario[0]) {
    const detail = extractDetails(scenario[0])[0]
    if (detail) {
      return `그 ${detail}에서의 기쁨을 다시 한 번 느껴보세요`
    }
  }
  
  return directorTips[topic] || directorTips.default
}

/* ═══════════════ 테스트 헬퍼 ═══════════════ */
export async function testGeminiAPI() {
  try {
    if (!API_KEY) throw new Error('no key')
    const model = jsonModel()
    const { response } = await model.generateContent('Say "OK" in JSON format')
    return { success: true, message: response.text() }
  } catch (e) {
    return { success: false, message: String(e) }
  }
}

/* ═══════════════ 개선된 메인 함수들 ═══════════════ */

// 새로운 버전: 선택된 감정 하나만 처리
export async function generateInitialGreeting(
  director: DirectorType,
  scenario: { selectedEmotion: EmotionType; content: string }
): Promise<{ message: string; choices: Choice[] }>

// 기존 버전: 4개 씬 모두 처리 (호환성)
export async function generateInitialGreeting(
  director: DirectorType,
  scenario: [string, string, string, string]
): Promise<{ message: string; choices: Choice[] }>

// 실제 구현
export async function generateInitialGreeting(
  director: DirectorType,
  scenario: [string, string, string, string] | { selectedEmotion: EmotionType; content: string }
) {
  try {
    const startTime = Date.now()
    const model = jsonModel('gemini-2.5-flash')
    
    // 시나리오 형태 변환
    let scenarioArray: [string, string, string, string]
    if (Array.isArray(scenario)) {
      scenarioArray = scenario
    } else {
      // 선택된 감정만 있는 경우, 나머지는 빈 문자열로 채움
      const emotionIndex = {
        'joy': 0,
        'anger': 1,
        'sadness': 2,
        'pleasure': 3
      }[scenario.selectedEmotion]
      scenarioArray = ['', '', '', ''] as [string, string, string, string]
      scenarioArray[emotionIndex] = scenario.content
    }
    
    // choices 검증 함수
    const validateResponse = (data: any) => {
      if (!data.message || typeof data.message !== 'string') {
        console.error('[Gemini] Invalid message:', data.message)
        return false
      }
      const validatedChoices = validateChoices(data.choices)
      if (!validatedChoices) {
        console.error('[Gemini] Choices validation failed')
        return false
      }
      data.choices = validatedChoices
      return true
    }
    
    const data = await askWithRetry(
      model,
      greetingPrompt(director, scenarioArray),
      5,
      validateResponse
    )
    
    // 영화 제목 형식 정리
    const cleanedMessage = cleanMovieTitle(tidy(data.message))
    
    console.log(`[Gemini] Greeting in ${Date.now() - startTime}ms`)
    
    return {
      message: cleanedMessage,
      choices: data.choices // 이미 검증됨
    }
  } catch (e) {
    console.warn('[Gemini] Using fallback greeting:', e)
    // 폴백 처리도 동일하게
    let scenarioArray: [string, string, string, string]
    if (Array.isArray(scenario)) {
      scenarioArray = scenario
    } else {
      const emotionIndex = {
        'joy': 0,
        'anger': 1,
        'sadness': 2,
        'pleasure': 3
      }[scenario.selectedEmotion]
      scenarioArray = ['', '', '', ''] as [string, string, string, string]
      scenarioArray[emotionIndex] = scenario.content
    }
    return {
      message: getEasyGreeting(director, scenarioArray),
      choices: generateScenarioQuestions(director, scenarioArray, 'early')
    }
  }
}

export async function generateDirectorResponse(
  director: DirectorType,
  scenario: [string, string, string, string],
  user: string,
  prev: Array<{ role: string; content: string }>
) {
  const dir = directors[director]
  const messageCount = prev.length
  const stage: 'early' | 'mid' | 'late' = messageCount < 6 ? 'early' : messageCount < 12 ? 'mid' : 'late'
  
  // 더 많은 대화 맥락 포함
  const history = prev.slice(-6).map(m =>
    `${m.role === 'user' ? '나' : dir.nameKo}: ${m.content}`
  ).join('\n')

  try {
    const startTime = Date.now()
    const model = jsonModel('gemini-2.5-flash')
    
    // choices 검증 함수
    const validateResponse = (data: any) => {
      if (!data.message || typeof data.message !== 'string') {
        console.error('[Gemini] Invalid message:', data.message)
        return false
      }
      const validatedChoices = validateChoices(data.choices)
      if (!validatedChoices) {
        console.error('[Gemini] Choices validation failed')
        return false
      }
      data.choices = validatedChoices
      return true
    }
    
    const data = await askWithRetry(
      model,
      replyPrompt(director, scenarioArray, history, user),
      5,
      validateResponse
    )
    
    // 응답 형식 정리
    const cleanedMessage = cleanMovieTitle(tidy(data.message))
    
    console.log(`[Gemini] Response in ${Date.now() - startTime}ms`)
    
    return {
      message: cleanedMessage,
      choices: data.choices // 이미 검증됨
    }
  } catch (e) {
    console.warn('[Gemini] Using fallback response:', e)
    const currentTopic = detectTopic(user)
    // 폴백 처리도 동일하게
    let scenarioArray: [string, string, string, string]
    if (Array.isArray(scenario)) {
      scenarioArray = scenario
    } else {
      const emotionIndex = {
        'joy': 0,
        'anger': 1,
        'sadness': 2,
        'pleasure': 3
      }[scenario.selectedEmotion]
      scenarioArray = ['', '', '', ''] as [string, string, string, string]
      scenarioArray[emotionIndex] = scenario.content
    }
    return {
      message: getEasyFallback(director, user, scenarioArray),
      choices: generateScenarioQuestions(director, scenarioArray, stage, currentTopic),
      error: String(e)
    }
  }
}

/* ═══════════════ 개선된 폴백 응답들 ═══════════════ */

function getEasyGreeting(director: DirectorType, scenario: string[]): string {
  const analysis = analyzeScenario(scenario)
  const mainScene = analysis.keyMoments[0] || scenario[0] // 가장 긴 장면 또는 기쁜 장면
  
  const greetings: Record<DirectorType, string> = {
    bong: `안녕하세요! "${mainScene}" - 이 장면에 숨겨진 사회적 의미가 보이네요. 함께 그 층위를 찾아볼까요? 🎭`,
    curtis: `만나서 반가워요! "${mainScene}" - 정말 영화 같은 순간이네요. 모든 감정이 사랑의 한 형태예요. 💕`,
    miyazaki: `어서오세요! "${mainScene}" - 감정의 정령들이 춤추는 장면이네요. 함께 마법을 찾아볼까요? 🌸`,
    nolan: `흥미롭네요. "${mainScene}" - 시간과 감정이 교차하는 순간이군요. 기억의 미로를 함께 탐험해볼까요? 🌀`,
    chazelle: `안녕하세요! "${mainScene}" - 인생의 리듬이 바뀌는 순간이었네요. 함께 재즈를 연주해볼까요? 🎷`,
    docter: `반가워요! "${mainScene}" - 여러 감정이 함께 춤추는 순간이네요. 모든 감정의 의미를 함께 찾아볼까요? 🌈`
  }
  
  return greetings[director]
}

// chat/page.tsx에서 사용하는 getInitialGreeting 함수 export
export function getInitialGreeting(director: DirectorType, scene?: string) {
  return {
    message: getEasyGreeting(director, [scene || '', '', '', '']),
    choices: easyDirectorQuestions[director].early
  }
}

function getEasyFallback(director: DirectorType, userMsg: string, scenario: string[]): string {
  // 키워드와 시나리오 분석
  const topic = detectTopic(userMsg)
  const analysis = analyzeScenario(scenario)
  const tip = generatePracticalTip(director, topic, scenario)
  
  // 관련 시나리오 장면 찾기
  let relevantScene = ''
  let sceneDetail = ''
  
  if (topic === '기쁨' && scenario[0]) {
    relevantScene = scenario[0]
    sceneDetail = analysis.details.joy[0] || '그 순간'
  } else if (topic === '분노' && scenario[1]) {
    relevantScene = scenario[1]
    sceneDetail = analysis.details.anger[0] || '그 감정'
  } else if (topic === '슬픔' && scenario[2]) {
    relevantScene = scenario[2]
    sceneDetail = analysis.details.sadness[0] || '그 시간'
  } else if (topic === '즐거움' && scenario[3]) {
    relevantScene = scenario[3]
    sceneDetail = analysis.details.pleasure[0] || '그 기억'
  }
  
  const responses: Record<DirectorType, string> = {
    bong: `"${sceneDetail}" - 그 장면에서 새로운 계층 구조를 발견했네요. ${tip} 🎭`,
    curtis: `"${sceneDetail}" - 정말 따뜻한 순간이네요. ${tip} 💕`,
    miyazaki: `"${sceneDetail}" - 마법 같은 순간이었네요. ${tip} 🌸`,
    nolan: `"${sceneDetail}" - 시간의 의미를 다시 생각하게 하네요. ${tip} 🌀`,
    chazelle: `"${sceneDetail}" - 삶의 리듬이 느껴져요. ${tip} 🎷`,
    docter: `"${sceneDetail}" - 모든 감정이 다 의미가 있었네요. ${tip} 🌈`
  }
  
  return responses[director]
}

// chat/page.tsx에서 사용하는 getFarewellMessage 함수
export function getFarewellMessage(director: DirectorType) {
  const farewells: Record<DirectorType, string> = {
    bong: '우리의 대화도 하나의 영화였네요. 계단처럼 오르내리며 서로를 알아갔죠. 당신의 다음 장면이 기대됩니다. 🎭',
    nolan: '시공간을 넘어 연결된 우리. 이 대화는 끝나도 어딘가에 영원히 남아있을 거예요. ⏳',
    miyazaki: '바람이 불어오듯 자연스럽게 만나고 헤어지네요. 이 만남이 당신을 조금 더 강하게 만들었길. 🌀',
    curtis: '이 순간도 다시 돌아올 수 없는 특별한 시간이었어요. 사랑은 실제로 우리 주변 어디에나 있답니다. ❤️',
    chazelle: '엔딩이 아쉽지만 아름답네요. 당신의 꿈은 계속될 거예요. 다음 공연장에서 만나요! 🎹',
    docter: '이 만남도 당신의 스파크 중 하나가 되었길. 모든 순간이 당신의 코어 메모리가 되기를! 😊'
  }
  
  return farewells[director] || farewells.bong
}

// 폴백 응답 생성 함수
function generateFallbackResponse(director: DirectorType, msg: string, scenario?: string[]) {
  return getEasyFallback(director, msg, scenario || ['', '', '', ''])
}