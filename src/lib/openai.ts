// src/lib/openai.ts - 개선된 OpenAI GPT-5-mini 버전

import OpenAI from 'openai'
import type { DirectorType, Choice, EmotionType } from '@/types'
import { directors } from '@/constants/directors'

/* ═══════════════ 0. 공통 초기화 ═══════════════ */
const API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || ''

const openai = new OpenAI({
  apiKey: API_KEY,
  dangerouslyAllowBrowser: true // 브라우저에서 실행 허용
})

/* ═══════════════ 1. JSON 응답 스키마 정의 ═══════════════ */
interface DirectorResponse {
  message: string
  choices: Choice[]
  stage?: 'initial' | 'detail_1' | 'detail_2' | 'detail_3' | 'draft' | 'feedback' | 'final'
  scenario?: string
  casting?: string
}

/* ═══════════════ 2. 강력한 JSON 추출 및 검증 (gemini.ts 참고) ═══════════════ */

// JSON 추출 함수
function extractJSON(text: string): any {
  // 1. 직접 파싱 시도
  try {
    const trimmed = text.trim()
    const parsed = JSON.parse(trimmed)
    console.log('[OpenAI] Direct JSON parse success')
    return parsed
  } catch (e) {
    console.log('[OpenAI] Direct JSON parse failed, trying patterns...')
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
        console.log('[OpenAI] Pattern JSON parse success')
        return parsed
      } catch (e) {
        continue
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
    console.log('[OpenAI] Cleaned JSON parse success')
    return parsed
  } catch {
    console.error('[OpenAI] All JSON extraction attempts failed')
    return null
  }
}

// 개선된 choices 검증 함수 (더 엄격한 검증)
function validateChoices(choices: any): Choice[] | null {
  if (!Array.isArray(choices)) {
    console.error('[OpenAI] Choices is not an array:', typeof choices)
    return null
  }
  
  if (choices.length !== 3) {
    console.error('[OpenAI] Invalid choices count:', choices.length)
    return null
  }
  
  // 예시 텍스트 감지 (확장)
  const invalidTexts = [
    '질문 예시', '예시 질문', 'text: "질문', 'text": "질문',
    'undefined', 'null', 'NaN', 'question', 'example',
    '이런 경험이 있나요', '어떻게 느꼈나요', '무엇을 했나요',
    'your question', 'your response', 'placeholder',
    '...', '???', '!!!', 'TODO', 'FIXME'
  ]
  
  const validChoices = choices.map((choice, idx) => {
    if (!choice || typeof choice !== 'object') {
      console.error(`[OpenAI] Invalid choice object at index ${idx}:`, choice)
      return null
    }
    
    // ID 검증 및 수정
    const id = String(choice.id || idx + 1)
    if (!['1', '2', '3'].includes(id)) {
      console.error(`[OpenAI] Invalid choice ID at index ${idx}:`, id)
      return null
    }
    
    // 텍스트 검증
    let text = choice.text
    if (!text || typeof text !== 'string') {
      console.error(`[OpenAI] Invalid text type at index ${idx}:`, typeof text)
      return null
    }
    
    text = text.trim()
    if (text.length < 5) {
      console.error(`[OpenAI] Text too short at index ${idx}:`, text)
      return null
    }
    
    if (text.length > 100) {
      console.error(`[OpenAI] Text too long at index ${idx}:`, text.substring(0, 50))
      return null
    }
    
    // 예시 텍스트 검사 (case insensitive)
    const lowerText = text.toLowerCase()
    if (invalidTexts.some(invalid => lowerText.includes(invalid.toLowerCase()))) {
      console.error(`[OpenAI] Invalid/example text detected at index ${idx}:`, text)
      return null
    }
    
    // 한글 포함 여부 확인 (한국어 질문이어야 함)
    if (!/[가-힣]/.test(text)) {
      console.error(`[OpenAI] No Korean text at index ${idx}:`, text)
      return null
    }
    
    // 아이콘 처리 (선택적)
    const icon = choice.icon || ['🎬', '💭', '✨'][idx]
    
    return { id, text, icon }
  })
  
  // 모든 choice가 유효한지 확인
  if (validChoices.some(c => c === null)) {
    return null
  }
  
  // 중복 텍스트 확인
  const texts = validChoices.map(c => c!.text)
  const uniqueTexts = new Set(texts)
  if (uniqueTexts.size !== texts.length) {
    console.error('[OpenAI] Duplicate choices detected:', texts)
    return null
  }
  
  return validChoices as Choice[]
}

/* ═══════════════ 3. 개선된 재시도 로직 ═══════════════ */
async function askWithRetry(
  prompt: string,
  maxRetries = 5,
  validateFn?: (data: any) => boolean,
  conversationDepth = 0
): Promise<DirectorResponse> {
  let lastError: any = null
  let lastInvalidData: any = null
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`[OpenAI] Attempt ${i + 1} of ${maxRetries}`)
      
      // 재시도마다 프롬프트 강화
      let enhancedPrompt = prompt
      
      if (i === 1) {
        enhancedPrompt = `CRITICAL: Output ONLY JSON. No explanations or additional text.

Example of VALID response:
{"message":"감독의 구체적 답변 40-60자","choices":[{"id":"1","text":"재미있는 한국어 질문","icon":"🎬"},{"id":"2","text":"자연스러운 한국어 질문","icon":"💭"},{"id":"3","text":"깊이있는 한국어 질문","icon":"✨"}]}

${prompt}`
      } else if (i === 2) {
        enhancedPrompt = `STRICT JSON ONLY - NO OTHER TEXT!

${lastInvalidData ? `Your last response was invalid: ${JSON.stringify(lastInvalidData).substring(0, 100)}

` : ''}YOU MUST OUTPUT EXACTLY THIS FORMAT:
{"message":"[40-60자 한국어 답변]","choices":[{"id":"1","text":"[한국어 질문 1]","icon":"🎬"},{"id":"2","text":"[한국어 질문 2]","icon":"💭"},{"id":"3","text":"[한국어 질문 3]","icon":"✨"}]}

${prompt}`
      } else if (i >= 3) {
        // 더 단순한 프롬프트로 폴백
        enhancedPrompt = `Return ONLY this JSON structure with Korean text:
{"message":"감독 답변","choices":[{"id":"1","text":"질문1"},{"id":"2","text":"질문2"},{"id":"3","text":"질문3"}]}

Original request: ${prompt.substring(0, 500)}`
      }
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-5-mini-2025-08-07',
        messages: [
          {
            role: 'system',
            content: 'You are a film director. Always respond in valid JSON format with message and choices fields. Never add explanations or text outside JSON.'
          },
          {
            role: 'user',
            content: enhancedPrompt
          }
        ],
        temperature: 1.0,
        max_completion_tokens: 2048,
        reasoning_effort: 'minimal',
        response_format: { type: 'json_object' }
      })
      
      const content = completion.choices[0]?.message?.content
      if (!content) throw new Error('No content in response')
      
      const data = extractJSON(content)
      if (!data) {
        lastInvalidData = content.substring(0, 200)
        throw new Error('Failed to extract JSON from response')
      }
      
      if (!data.message || typeof data.message !== 'string') {
        lastInvalidData = data
        throw new Error('Invalid or missing message field')
      }
      
      if (!data.choices || !Array.isArray(data.choices)) {
        lastInvalidData = data
        throw new Error('Invalid or missing choices field')
      }
      
      const validatedChoices = validateChoices(data.choices)
      if (!validatedChoices) {
        lastInvalidData = data
        throw new Error('Choices validation failed')
      }
      
      // 메시지 길이 검증
      const messageLength = data.message.trim().length
      if (messageLength < 10 || messageLength > 150) {
        console.warn(`[OpenAI] Message length out of range: ${messageLength} chars`)
        // 길이가 벗어나도 일단 진행 (경고만)
      }
      
      if (validateFn && !validateFn(data)) {
        lastInvalidData = data
        throw new Error('Custom validation failed')
      }
      
      return {
        message: data.message.trim(),
        choices: validatedChoices
      }
    } catch (error) {
      console.error(`[OpenAI] Attempt ${i + 1} failed:`, error)
      lastError = error
      
      // API 에러인 경우 더 긴 대기
      if (error instanceof Error && error.message.includes('rate')) {
        console.log('[OpenAI] Rate limit detected, waiting longer...')
        await new Promise(resolve => setTimeout(resolve, 5000))
      } else if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
      }
    }
  }
  
  // 모든 시도 실패 시 상세한 에러
  const errorMessage = `Failed after ${maxRetries} attempts. Last error: ${lastError?.message || 'Unknown error'}`
  console.error('[OpenAI]', errorMessage)
  throw new Error(errorMessage)
}

/* ═══════════════ 4. 감독별 세부 설정 ═══════════════ */

// 감독별 디테일한 성격과 스타일 (MZ 맞춤 & 자신의 영화만 언급)
const directorPersonalities = {
  bong: {
    greeting: ['아, 반가워요', '오호, 흥미롭네', '음... 재미있는데?'],
    style: '날카로운 반말, 블랙유머, "아 그거 재밌는데?" "오호" "음..."',
    films: ['기생충 계단', '살인의 추억 논두렁', '괴물 한강다리', '설국열차', '옥자'],
    philosophy: '계층 구조, 선 넘기, 웃기면서도 무서운',
    topics: ['계급', '반지하', '짜파구리', '선 넘기', '비 오는 날'],
    advice: '사회의 계층을 꿰뚫어보며 블랙유머로 조언',
    mz: ['넷플릭스 정주행', '치맥', '편의점 조합', '부캐', '갓생'],
    analysis: '네 이야기 속에 숨겨진 계급과 선이 보여. 웃기면서도 씁쓸한, 딱 우리 사회 모습이야.'
  },
  nolan: {
    greeting: ['오! 흥미진진하네', '와, 대박이야', '이거 완전 미쳤어'],
    style: '열정적 반말, "와 대박!" "미쳤어" "진짜?" "오!"',
    films: ['인셉션 팽이', '인터스텔라 블랙홀', '테넷 역행'],
    philosophy: '시간 뒤틀림, 꿈과 현실, 복잡한 퍼즐',
    topics: ['시간', '꿈', '차원', '역행', '팽이'],
    advice: '시간과 차원을 넘나들며 복잡한 퍼즐처럼 조언',
    mz: ['멀티버스', '디깅', '타임루프', 'TMI', '현타'],
    analysis: '너의 시간은 직선이 아니야. 과거와 미래가 뒤엉킨 퍼즐 같은 사람이네.'
  },
  miyazaki: {
    greeting: ['따뜻한 순간이네요', '아이고, 좋구나', '참 아름답네'],
    style: '따뜻한 반말, "그래 그래" "아이고" "참 좋구나"',
    films: ['토토로 우산 씬', '센과 치히로 기차', '하울 움직이는 성'],
    philosophy: '자연의 정령, 순수한 마음, 성장 이야기',
    topics: ['숲', '바람', '구름', '정령', '자연'],
    advice: '자연과 순수함으로 따뜻하게 위로하며 조언',
    mz: ['힐링', '소확행', '킹받네', '내적댄스', '찐친'],
    analysis: '너에겐 아직 순수한 마음이 남아있어. 토토로가 우산을 씌워주듯, 너도 누군가를 지켜주는 사람이야.'
  },
  curtis: {
    greeting: ['와우! 완벽해요', '하하, 사랑스럽네요', '이런, 멋져요'],
    style: '유쾌한 존댓말, "와우!" "완벽해요!" "사랑스러워요"',
    films: ['러브 액츄얼리 공항', '노팅힐 책방', '어바웃 타임'],
    philosophy: '운명적 사랑, 크리스마스, 해피엔딩',
    topics: ['사랑', '운명', '크리스마스', '공항', '첫눈'],
    advice: '로맨틱하고 유쾌하게, 모든 걸 사랑으로 풀어내며 조언',
    mz: ['썸', '밀당', '플러팅', '설렘포인트', '연애세포'],
    analysis: '당신은 러브 액츄얼리의 공항 장면처럼, 사랑이 넘치는 사람이에요. 불완전해도 아름다워요!'
  },
  chazelle: {
    greeting: ['리듬이 느껴져!', '불타올라!', '미친듯이 좋아'],
    style: '열정적 반말, "리듬 느껴져!" "미친듯이" "불타올라"',
    films: ['라라랜드 LA 고속도로', '위플래쉬 드럼 솔로', '퍼스트맨 달'],
    philosophy: '꿈vs현실, 완벽주의, 재즈의 즉흥성',
    topics: ['재즈', '리듬', '템포', '꿈', '실패'],
    advice: '리듬과 열정으로, 실패도 예술로 만들며 조언',
    mz: ['번아웃', '워라밸', 'YOLO', '파이어족', '갓생러'],
    analysis: '네 안에 라라랜드의 세바스찬 같은 열정이 있어. 완벽하지 않아도 네 리듬대로 가!'
  },
  docter: {
    greeting: ['흥미로운 감정이네요', '마음이 느껴져요', '정말 특별해요'],
    style: '공감적 존댓말, "그렇군요" "마음이 느껴져요" "괜찮아요"',
    films: ['인사이드 아웃', '업', '소울', '몬스터 주식회사', '엘리멘탈'],
    philosophy: '모든 감정의 가치, 핵심기억, 삶의 의미',
    topics: ['감정', '기억', '스파크', '내면', '성장'],
    advice: '모든 감정을 포용하며 내면의 목소리를 찾도록 조언',
    mz: ['감정기복', '번아웃', '무기력', 'MBTI', '자아찾기'],
    analysis: '당신의 감정들이 인사이드 아웃처럼 회의 중이네요. 슬픔이도 필요해요, 그게 당신의 스파크예요.'
  }
}

// 감독별 구체적 질문 생성 (재미있는 질문 다양화)
function getDynamicFunQuestion(director: DirectorType, messageCount: number): string {
  const questions: Record<DirectorType, string[]> = {
    bong: [
      '짜파구리 어떻게 생각하세요?',
      '계단이 보이면 올라가세요, 내려가세요?',
      '반지하와 고층 아파트 중 어디가 더 무서워요?',
      '비 오는 날 어떤 생각 하세요?',
      '가장 좋아하는 라면은?',
      '선을 넘어본 적 있나요?',
      '당신의 계급은 뭐라고 생각해요?',
      '편의점 김밥 vs 삼각김밥?',
      '지하철 첫 칸 vs 마지막 칸?'
    ],
    nolan: [
      '팽이가 떨어지나요, 안 떨어지나요?',
      '시간을 거꾸로 살면 뭐부터 하실래요?',
      '꿈 속의 꿈에서 깨어난 적 있나요?',
      '시계를 거꾸로 돌려본 적 있나요?',
      '현실인지 꿈인지 헷갈린 적 있나요?',
      '평행우주의 당신은 뭐하고 있을까요?',
      '시간이 멈춘다면 뭘 하실래요?'
    ],
    miyazaki: [
      '토토로를 만나면 뭐라고 할까요?',
      '고양이 버스 타고 어디 가고 싶어요?',
      '숲의 정령을 본 적 있나요?',
      '바람이 말을 걸어온 적 있나요?',
      '구름 위를 걸어본 꿈 꾼 적 있나요?',
      '나만의 비밀 장소가 있나요?',
      '어린 시절로 돌아간다면?'
    ],
    curtis: [
      '크리스마스에 뭐하세요?',
      '공항에서 감동받은 적 있나요?',
      '러브레터 써본 적 있나요?',
      '첫눈에 반한 적 있나요?',
      '운명을 믿으세요?',
      '완벽한 타이밍이란 뭘까요?',
      '사랑의 징크스 있나요?'
    ],
    chazelle: [
      '인생의 템포는 몇 BPM인가요?',
      '즉흥연주 좋아하세요?',
      '실패도 리듬의 일부라고 생각해요?',
      '인생의 OST가 있다면?',
      '재즈 좋아하세요?',
      '완벽한 한 박자란?',
      '앙코르를 외치고 싶은 순간은?'
    ],
    docter: [
      '오늘의 주인공 감정은 누구인가요?',
      '슬픔이도 필요한 이유는?',
      '기쁨이만 있다면 어떨까요?',
      '감정들이 회의하면 뭐라고 할까요?',
      '당신의 스파크는 무엇인가요?',
      '핵심기억이 뭐예요?',
      '내면의 목소리 들리나요?'
    ]
  }
  
  const directorQuestions = questions[director]
  return directorQuestions[messageCount % directorQuestions.length]
}

// 대화 깊이 분석
function analyzeConversationDepth(messages: Array<{ role: string; content: string }>): number {
  const userMessages = messages.filter(m => m.role === 'user')
  const messageCount = userMessages.length
  
  if (messageCount <= 2) return 0  // 초반
  if (messageCount <= 4) return 1  // 중반
  if (messageCount <= 6) return 2  // 후반
  return 3  // 매우 깊음
}

// 대화 단계별 다양한 질문 풀 (사용자가 감독에게 묻는 질문)
const contextQuestionPool: Record<DirectorType, { early: string[], mid: string[], late: string[] }> = {
  bong: {
    early: [
      '일상에서 계급을 어떻게 표현하시나요?',
      '기생충처럼 선을 넘는 순간을 어떻게 찾으시나요?',
      '블랙코미디는 어떻게 만들어지나요?',
      '살인의 추억처럼 진실을 찾는 방법은?',
      '괴물처럼 일상에 숨은 두려움은 뭐예요?'
    ],
    mid: [
      '영화의 계단은 어떤 의미인가요?',
      '선을 넘는 순간을 어떻게 표현하시나요?',
      '비 오는 날이 자주 나오는 이유는?',
      '반지하와 고층의 대비는 어떻게 연출하시나요?',
      '사회적 가면을 벗기는 순간은 어떻게 그리시나요?'
    ],
    late: [
      '진짜 기생충은 누구라고 생각하세요?',
      '왜 계급 이동이 불가능한가요?',
      '반전은 어떻게 만들어지나요?',
      '가장 크게 선을 넘은 장면은?',
      '인생이 영화라면 어떤 장르일까요?'
    ]
  },
  nolan: {
    early: [
      '시간을 퍼즐처럼 만드는 비법이 뭐예요?',
      '인셉션의 팽이는 결국 떨어지나요?',
      '테넷처럼 시간을 거꾸로 가는 아이디어는 어떻게?',
      '인터스텔라의 블랙홀은 어떻게 표현하셨어요?',
      '평행우주 설정은 어떻게 만들어지나요?'
    ],
    mid: [
      '꿈 속의 꿈을 어떻게 구분하세요?',
      '시간의 층위를 어떻게 표현하시나요?',
      '기억의 퍼즐 조각은 어떻게 맞추시나요?',
      '현실과 꿈의 경계는 어떻게 흐리시나요?',
      '인셉션의 림보는 뭘 의미하나요?'
    ],
    late: [
      '시간의 본질은 뭐라고 생각하세요?',
      '인셉션 끝은 현실인가요, 꿈인가요?',
      '테넷의 역행이 전하는 메시지는?',
      '가장 깊은 꿈은 몇 층까지 가능할까요?',
      '시간을 설계할 수 있다면 어떻게 하실 건가요?'
    ]
  },
  miyazaki: {
    early: [
      '자연의 정령은 어떻게 그리시나요?',
      '토토로는 어떤 존재인가요?',
      '센과 치히로가 이름을 잊으면 왜 위험한가요?',
      '하울의 움직이는 성은 어떻게 만들어졌나요?',
      '바람이 전하는 메시지는 뭐예요?'
    ],
    mid: [
      '성장의 의미는 뭐라고 생각하세요?',
      '나를 찾아가는 여정은 어떻게 그리시나요?',
      '자연과 인간의 교감은 어떻게 표현하세요?',
      '토토로가 우산 씌워주는 장면의 의미는?',
      '순수함을 지키는 비법이 있나요?'
    ],
    late: [
      '마음의 숲은 어떤 모습일까요?',
      '어른이 되어도 동심을 지키려면?',
      '정령들과 대화하는 방법을 찾으셨나요?',
      '생명의 빛은 어떻게 표현하시나요?',
      '비밀 장소가 있으신가요?'
    ]
  },
  curtis: {
    early: [
      '일상을 특별하게 만드는 방법이 있나요?',
      '러브 액츄얼리 공항 장면은 어떻게 만들어졌나요?',
      '노팅힐 책방처럼 운명을 믿으세요?',
      '어바웃 타임처럼 시간을 되돌릴 수 있다면?',
      '완벽하지 않은 사랑이 더 아름다운 이유는?'
    ],
    mid: [
      '운명적인 순간은 언제였나요?',
      '왜 크리스마스가 자주 나오나요?',
      '사랑을 표현하는 특별한 방식이 있나요?',
      '일상을 로맨틱하게 만드는 비법은?',
      '어바웃 타임의 타임루프는 어떻게 만들어졌어요?'
    ],
    late: [
      '진짜 사랑의 의미는 뭘까요?',
      '해피엔딩 만드는 비법이 있나요?',
      '왜 모든 영화가 사랑으로 끝나나요?',
      '러브 액츄얼리가 전하는 메시지는?',
      '시간을 되돌린다면 어떤 장면을 바꾸고 싶어요?'
    ]
  },
  chazelle: {
    early: [
      '열정과 현실을 어떻게 균형 맞추세요?',
      '라라랜드 LA 고속도로 장면은 어떻게 만들어졌어요?',
      '위플래쉬 드럼 솔로는 어떻게 촬영하셨어요?',
      '퍼스트맨에서 달을 표현한 방식은?',
      '재즈의 즉흥성이란 뭐라고 생각하세요?'
    ],
    mid: [
      '완벽보다 중요한 게 뭐예요?',
      '실패도 예술이 될 수 있나요?',
      '인생의 템포는 어떻게 표현하시나요?',
      '꿈과 현실의 균형점은 어디인가요?',
      '라라랜드 끝이 슬픈 이유는?'
    ],
    late: [
      '인생의 멜로디는 뭐라고 생각하세요?',
      '앙코르를 외치고 싶은 순간은?',
      '인생이라는 공연에서 가장 중요한 건?',
      '리듬을 잃고 다시 찾는 과정은 어떻게 표현해요?',
      '꿈의 라라랜드는 어떤 모습인가요?'
    ]
  },
  docter: {
    early: [
      '감정들을 어떻게 캐릭터로 만드시나요?',
      '인사이드 아웃에서 슬픔이가 필요한 이유는?',
      '업의 첫 10분은 어떻게 만들어졌나요?',
      '소울의 스파크는 뭘 의미하나요?',
      '핵심기억의 역할은 뭐예요?'
    ],
    mid: [
      '기억이 사라지는 장면의 의미는?',
      '빙봉처럼 잊혀지는 감정이 왜 필요해요?',
      '복합 감정을 색깔로 표현한 이유는?',
      '내면의 소리는 어떻게 영화로 만드세요?',
      '감정들의 회의 장면은 어떻게 만들어졌어요?'
    ],
    late: [
      '진짜 스파크는 뭐라고 생각하세요?',
      '모든 감정이 필요한 이유는?',
      '인사이드 아웃이 전하는 메시지는?',
      '가장 소중한 핵심기억은 어떻게 찾나요?',
      '왜 내면을 탐구하는 영화를 만드시나요?'
    ]
  }
}

// 시나리오 기반 질문 생성 (사용자 입력 내용에 맞춤)
export const generateScenarioQuestions = (
  director: DirectorType, 
  scenario: string[],
  stage: 'early' | 'mid' | 'late',
  messageCount: number = 0
): Choice[] => {
  // 입력된 시나리오 찾기
  const inputScenario = scenario.find(s => s && s.trim() !== '') || ''
  
  // 시나리오 내용 분석
  const scenarioKeywords = {
    achievement: inputScenario.includes('상') || inputScenario.includes('메달') || inputScenario.includes('합격'),
    loss: inputScenario.includes('이별') || inputScenario.includes('끝') || inputScenario.includes('떠나'),
    friendship: inputScenario.includes('친구') || inputScenario.includes('동료') || inputScenario.includes('우정'),
    challenge: inputScenario.includes('도전') || inputScenario.includes('시작') || inputScenario.includes('처음'),
    love: inputScenario.includes('사랑') || inputScenario.includes('연인') || inputScenario.includes('좋아')
  }
  
  // 감독별 + 시나리오별 맞춤 질문
  const customQuestions = {
    bong: {
      achievement: ['이 성공이 당신의 계급을 바꿨나요?', '위로 올라가면서 놓친 것은?', '진짜 원했던 게 이거였나요?'],
      loss: ['이별도 계급의 문제였나요?', '떠나간 사람이 남긴 것은?', '진짜 끝이라고 생각하세요?'],
      friendship: ['친구와 선을 넘은 적 있나요?', '진짜 가족 같은 친구가 있나요?', '우정에도 계급이 있다고 보세요?'],
      default: ['이 순간에 누가 함께했나요?', '그때의 나는 어떤 사람이었나요?', '지금 돌아보면 어떤 의미인가요?']
    },
    nolan: {
      achievement: ['이 순간이 현실인지 확신하세요?', '시간을 되돌린다면 똑같이 할까요?', '꿈에서 깨어나면 어떨까요?'],
      loss: ['시간이 해결해줄 수 있을까요?', '평행우주에서는 다른 결말일까요?', '기억을 지울 수 있다면?'],
      friendship: ['우정도 시간을 초월할까요?', '과거의 친구를 만난다면?', '함께한 시간은 어디로 가나요?'],
      default: ['이 기억은 진짜일까요?', '시간의 퍼즐 조각인가요?', '현재가 과거를 바꾸나요?']
    },
    miyazaki: {
      achievement: ['성장의 대가는 무엇이었나요?', '어른이 된 것 같나요?', '순수함은 아직 남아있나요?'],
      loss: ['자연이 위로해주나요?', '떠나간 사람은 정령이 됐나요?', '다시 만날 수 있을까요?'],
      friendship: ['토토로 같은 친구가 있나요?', '함께 모험을 떠났나요?', '마법 같은 우정인가요?'],
      default: ['이 순간에 마법이 있었나요?', '자연이 무엇을 말하나요?', '어린 시절로 돌아가고 싶나요?']
    },
    curtis: {
      achievement: ['사랑이 함께했나요?', '운명이라고 믿나요?', '크리스마스 같은 순간이었나요?'],
      loss: ['사랑이 끝나도 사랑인가요?', '또 다른 사랑이 올까요?', '해피엔딩을 믿나요?'],
      love: ['첫눈에 반했나요?', '운명적인 만남이었나요?', '완벽한 타이밍이었나요?'],
      default: ['이 순간이 로맨틱했나요?', '사랑이 무엇인지 알게 됐나요?', '다시 그때로 돌아가고 싶나요?']
    },
    chazelle: {
      achievement: ['꿈을 이룬나요?', '대가는 무엇이었나요?', '완벽을 향한 열정인가요?'],
      loss: ['꿈과 사랑 중 무엇을 선택했나요?', '후회는 없나요?', '다른 엔딩을 상상하나요?'],
      challenge: ['첫 박자가 떨렸나요?', '실패를 두려워했나요?', '리듬을 찾았나요?'],
      default: ['인생의 템포는 어땠나요?', '음악이 함께했나요?', '앙코르를 외치고 싶나요?']
    },
    docter: {
      achievement: ['어떤 감정이 주인공이었나요?', '코어 메모리가 만들어졌나요?', '모든 감정이 축하했나요?'],
      loss: ['슬픔이도 필요했나요?', '빙봉처럼 사라지나요?', '기억은 남아있나요?'],
      friendship: ['감정들이 회의하면 뭐라고 할까요?', '함께 성장했나요?', '우정의 색깔은 무엇인가요?'],
      default: ['지금 무슨 감정인가요?', '스파크를 찾았나요?', '내면의 목소리가 들리나요?']
    }
  }
  
  // 시나리오에 맞는 질문 선택
  let selectedType = 'default'
  if (scenarioKeywords.achievement) selectedType = 'achievement'
  else if (scenarioKeywords.loss) selectedType = 'loss'
  else if (scenarioKeywords.friendship) selectedType = 'friendship'
  else if (scenarioKeywords.love && director === 'curtis') selectedType = 'love'
  else if (scenarioKeywords.challenge && director === 'chazelle') selectedType = 'challenge'
  
  const directorQuestions = customQuestions[director] as any
  const relevantQuestions = directorQuestions[selectedType] || directorQuestions.default
  
  // 재미있는 질문
  const funQuestion = getDynamicFunQuestion(director, messageCount)
  
  // 단계별 질문 선택
  const contextQuestion = contextQuestionPool[director][stage]
  const shuffled = [...contextQuestion].sort(() => Math.random() - 0.5)
  
  // 아이콘 배열
  const icons = {
    bong: ['🍜', '🔍', '🎭'],
    nolan: ['🌭', '🧩', '⏳'],
    miyazaki: ['🌳', '🌸', '🍃'],
    curtis: ['💕', '✨', '🎁'],
    chazelle: ['🎵', '⚖️', '👣'],
    docter: ['🌈', '💬', '🎭']
  }[director] || ['🎬', '💭', '✨']
  
  // 초반에는 시나리오 기반 질문, 후반에는 일반 질문 혼합
  if (stage === 'early') {
    return [
      { id: '1', text: funQuestion, icon: icons[0] },
      { id: '2', text: relevantQuestions[messageCount % relevantQuestions.length], icon: icons[1] },
      { id: '3', text: shuffled[0], icon: icons[2] }
    ]
  } else {
    return [
      { id: '1', text: funQuestion, icon: icons[0] },
      { id: '2', text: shuffled[messageCount % shuffled.length], icon: icons[1] },
      { id: '3', text: relevantQuestions[(messageCount + 1) % relevantQuestions.length], icon: icons[2] }
    ]
  }
}

/* ═══════════════ 5. 개선된 프롬프트 생성 함수들 ═══════════════ */

const initialPrompt = (
  director: DirectorType,
  scenario: string[]
) => {
  const dir = directors[director]
  const personality = directorPersonalities[director]
  const greeting = personality.greeting[Math.floor(Math.random() * personality.greeting.length)]
  
  // 입력된 시나리오 찾기 (네컷 중 하나만 입력됨)
  const inputScenario = scenario.find(s => s && s.trim() !== '') || ''
  const emotionType = scenario[0] ? '기쁨' : scenario[1] ? '분노' : scenario[2] ? '슬픔' : scenario[3] ? '즐거움' : ''
  
  // 시나리오 내용 분석
  const hasAchievement = inputScenario.includes('상') || inputScenario.includes('메달') || inputScenario.includes('합격') || inputScenario.includes('1등')
  const hasLoss = inputScenario.includes('이별') || inputScenario.includes('끝') || inputScenario.includes('떠나') || inputScenario.includes('헤어')
  const hasFriendship = inputScenario.includes('친구') || inputScenario.includes('동료') || inputScenario.includes('우정')
  const hasChallenge = inputScenario.includes('도전') || inputScenario.includes('시작') || inputScenario.includes('처음')
  
  // 실제 질문 예시로 JSON 생성
  const actualQuestions = generateScenarioQuestions(director, scenario, 'early', 0)
  
  // 감독별 맞춤 반응 생성
  const directorResponses = {
    bong: {
      achievement: `"${inputScenario}" - 이 순간이 네 인생의 계단을 올라간 순간이구나. 근데 기생충에서 보여줬듯이, 위로 올라가는 것만이 답은 아니야. 진짜 중요한 건 네가 어떤 '선'을 넘었느냐야.`,
      loss: `"${inputScenario}" - 살인의 추억처럼 끝나지 않는 이야기가 있지. 이별도 완전히 끝나는 게 아니라 계속 우리 안에 남아있어. 그게 인생의 블랙코미디야.`,
      friendship: `"${inputScenario}" - 기생충 가족처럼, 진짜 가족은 피로 맺어진 게 아니야. 함께 선을 넘고 계급을 뛰어넘는 동료들이 진짜지.`,
      challenge: `"${inputScenario}" - 괴물의 강두처럼 무모해 보여도 뛰어드는 거야. 실패해도 그게 네 이야기가 되는 거니까.`,
      default: `"${inputScenario}" - 이 ${emotionType} 순간이 네 인생 영화의 한 장면이구나. 기생충 계단처럼, 모든 순간엔 위아래가 있어. 너는 지금 어디에 서 있는 거야?`
    },
    nolan: {
      achievement: `"${inputScenario}" - 인셉션의 팽이처럼, 이게 꿈인지 현실인지 모르겠지? 성공이란 게 때론 환상일 수 있어. 중요한 건 네가 이 순간을 어떻게 기억할 것인가야.`,
      loss: `"${inputScenario}" - 인터스텔라의 쿠퍼처럼, 떠나는 건 끝이 아니야. 시간은 상대적이고, 기억은 평행우주처럼 계속 존재해.`,
      friendship: `"${inputScenario}" - 테넷의 주인공처럼, 우정도 시간을 거슬러 올라가며 더 깊어져. 과거와 미래가 만나는 지점에 진짜 관계가 있어.`,
      challenge: `"${inputScenario}" - 덩케르크처럼 시간이 다르게 흐르는 순간이야. 한 시간이 하루처럼, 하루가 한 달처럼 느껴지지. 그게 도전의 본질이야.`,
      default: `"${inputScenario}" - 이 ${emotionType}의 순간이 네 시간축의 특이점이구나. 메멘토처럼 거꾸로 돌아봐도 의미가 있는 순간이야.`
    },
    miyazaki: {
      achievement: `"${inputScenario}" - 센과 치히로가 이름을 되찾은 것처럼, 네가 진짜 너를 찾은 순간이네. 성장은 이렇게 한 걸음씩 이뤄지는 거야.`,
      loss: `"${inputScenario}" - 토토로가 떠나도 우산은 남아있듯이, 이별은 끝이 아니라 새로운 시작이야. 바람이 불면 또 만날 수 있어.`,
      friendship: `"${inputScenario}" - 하울과 소피처럼, 진짜 친구는 서로를 변화시켜. 마법처럼 서로를 더 나은 사람으로 만들어주지.`,
      challenge: `"${inputScenario}" - 모노노케 히메의 아시타카처럼, 두려워도 나아가는 거야. 자연의 정령들이 네 편이 될 거야.`,
      default: `"${inputScenario}" - 이 ${emotionType}의 순간에도 토토로의 숲처럼 마법이 숨어있어. 순수한 마음으로 보면 보이는 것들이 있지.`
    },
    curtis: {
      achievement: `"${inputScenario}" - 러브 액츄얼리의 공항 장면처럼 기쁨이 넘치는 순간이네! 완벽하지 않아도 충분히 아름다운 성공이야.`,
      loss: `"${inputScenario}" - 어바웃 타임처럼, 이별도 삶의 일부야. 시간을 되돌려도 바꾸지 않을 소중한 기억이 될 거야.`,
      friendship: `"${inputScenario}" - 노팅힐의 친구들처럼, 진짜 친구는 네가 평범한 사람일 때도 곁에 있어. 그게 진짜 사랑이야.`,
      challenge: `"${inputScenario}" - 브리짓 존스처럼 완벽하지 않아도 돼. 실수투성이여도 사랑받을 자격이 있어.`,
      default: `"${inputScenario}" - 이 ${emotionType}의 순간이 네 인생의 러브 액츄얼리구나. 사랑은 실제로 어디에나 있어, 이 순간에도.`
    },
    chazelle: {
      achievement: `"${inputScenario}" - 위플래쉬의 마지막 드럼 솔로처럼, 네가 증명한 순간이야. 완벽은 아니어도 네 리듬을 찾았구나.`,
      loss: `"${inputScenario}" - 라라랜드의 엔딩처럼, 아름답지만 아픈 이별이네. 그래도 함께한 춤은 영원히 남아.`,
      friendship: `"${inputScenario}" - 재즈 밴드처럼, 각자의 즉흥연주가 하나의 하모니를 만들어. 그게 진짜 우정이야.`,
      challenge: `"${inputScenario}" - 퍼스트맨의 암스트롱처럼, 첫 발걸음은 언제나 무섭지. 하지만 그게 역사가 되는 거야.`,
      default: `"${inputScenario}" - 이 ${emotionType}의 순간이 네 인생의 재즈구나. 즉흥적이지만 아름다운 멜로디가 들려.`
    },
    docter: {
      achievement: `"${inputScenario}" - 인사이드 아웃의 코어 메모리가 만들어진 순간이네! 기쁨이만 있는 게 아니라 모든 감정이 섞여서 더 특별해.`,
      loss: `"${inputScenario}" - 업의 엘리처럼, 떠나간 사람도 모험북의 한 페이지야. 빙봉처럼 사라져도 널 달나라로 데려다준 거야.`,
      friendship: `"${inputScenario}" - 몬스터 주식회사의 설리반과 마이크처럼, 진짜 친구는 서로를 웃게 만들어. 그게 최고의 에너지야.`,
      challenge: `"${inputScenario}" - 소울의 22번처럼, 스파크를 찾는 여정이 시작됐네. 삶의 의미는 거창한 게 아니라 이런 작은 순간들이야.`,
      default: `"${inputScenario}" - 이 ${emotionType}의 순간에 네 머릿속 감정들이 회의 중이겠네. 슬픔이도 필요해, 모든 감정이 모여야 진짜 너야.`
    }
  }[director]
  
  // 시나리오 타입에 따른 응답 선택
  let chosenResponse = directorResponses.default
  if (hasAchievement) chosenResponse = directorResponses.achievement
  else if (hasLoss) chosenResponse = directorResponses.loss
  else if (hasFriendship) chosenResponse = directorResponses.friendship
  else if (hasChallenge) chosenResponse = directorResponses.challenge
  
  const jsonExample = JSON.stringify({
    message: chosenResponse.substring(0, 120),
    choices: actualQuestions
  }, null, 2)
  
  return `JSON만 출력. 다른 텍스트 금지.

중요: 사용자의 인생 네컷 내용을 깊이 분석하고 공감하세요.

올바른 응답 형식:
${jsonExample}

당신: ${dir.nameKo} 감독
내 영화들: ${personality.films.join(', ')}

사용자의 ${emotionType} 이야기:
"${inputScenario}"

응답 규칙:
1. 80-120자로 구체적이고 깊이있게
2. 사용자 이야기를 직접 인용하며 공감
3. 내 영화의 구체적 장면과 연결
4. MZ 용어 자연스럽게 활용
5. 인생 조언과 통찰 제공
6. 다른 감독 작품 절대 언급 금지

choices는 사용자가 나에게 묻는 질문들:
${JSON.stringify(actualQuestions, null, 2)}

JSON 형식으로만:`
}

const replyPrompt = (
  director: DirectorType,
  scenario: string[],
  history: string,
  user: string,
  usedExpressions: string[] = []
) => {
  const dir = directors[director]
  const personality = directorPersonalities[director]
  const messageCount = history.split('\n').length
  const stage = messageCount < 4 ? 'early' : messageCount < 8 ? 'mid' : 'late'
  const depth = analyzeConversationDepth(
    history.split('\n').map(line => {
      const [role, ...content] = line.split(': ')
      return { role: role === '나' ? 'user' : 'assistant', content: content.join(': ') }
    })
  )
  
  // 입력된 시나리오 찾기 (네컷 중 하나만)
  const inputScenario = scenario.find(s => s && s.trim() !== '') || ''
  const originalEmotion = scenario[0] ? '기쁨' : scenario[1] ? '분노' : scenario[2] ? '슬픔' : scenario[3] ? '즐거움' : ''
  
  // 현재 대화와 관련된 감정 찾기
  let relevantScene = inputScenario
  let scenarioType = originalEmotion
  
  // 사용자가 다른 감정 언급 시에도 원래 시나리오 기억
  if (user.includes('기쁨') || user.includes('행복')) {
    scenarioType = '기쁨'
  } else if (user.includes('화') || user.includes('분노')) {
    scenarioType = '분노'
  } else if (user.includes('슬픔') || user.includes('눈물')) {
    scenarioType = '슬픔'
  } else if (user.includes('즐거') || user.includes('재미')) {
    scenarioType = '즐거움'
  }
  
  // 실제 질문으로 JSON 예시 생성 (첫 대화 이후엔 매번 다른 질문)
  const actualQuestions = generateScenarioQuestions(director, scenario, stage, messageCount)
  const isFirstReply = messageCount <= 2
  
  // 첫 답변 이후엔 재미있는 질문도 변경
  if (!isFirstReply) {
    actualQuestions[0] = {
      id: '1',
      text: getDynamicFunQuestion(director, messageCount),
      icon: actualQuestions[0].icon
    }
  }
  
  const jsonExample = JSON.stringify({
    message: "감독의 답변",
    choices: actualQuestions
  }, null, 2)
  
  // 사용자 메시지 분석하여 맞춤 응답 생성
  const analyzeUserMessage = (message: string) => {
    // 감정 키워드 감지
    const emotions = {
      joy: ['기쁨', '행복', '즐거', '신나', '좋아', '최고', '성공'],
      sadness: ['슬픔', '눈물', '아프', '그리워', '외로', '쓸쓸', '이별'],
      anger: ['화', '분노', '짜증', '억울', '불공평', '싫어'],
      fear: ['무서', '두려', '불안', '걱정', '떨려', '긴장']
    }
    
    let detectedEmotion = ''
    for (const [emotion, keywords] of Object.entries(emotions)) {
      if (keywords.some(keyword => message.includes(keyword))) {
        detectedEmotion = emotion
        break
      }
    }
    
    // 상황 키워드 감지
    const hasQuestion = message.includes('?') || message.includes('까요')
    const hasMemory = message.includes('그때') || message.includes('예전') || message.includes('기억')
    const hasAdviceRequest = message.includes('어떻게') || message.includes('조언') || message.includes('도움')
    
    return { detectedEmotion, hasQuestion, hasMemory, hasAdviceRequest }
  }
  
  const userAnalysis = analyzeUserMessage(user)
  
  // 감독별 대화 스타일 (사용자 메시지와 시나리오 기반)
  const responseStyle = {
    bong: [
      userAnalysis.hasMemory ? 
        `"${user}" - 그 순간도 계급의 계단 위에 있었구나. ${inputScenario}처럼 선을 넘는 순간이었어.` :
        `네 말대로야. ${inputScenario}에서 시작된 이야기가 여기까지 왔네.`,
      '기생충 계단처럼 위아래를 오가며 살아가는 우리',
      '선을 넘는 순간이 진짜 변화의 시작',
      '모든 이야기는 결국 계급과 생존의 문제'
    ],
    nolan: [
      userAnalysis.hasQuestion ?
        `"${user}" - 좋은 질문이야. ${inputScenario}도 시간의 퍼즐 조각이었지.` :
        `맞아, ${inputScenario}이 네 시간축의 원점이구나.`,
      '인셉션 팽이처럼 계속 도는 현실과 꿈',
      '모든 기억은 재구성되고 왜곡돼',
      '과거와 미래가 현재에서 만나는 지점'
    ],
    miyazaki: [
      userAnalysis.detectedEmotion === 'sadness' ?
        `"${user}" - 그래도 괜찮아. ${inputScenario}처럼 모든 건 자연의 일부야.` :
        `"${user}" - 아름다운 이야기네. ${inputScenario}에서 시작된 성장이구나.`,
      '토토로 숲처럼 신비로운 일상의 마법',
      '센과 치히로처럼 이름을 찾아가는 여정',
      '모든 생명이 빛나는 순간의 가치'
    ],
    curtis: [
      userAnalysis.hasAdviceRequest ?
        `"${user}" - 내 조언은 단순해. ${inputScenario}처럼 사랑은 어디에나 있어.` :
        `"${user}" - 완벽해! ${inputScenario}이 네 러브 액츄얼리의 시작이었네.`,
      '공항 재회처럼 감동적인 순간들',
      '타이밍이 만드는 운명적 만남',
      '불완전해도 아름다운 사랑의 모습'
    ],
    chazelle: [
      userAnalysis.detectedEmotion === 'joy' ?
        `"${user}" - 네 리듬이 들려! ${inputScenario}이 네 인생의 재즈구나.` :
        `"${user}" - 그래, ${inputScenario}도 하나의 음표였어.`,
      '위플래쉬 드럼처럼 강렬한 열정',
      '실패도 재즈의 즉흥연주처럼',
      '라라랜드처럼 꿈과 현실 사이'
    ],
    docter: [
      userAnalysis.detectedEmotion ?
        `"${user}" - 그 감정도 필요해. ${inputScenario}처럼 모든 감정이 모여 너를 만들어.` :
        `"${user}" - 맞아. ${inputScenario}이 네 코어 메모리가 됐구나.`,
      '복합 감정: 인사이드 아웃 핵심기억처럼',
      '내면 탐구: 모든 감정이 필요한 이유',
      '스파크 발견: 당신만의 빛을 찾아'
    ]
  }[director][depth]
  
  return `JSON만 출력. 추상적 답변 금지.

올바른 형식:
${jsonExample}

당신: ${dir.nameKo} 감독
내 영화들: ${personality.films.join(', ')}

대화 기록:
${history}

사용자가 방금 한 질문/말: "${user}"

중요 답변 규칙:
1. 사용자의 질문에 직접 답변하기 (40-60자)
2. 내 영화 경험과 연결해서 답변: ${personality.films[depth % personality.films.length]}
3. MZ 용어 자연스럽게: ${personality.mz[depth % personality.mz.length]}
4. 다른 감독 작품 언급 절대 금지
5. 사용자가 묻는 것에 집중 (처음 시나리오는 필요할 때만 언급)
6. ${stage === 'early' ? '친근하게' : stage === 'mid' ? '조언 섞어서' : '깊이있게'}

choices (사용자가 나에게 물을 수 있는 질문들):
${actualQuestions.map((q, i) => `- choices[${i}]: ${q.text}`).join('\n')}

JSON:`
}

/* ═══════════════ 6. 메인 API 함수들 ═══════════════ */

// 초기 인사 생성
export async function generateInitialGreeting(
  director: DirectorType,
  scenario: { selectedEmotion: EmotionType; content: string } | [string, string, string, string]
): Promise<{ message: string; choices: Choice[] }> {
  // 시나리오 형태 변환
  let scenarioArray: [string, string, string, string]
  if (Array.isArray(scenario)) {
    scenarioArray = scenario
  } else {
    const emotionIndexMap: Record<EmotionType, number> = {
      'joy': 0,
      'anger': 1,
      'sadness': 2,
      'pleasure': 3
    }
    const emotionIndex = emotionIndexMap[scenario.selectedEmotion]
    scenarioArray = ['', '', '', ''] as [string, string, string, string]
    scenarioArray[emotionIndex] = scenario.content
  }
  
  try {
    const prompt = initialPrompt(director, scenarioArray)
    const data = await askWithRetry(prompt, 5, (d) => {
      return validateChoices(d.choices) !== null
    })
    
    console.log('[OpenAI] Initial greeting generated successfully')
    return {
      message: data.message,
      choices: data.choices
    }
  } catch (error) {
    console.error('[OpenAI] Failed to generate initial greeting:', error)
    const personality = directorPersonalities[director]
    const greeting = personality.greeting[0]
    return {
      message: `${greeting}! ${directors[director].nameKo} 감독입니다. 당신의 이야기를 들려주세요.`,
      choices: generateScenarioQuestions(director, scenarioArray, 'early', 0)
    }
  }
}

// 감독 응답 생성
export async function generateDirectorResponse(
  director: DirectorType,
  scenario: [string, string, string, string],
  user: string,
  prev: Array<{ role: string; content: string }>
): Promise<{ message: string; choices?: Choice[]; error?: string }> {
  try {
    const conversationDepth = analyzeConversationDepth(prev)
    const messageCount = prev.filter(m => m.role === 'user').length
    const stage: 'early' | 'mid' | 'late' = 
      prev.length < 6 ? 'early' : prev.length < 12 ? 'mid' : 'late'
    
    // 반복 방지를 위한 이전 표현 추출
    const usedExpressions = prev
      .filter(m => m.role === 'assistant')
      .map(m => m.content.slice(0, 20))
      .slice(-3)
    
    // 대화 히스토리 생성
    const history = prev.slice(-6).map(m =>
      `${m.role === 'user' ? '나' : directors[director].nameKo}: ${m.content}`
    ).join('\n')
    
    const prompt = replyPrompt(director, scenario, history, user, usedExpressions)
    
    const data = await askWithRetry(prompt, 5, (d) => {
      return validateChoices(d.choices) !== null
    }, conversationDepth)
    
    console.log('[OpenAI] Director response generated successfully')
    return {
      message: data.message,
      choices: data.choices
    }
  } catch (error) {
    console.error('[OpenAI] Failed to generate director response:', error)
    const messageCount = prev.filter(m => m.role === 'user').length
    const personality = directorPersonalities[director]
    return {
      message: `${personality.greeting[0]}. 더 들려주세요.`,
      choices: generateScenarioQuestions(director, scenario, 'early', messageCount),
      error: String(error)
    }
  }
}

// API 테스트 함수
export async function testOpenAIAPI() {
  try {
    if (!API_KEY) throw new Error('No API key')
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini-2025-08-07',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant. Respond with JSON.'
        },
        {
          role: 'user',
          content: 'Say "OK" in JSON format with a message field.'
        }
      ],
      max_completion_tokens: 100,
      reasoning_effort: 'minimal',
      response_format: { type: 'json_object' }
    })
    
    return { 
      success: true, 
      message: completion.choices[0]?.message?.content || 'OK' 
    }
  } catch (e) {
    return { success: false, message: String(e) }
  }
}

// getInitialGreeting export (chat/page.tsx에서 사용)
export function getInitialGreeting(director: DirectorType) {
  const personality = directorPersonalities[director]
  return {
    message: `${personality.greeting[0]}! ${directors[director].nameKo} 감독입니다. 당신의 이야기가 궁금하네요.`,
    choices: generateScenarioQuestions(director, [], 'early', 0)
  }
}

// 작별 인사 메시지
export function getFarewellMessage(director: DirectorType) {
  const farewells: Record<DirectorType, string> = {
    bong: `우리의 대화도 하나의 영화였네요. 계단처럼 오르내리며 서로를 알아갔죠.\n\n당신 이야기 들으면서 제 다음 작품에 딱 맞는 캐릭터가 떠올랐어요. 🎭`,
    nolan: `시공간을 넘어 연결된 우리. 이 대화는 끝나도 어딘가에 영원히 남아있을 거예요.\n\n너 정말 흥미로운 사람이야. 내 다음 작품에 이런 캐릭터가 있는데... ⏳`,
    miyazaki: `바람이 불어오듯 자연스럽게 만나고 헤어지네요. 이 만남이 당신을 조금 더 강하게 만들었길.\n\n당신과 이야기하니 제 애니메이션에 나올 법한 캐릭터가 보여요. 🌀`,
    curtis: `이 순간도 다시 돌아올 수 없는 특별한 시간이었어요. 사랑은 실제로 우리 주변 어디에나 있답니다.\n\n너 진짜 로맨틱 코미디 주인공 같아! ❤️`,
    chazelle: `엔딩이 아쉽지만 아름답네요. 당신의 꿈은 계속될 거예요.\n\n네 안에 특별한 리듬이 있어. 내 다음 작품에 딱 맞는 캐릭터가 있는데... 🎹`,
    docter: `이 만남도 당신의 스파크 중 하나가 되었길. 모든 순간이 당신의 코어 메모리가 되기를!\n\n당신 내면의 이야기가 정말 흥미로워요. 😊`
  }
  
  return farewells[director]
}