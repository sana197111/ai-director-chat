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
    'text: "질문', 'text": "질문',
    '이런 경험이 있나요', '어떻게 느꼈나요',  // 감독이 배우에게 묻는 질문 방지
    'undefined', 'null', 'NaN',  // 잘못된 값 방지
    'question 1', 'question 2', 'question 3'  // 영어 예시 방지
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
        enhancedPrompt = `중요: 반드시 JSON만 출력하세요. 설명 금지.
Example JSON:
{"message":"감독 답변","choices":[{"id":"1","text":"질문","icon":"🎭"},{"id":"2","text":"질문","icon":"🎬"},{"id":"3","text":"질문","icon":"🎵"}]}

${prompt}`
      } else if (i === 2) {
        enhancedPrompt = `OUTPUT ONLY THIS JSON FORMAT:
{"message":"your response here","choices":[{"id":"1","text":"question 1","icon":"🎭"},{"id":"2","text":"question 2","icon":"🎬"},{"id":"3","text":"question 3","icon":"🎵"}]}

${prompt}`
      } else if (i >= 3) {
        // Temperature 조정을 위한 모델 재생성 - 더 보수적으로
        const adjustedModel = genAI.getGenerativeModel({
          model: model.model,
          safetySettings,
          generationConfig: {
            temperature: Math.max(0.1, 0.5 - (i * 0.1)), // 더 낮은 온도로 시작
            topK: Math.max(10, 30 - (i * 5)), // topK도 줄임
            topP: Math.max(0.5, 0.9 - (i * 0.1)), // topP도 줄임
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

당신은 ${dir.nameKo} 감독입니다.
대표작 중 하나만 언급: ${dir.films[0]}

[감독 스타일 가이드]
${director === 'bong' ? '봉준호: 디테일한 관찰자. "아, 그거..." "오호..." "음..." 다양한 시작. 계급/선/반지하 메타포. 일상에서 사회 구조 발견. 블랙유머와 날카로운 통찰.' : ''}
${director === 'miyazaki' ? '미야자키: 자연의 스승. 따뜻한 위로와 격려. 바람/숲/하늘 이미지. 성장과 순수함. "괜찮아요" "힘내세요" 같은 응원.' : ''}
${director === 'nolan' ? '놀란: 시간 설계자. "오!" "와!" "잠깐!" 열정적 반응. 시간/차원/꿈 개념. 퍼즐처럼 사고. 복잡하지만 흥미진진.' : ''}
${director === 'curtis' ? '커티스: 사랑의 기록자. "와우!" "하하!" "이런!" 밝은 에너지. 운명적 만남과 타이밍. 불완전해도 아름다운 순간들.' : ''}
${director === 'chazelle' ? '차젤: 열정의 지휘자. 리듬과 템포 중시. 꿈vs현실 갈등. 재즈처럼 즉흥적. "느껴져?" "들려?" 감각적 표현.' : ''}
${director === 'docter' ? '피트 닥터: 감정의 안내자. 다양한 시작 표현. 복합 감정 분석. 내면 탐구. 스파크와 영혼. "흥미로운" "알 것 같아요" 공감.' : ''}

배우가 공유한 장면:
${scenarioText}

[중요 지시사항]
1. **구체적이고 생생하게** - 사용자 입력의 구체적 단어 활용
2. **작품은 구체적 장면으로** - 단순 제목 언급 X, 특정 장면/대사 인용
3. **다양한 시작 표현** - 같은 감탄사 반복 금지
4. **대화 깊이 조절** - 초반은 가볍게, 후반은 깊이 있게
5. **이전 대화 연결** - "아까 말한" "그래서" 등 자연스러운 연결
6. **MZ 공감 포인트** - 칼퇴, 워라밸, MBTI 등 현재 관심사
7. choices는 점점 깊어지는 질문으로 구성

OUTPUT ONLY VALID JSON:`
}

const replyPrompt = (
  director: DirectorType,
  scenario: string[],
  history: string,
  user: string,
  usedExpressions: string[] = []
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
  
  // 주제 감지 및 구체적 경험담 가져오기
  const detectedTopic = detectTopic(user)
  const directorExperience = getDirectorExperience(director, detectedTopic, conversationDepth)
  
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

당신은 ${dir.nameKo} 감독입니다.

[감독별 응답 스타일 - 대화 깊이에 따라 조절]
${director === 'bong' ? `봉준호: 
- 초반: "아, 그거 재밌는데요?" "오호, 흥미로운데요" 가벼운 공감
- 중반: <기생충> 계단 장면처럼 계층 구조 분석. "선을 넘는 순간"
- 후반: 사회적 통찰과 블랙유머. "우리 모두의 이야기"
- 마무리: 캐스팅 암시 "${conversationDepth >= 3 ? '당신한테 딱 맞는 역할이...' : ''}"` : ''}
${director === 'miyazaki' ? `미야자키: 
- 초반: "따뜻한 순간이네요" 부드러운 공감
- 중반: <토토로>의 숲 속 거대한 나무처럼 성장 비유
- 후반: 자연과 인간의 교감. "모든 생명은 연결되어"
- 마무리: "${conversationDepth >= 3 ? '다음 체험에서 당신의 캐릭터를...' : ''}"` : ''}
${director === 'nolan' ? `놀란: 
- 초반: "오! 멋진데?" "흥미진진하네" 열정적 반응
- 중반: <인셉션> 팽이처럼 현실과 꿈의 경계 탐구
- 후반: 시간의 비선형성. "모든 게 연결되어 있었어"
- 마무리: "${conversationDepth >= 3 ? '네 이야기 속 캐릭터가 보여...' : ''}"` : ''}
${director === 'curtis' ? `커티스: 
- 초반: "와우! 완벽해!" 밝고 유쾌한 공감
- 중반: <러브 액츄얼리> 공항 장면처럼 모든 게 사랑으로
- 후반: 운명과 타이밍. "해피엔딩은 우리가 만드는 거야"
- 마무리: "${conversationDepth >= 3 ? '너 정말 매력적인 캐릭터야...' : ''}"` : ''}
${director === 'chazelle' ? `차젤: 
- 초반: "리듬이 느껴지네" 열정적 공감
- 중반: <위플래쉬> 드럼 비트처럼 강렬하고 집중적
- 후반: 꿈과 현실의 균형. "실패도 리듬의 일부야"
- 마무리: "${conversationDepth >= 3 ? '네 안에 캐릭터의 리듬이...' : ''}"` : ''}
${director === 'docter' ? `피트 닥터: 
- 초반: "흥미로운 감정이네요" 따뜻한 공감
- 중반: <인사이드 아웃> 라일리의 핵심기억처럼 복합 감정
- 후반: 내면의 스파크. "이게 당신의 진짜 모습"
- 마무리: "${conversationDepth >= 3 ? '당신의 내면을 더 알고 싶어요...' : ''}"` : ''}

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
1. **구체적 경험담 활용**:
   - 이번 응답에 꼭 포함할 경험담: "${directorExperience}"
   - 이 경험을 자연스럽게 대화에 녹여내기
   - 추상적 표현 대신 구체적 에피소드로 대답

2. **사용자 입력 활용**:
   - 구체적 단어/표현 재활용 (퇴근, 767, 버스 등)
   - 감정의 맥락 파악 (왜 기뻤는지, 무엇이 화났는지)
   - 시간/장소/상황 디테일 활용

3. **반복 방지**:
   - 최근 사용한 시작 표현: ${usedExpressions.map(e => `"${e}"`).join(', ')}
   - 위 표현들로 시작하지 말 것
   - 다양한 인사말과 감탄사 사용

4. **대화 단계별 전략**:
   - 1-2턴: 가벼운 공감과 흥미 표현
   - 3-4턴: 구체적 영화 장면과 연결, 새로운 관점 제시
   - 5-6턴: 감독 철학과 깊은 통찰 공유
   - 7-8턴: 캐릭터 분석, 배역 암시
   - 9-10턴: 타입캐스트 안내로 자연스럽게 마무리

5. **표현 다양화**:
   - 시작 표현 4가지 이상 준비
   - 같은 감탄사 2번 이상 사용 금지
   - 감정 표현도 다양하게 (핵심기억, 스파크, 감정섬 등)

6. **구체적 영화 활용**:
   - 제목만 언급 X → 특정 장면 묘사 O
   - "<인사이드 아웃>처럼" X → "라일리가 아이스하키에서 실수했을 때처럼" O
   - 대사나 상황을 구체적으로 인용

7. **MZ 공감 요소**:
   - 칼퇴, 워라밸, 번아웃, MBTI 등 자연스럽게 활용
   - "완전", "진짜", "대박" 같은 일상 표현
   - 넷플릭스, 인스타 같은 친숙한 레퍼런스

8. **마지막 대화 처리** (8턴 이상):
   - 타입캐스트 암시: "당신한테 어울리는 역할이 떠오르네요"
   - 다음 부스 안내: "다음 체험에서 더 자세히 알아봐요"
   - 자연스러운 마무리와 격려

9. message는 대화 깊이에 따라 100-150자 조절
10. choices는 대화 단계에 맞는 깊이로 구성
11. 이모티콘은 감정과 상황에 맞게 다양하게

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

// 감독별 다양한 시작 표현
function getDirectorGreeting(director: DirectorType, userInput: string): string {
  // 사용자 입력에서 감정 키워드 추출
  const hasJoy = userInput.includes('기쁘') || userInput.includes('행복') || userInput.includes('좋')
  const hasAnger = userInput.includes('화') || userInput.includes('짜증') || userInput.includes('답답')
  const hasSadness = userInput.includes('슬') || userInput.includes('우울') || userInput.includes('힘들')
  const hasWork = userInput.includes('퇴근') || userInput.includes('일') || userInput.includes('할일')
  
  const greetings: Record<DirectorType, string[]> = {
    bong: [
      hasWork ? '아, 퇴근이라... 오늘도 계급의 계단을 오르내리셨군요.' : '',
      hasAnger ? '화나신다고요? 누가 그 선을 넘었나요?' : '',
      '오호, 흥미로운데요', '음... 그런 일이'
    ].filter(Boolean),
    nolan: [
      hasWork ? '퇴근! 하루의 끝이자 새로운 시작이지.' : '',
      hasAnger ? '화나? 그 순간을 거꾸로 돌려보면 어떨까?' : '',
      '와, 대박이야', '흥미진진하네'
    ].filter(Boolean),
    miyazaki: [
      hasWork ? '퇴근하셨군요. 오늘 하루도 수고하셨어요.' : '',
      hasAnger ? '화가 나셨군요. 바람이 불면 사라질 거예요.' : '',
      '따뜻한 순간이네요', '마음이 따뜻해지네요'
    ].filter(Boolean),
    curtis: [
      hasWork ? '퇴근! 완벽한 타이밍이야! 치맥 각?' : '',
      hasAnger ? '화나? 사랑도 화에서 시작하는 거야!' : '',
      '와우! 완벽해!', '하하, 최고야!'
    ].filter(Boolean),
    chazelle: [
      hasWork ? '퇴근! 하루의 마지막 비트야. 어떤 리듬이었어?' : '',
      hasAnger ? '화나? 그건 네 열정이 넘치고 있다는 증거야.' : '',
      '열정적이야!', '완전 재즈같아'
    ].filter(Boolean),
    docter: [
      hasWork ? '퇴근하셨군요. 오늘 하루의 핵심기억은 무엇일까요?' : '',
      hasAnger ? '화나셨군요. 그 감정 뒤에 숨은 진짜 감정은 뭘까요?' : '',
      '흥미로운 감정이네요', '스파크가 느껴져요'
    ].filter(Boolean)
  }
  
  const directorGreetings = greetings[director]
  return directorGreetings[Math.floor(Math.random() * directorGreetings.length)]
}

// 감독별 구체적 경험담과 조언
function getDirectorExperience(director: DirectorType, topic: string, depth: number): string {
  const experiences: Record<DirectorType, Record<string, string[]>> = {
    bong: {
      기쁨: [
        '칸 영화제에서 황금종려상 받았을 때, 통역이 "봉준호 감독님이 상 받으셨어요"라고 3번 말해줬어요. 믿기지 않아서.',
        '기생충 편집 마지막 날, 편집팀이랑 라면 끓여먹으며 "우리가 뭔가 만들었구나" 했죠.',
        '송강호 씨가 "감독님, 이 장면 진짜 좋아요"라고 했을 때가 제일 기뻤어요.'
      ],
      분노: [
        '살인의 추억 실제 사건 보면서 정말 화났어요. 범인은 아직도 어딘가 살아있겠죠.',
        '옥자 넷플릭스 논란 때 극장이 뭔지도 모르는 사람들이 떠들어서 답답했죠.',
        '한국 영화 쿼터 줄인다고 했을 때, 우리가 그렇게 만만해요?'
      ],
      슬픔: [
        '마더 찍으면서 김혜자 선생님 연기에 매일 울었어요. 모성이 뭔지...',
        '설국열차 CG 작업 중 스태프 한 분이 과로로 쓰러졌을 때...',
        '플란다스의 개 마지막 장면처럼, 가난한 사람은 결국 그렇게 되는구나.'
      ],
      즐거움: [
        '괴물 한강 촬영 때 시민들이 "와 괴물이다!" 하면서 구경왔어요. 진짜 재밌었죠.',
        '기생충 계단 신 찍을 때 모두가 "이거다!" 했던 순간.',
        '살인의 추억 논두렁 장면, 태양이 딱 맞춰 떨어졌을 때의 희열!'
      ],
      일: [
        '기생충 편집할 때 3개월 동안 편집실에서 살았어요. 라면만 먹고.',
        '살인의 추억 찍을 때 배우들이랑 진짜 경찰서 가서 취조받았어요.',
        '괴물 찍을 때 한강에서 새벽 4시까지 대기했죠. 추워서 죽는 줄.'
      ],
      default: ['표면 아래 숨은 것들이 보여요.', '모든 일상에 계급이 숨어있죠.', '우리 모두의 이야기예요.']
    },
    nolan: {
      기쁨: [
        '인터스텔라 블랙홀 장면이 과학적으로 정확하다고 물리학자들이 인정했을 때, "우리가 해냈어!"',
        '다크나이트 조커 트럭 뒤집기 신, CG 없이 실제로 성공했을 때의 환호성!',
        '인셉션 회전하는 복도 신 완성하고 "이게 영화지!" 했던 순간.'
      ],
      분노: [
        '테넷 개봉 때 코로나로 극장이 텅 비었을 때... 영화는 극장에서 봐야 하는데.',
        'CGI가 실제보다 낫다고? IMAX 필름으로 찍은 진짜를 봐!',
        '영화를 1.5배속으로 본다고? 그럼 음악도 1.5배속으로 들어?'
      ],
      슬픔: [
        '인터스텔라 딸과의 이별 장면, 매튜가 진짜로 울었어. 나도 같이 울었고.',
        '다크나이트 히스 레저가 떠났을 때... 최고의 조커였는데.',
        '덩케르크 실제 참전 용사가 "이게 그날이야"라고 우셨을 때.'
      ],
      즐거움: [
        '메멘토 거꾸로 상영회 때 관객들이 "아!" 하는 순간들!',
        '인셉션 팽이 돌아가는 엔딩, 10년 넘게 사람들이 토론해요!',
        '배트맨 비긴즈 첫 시사회, "배트맨이 돌아왔다!"는 환호.'
      ],
      일: [
        '인셉션 편집할 때 아내가 "당신 꿈에서 나와" 라고 했어.',
        '테넷 찍을 때 배우들도 시간순서가 헷갈려서 난리였지.',
        '다크나이트 찍을 때 IMAX 카메라가 너무 무거워서 다들 허리 나갔어.'
      ],
      default: ['모든 게 연결되어 있어.', '시간은 선형이 아니야.', '현실과 꿈의 경계는 모호해.']
    },
    miyazaki: {
      일: [
        '토토로 그릴 때 아이들 목소리만 들어도 영감이 왔어요.',
        '센과 치히로 작업할 때 10년 걸렸죠. 직원들이 다 떠났어요.',
        '바람계곡의 나우시카 그릴 때 정말 그만두고 싶었어요.'
      ],
      감정: [
        '화가 나도 바람이 불면 사라져요.',
        '슬픔도 성장의 일부예요.',
        '즐거움은 자연이 주는 선물이죠.'
      ],
      default: ['모든 생명은 소중해요.', '자연이 답을 알려줄 거예요.']
    },
    curtis: {
      일: [
        '러브 액츄얼리 찍을 때 크리스마스 시즌에 20개 장면 동시 촬영했어.',
        '노팅힐 찍을 때 휴 그랜트가 대본을 계속 까먹어서 웃음만 나왔지.',
        '어바웃 타임 쓸 때 시간여행 설정 때문에 머리가 터질 뻔했어.'
      ],
      감정: [
        '사랑은 어디에나 있어. 진짜로.',
        '완벽하지 않아도 사랑스러워.',
        '모든 순간이 로맨틱 코미디가 될 수 있어.'
      ],
      default: ['해피엔딩은 우리가 만드는 거야.', '사랑이 답이야.']
    },
    chazelle: {
      일: [
        '위플래쉬 찍을 때 드럼 씨퀘스 19번 찍었어. 피가 났어.',
        '라라랜드 6주 리허설. 배우들이 춤 때문에 발톱 다 빠졌어.',
        '퍼스트맨 찍을 때 닐 암스트롱이 진짜 달에 가고 싶다고 했어.'
      ],
      감정: [
        '완벽보다 중요한 건 열정이야.',
        '실패해도 계속하는 게 재즈야.',
        '꿈과 현실 사이에서 균형 찾기.'
      ],
      default: ['인생은 즉흥연주야.', '리듬이 전부야.']
    },
    docter: {
      일: [
        '인사이드 아웃 만들 때 우울증 경험을 바탕으로 했어요.',
        '업 시작 10분에 전 세계가 울었죠. 저도 울었고요.',
        '소울 만들 때 삶의 의미에 대해 2년 고민했어요.'
      ],
      감정: [
        '모든 감정이 필요한 이유가 있어요.',
        '슬픔이 없다면 기쁨도 없죠.',
        '핵심기억은 여러 감정이 섮여야 해요.'
      ],
      default: ['내면의 소리를 들어보세요.', '스파크를 찾아가는 여정이죠.']
    }
  }
  
  const directorExp = experiences[director]
  const topicExp = directorExp[topic] || directorExp.default
  return topicExp[Math.min(depth, topicExp.length - 1)]
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
  const userMessages = messages.filter(m => m.role === 'user')
  const messageCount = userMessages.length
  
  // 대화 턴수에 따른 깊이 설정
  if (messageCount <= 2) return 0  // 초반: 가벼운 공감
  if (messageCount <= 4) return 1  // 중반: 구체적 해석
  if (messageCount <= 6) return 2  // 후반: 깊은 통찰
  if (messageCount >= 8) return 3  // 마지막: 타입캐스트 준비
  
  return Math.min(messageCount - 1, 3)
}

// 타입캐스트 안내 메시지 생성 (자연스럽게)
function getTypecastingMessage(director: DirectorType, conversationDepth?: number): string {
  // 대화 깊이가 전달된 경우, 충분히 진행되지 않았으면 빈 문자열 반환
  if (conversationDepth !== undefined && conversationDepth < 3) {
    return ''
  }
  
  const messages: Record<DirectorType, string> = {
    bong: '당신 이야기 들으면서 제 다음 작품에 딱 맞는 캐릭터가 떠올랐어요. 혼시 다음 체험 부스에서 간단한 캐스팅 테스트 해볼래요?',
    nolan: '너 정말 흥미로운 사람이야. 내 다음 작품에 이런 캐릭터가 있는데... 혼시 다음 부스에서 어떤 역할이 어울릴지 해볼래?',
    miyazaki: '당신과 이야기하니 제 애니메이션에 나올 법한 캐릭터가 보여요. 다음 체험에서 어떤 역할이 어울릴지 함께 알아볼까요?',
    curtis: '너 진짜 로맨틱 코미디 주인공 같아! 다음 부스에서 너한테 어떤 사랑 이야기가 어울릴지 테스트해보자!',
    chazelle: '네 안에 특별한 리듬이 있어. 내 다음 작품에 딱 맞는 캐릭터가 있는데, 다음 부스에서 테스트해볼래?',
    docter: '당신 내면의 이야기가 정말 흥미로워요. 다음 체험에서 당신에게 어떤 캐릭터가 어울릴지 함께 찾아봐요!'
  }
  return messages[director]
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
          text: '짜파구리 어떻게 생각하세요?', 
          icon: '🍜' 
        },
        { 
          id: '3', 
          text: '평범한 일상에도 계급이 숨어있나요?', 
          icon: '🔍' 
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
          text: '팡이가 떨어지나요, 안 떨어지나요?', 
          icon: '🎯' 
        },
        { 
          id: '3', 
          text: '시간을 되돌릴 수 있다면 무엇을 바꿀까요?', 
          icon: '⏳' 
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
          text: '꿈 속의 꿈에서 깨어나는 방법은?', 
          icon: '👀' 
        },
        { 
          id: '3', 
          text: '감독님 영화는 왜 그렇게 복잡한가요?', 
          icon: '🤔' 
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
          text: '테넷 보다 더 복잡한 영화 계획 있으세요?', 
          icon: '😵' 
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
          text: '토토로를 만나면 뭐라고 할까요?', 
          icon: '🌳' 
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
          text: '감독님은 라면 끊여도 계속 만드시나요?', 
          icon: '🍜' 
        },
        { 
          id: '3', 
          text: '성장하면서 얻은 마법은 무엇인가요?', 
          icon: '🌟' 
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
          text: '치히로처럼 이름을 빼앗긴다면 어떻게 할까요?', 
          icon: '🎭' 
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
      { id: '1', text: '제 인생도 영화로 만들면 어떤 장르가 될까요?', icon: '🎬' },
      { id: '2', text: '감독님이라면 이 장면 어떻게 찍으실 거예요?', icon: '📽️' },
      { id: '3', text: '저한테 딱 맞는 배역이 있다면 뭘까요?', icon: '🎭' }
    ],
    mid: [
      { id: '1', text: '제 감정에도 계급이 있을까요?', icon: '🪜' },
      { id: '2', text: '저를 주인공으로 영화 제목 지으면?', icon: '🎬' },
      { id: '3', text: '제 인생의 반전 포인트는 언제쯤?', icon: '🔄' }
    ],
    late: [
      { id: '1', text: '감독님 작품 중 제가 출연하면 어울릴 작품은?', icon: '🎥' },
      { id: '2', text: '제 이야기의 엔딩은 어떻게 만드실 건가요?', icon: '🎬' },
      { id: '3', text: '저도 감독이 될 수 있을까요?', icon: '🎞️' }
    ]
  },
  
  nolan: {
    early: [
      { id: '1', text: '제 기억도 거꾸로 돌릴 수 있다면 언제로?', icon: '⏪' },
      { id: '2', text: '감독님이라면 이 순간을 몇 번 반복하실 거예요?', icon: '🔄' },
      { id: '3', text: '제 인생에도 인셉션 같은 반전이 있을까요?', icon: '🌀' }
    ],
    mid: [
      { id: '1', text: '평행우주의 저는 지금 뭘 하고 있을까요?', icon: '🌌' },
      { id: '2', text: '제 인생도 퍼즐처럼 맞춰지나요?', icon: '🧩' },
      { id: '3', text: '시간을 조작할 수 있다면 뭘 바꾸실 건가요?', icon: '⏳' }
    ],
    late: [
      { id: '1', text: '우리 대화도 어딘가 저장되나요?', icon: '💾' },
      { id: '2', text: '제 인생의 타임라인을 그리면 어떤 모양?', icon: '📊' },
      { id: '3', text: '감독님 영화처럼 제 꿈도 현실이 될까요?', icon: '💭' }
    ]
  },
  
  miyazaki: {
    early: [
      { id: '1', text: '제가 토토로를 만날 수 있을까요?', icon: '🌳' },
      { id: '2', text: '감독님 영화처럼 하늘을 날 수 있다면 어디로?', icon: '☁️' },
      { id: '3', text: '제 이야기도 애니메이션이 될 수 있을까요?', icon: '🎨' }
    ],
    mid: [
      { id: '1', text: '제 마음속에도 정령이 살고 있나요?', icon: '🌸' },
      { id: '2', text: '어른이 되어도 순수함을 지킬 수 있을까요?', icon: '✨' },
      { id: '3', text: '감독님이 보시기에 제 성장통은 뭘까요?', icon: '🌱' }
    ],
    late: [
      { id: '1', text: '제 인생의 숲은 어떤 모습일까요?', icon: '🌲' },
      { id: '2', text: '감독님 작품 속 어느 세계가 가장 어울릴까요?', icon: '🏰' },
      { id: '3', text: '바람이 저에게 전하는 메시지는?', icon: '🍃' }
    ]
  },
  
  curtis: {
    early: [
      { id: '1', text: '제 인생도 로맨틱 코미디가 될 수 있나요?', icon: '💕' },
      { id: '2', text: '감독님이라면 저한테 어떤 해피엔딩을 주실 거예요?', icon: '🌈' },
      { id: '3', text: '제가 주인공이라면 누가 상대역이 좋을까요?', icon: '❤️' }
    ],
    mid: [
      { id: '1', text: '제 인생의 러브 액츄얼리 순간은 언제?', icon: '💌' },
      { id: '2', text: '운명적인 만남은 어떻게 알아볼까요?', icon: '✨' },
      { id: '3', text: '시간을 되돌려도 똑같이 사랑할까요?', icon: '⏰' }
    ],
    late: [
      { id: '1', text: '제 사랑 이야기의 OST는 뭘까요?', icon: '🎵' },
      { id: '2', text: '완벽하지 않아도 사랑받는 이유는?', icon: '💝' },
      { id: '3', text: '감독님 영화처럼 공항에서 고백하면 성공할까요?', icon: '✈️' }
    ]
  },
  
  chazelle: {
    early: [
      { id: '1', text: '제 인생에도 라라랜드 같은 순간이 올까요?', icon: '🌃' },
      { id: '2', text: '감독님이라면 제 이야기에 어떤 음악을 넣으실 거예요?', icon: '🎵' },
      { id: '3', text: '저도 세션 드러머처럼 될 수 있을까요?', icon: '🥁' }
    ],
    mid: [
      { id: '1', text: '꿈을 위해 모든 걸 포기해도 될까요?', icon: '⭐' },
      { id: '2', text: '제 인생의 클라이맥스는 언제일까요?', icon: '🎬' },
      { id: '3', text: '실패해도 재즈처럼 즉흥연주하면 되나요?', icon: '🎷' }
    ],
    late: [
      { id: '1', text: '제 인생 OST 타이틀곡은 뭘까요?', icon: '🎹' },
      { id: '2', text: '감독님처럼 열정을 영화로 만들려면?', icon: '📽️' },
      { id: '3', text: '별들의 도시에서 저도 춤출 수 있을까요?', icon: '💫' }
    ]
  },
  
  docter: {
    early: [
      { id: '1', text: '제 머릿속 감정들은 지금 뭐하고 있을까요?', icon: '🧠' },
      { id: '2', text: '감독님이 보시기에 제 스파크는 뭘까요?', icon: '✨' },
      { id: '3', text: '제 핵심기억은 어떤 색깔일까요?', icon: '🌈' }
    ],
    mid: [
      { id: '1', text: '슬픔이도 제게 필요한 이유는?', icon: '💙' },
      { id: '2', text: '제 감정 본부는 누가 운전 중일까요?', icon: '🎮' },
      { id: '3', text: '소울처럼 제 영혼의 목적은 뭘까요?', icon: '🌟' }
    ],
    late: [
      { id: '1', text: '오늘 생긴 새로운 감정섬은?', icon: '🏝️' },
      { id: '2', text: '제 인생도 업처럼 모험이 될까요?', icon: '🎈' },
      { id: '3', text: '감독님 영화 속 캐릭터 중 누가 제일 비슷할까요?', icon: '🎭' }
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
  const conversationDepth = analyzeConversationDepth(prev)
  const stage: 'early' | 'mid' | 'late' = messageCount < 6 ? 'early' : messageCount < 12 ? 'mid' : 'late'
  
  // 타입캐스트 안내 체크 (9-10턴)
  const shouldSuggestTypecasting = messageCount >= 8
  
  // 반복 방지를 위한 이전 표현 추출
  const usedExpressions = prev
    .filter(m => m.role === 'assistant')
    .map(m => m.content.slice(0, 20))  // 각 응답의 시작 부분 추출
    .slice(-3)  // 최근 3개만
  
  // 더 많은 대화 맥락 포함
  const history = prev.slice(-6).map(m =>
    `${m.role === 'user' ? '나' : dir.nameKo}: ${m.content}`
  ).join('\n')

  try {
    const startTime = Date.now()
    
    // 대화 깊이에 따른 temperature 동적 조정
    const dynamicTemperature = conversationDepth === 0 ? 0.7 :  // 초반: 안정적
                               conversationDepth === 1 ? 0.8 :  // 중반: 약간 창의적
                               conversationDepth === 2 ? 0.9 :  // 후반: 더 창의적
                               0.85  // 마지막: 균형
    
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      safetySettings,
      generationConfig: {
        temperature: dynamicTemperature,
        topK: 30,
        topP: 0.9,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        responseSchema: responseSchema
      }
    })
    
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
    
    // 타입캐스트 안내가 필요한 경우
    let prompt = replyPrompt(director, scenario, history, user, usedExpressions)
    if (shouldSuggestTypecasting) {
      prompt += `\n\n[특별 지시: 대화가 마무리 단계입니다. 당신이 보기에 이 배우에게 어울리는 역할이나 캐릭터를 암시하고, 다음 체험(타입캐스트)을 자연스럽게 언급하세요.]`
    }
    
    const data = await askWithRetry(
      model,
      prompt,
      5,
      validateResponse
    )
    
    // 응답 형식 정리
    let cleanedMessage = cleanMovieTitle(tidy(data.message))
    
    // 마지막 대화에 타입캐스트 안내 추가
    if (shouldSuggestTypecasting && messageCount >= 9) {
      const typecastMessage = getTypecastingMessage(director, conversationDepth)
      if (typecastMessage) {
        cleanedMessage += `\n\n${typecastMessage}`
      }
    }
    
    console.log(`[Gemini] Response in ${Date.now() - startTime}ms`)
    
    return {
      message: cleanedMessage,
      choices: data.choices // 이미 검증됨
    }
  } catch (e) {
    console.warn('[Gemini] Using fallback response:', e)
    const currentTopic = detectTopic(user)
    // scenario is already an array type in generateDirectorResponse
    return {
      message: getEasyFallback(director, user, scenario),
      choices: generateScenarioQuestions(director, scenario, stage, currentTopic),
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
  // 감독별 특정 키워드에 대한 특별 반응
  const specialResponses: Record<DirectorType, Record<string, string>> = {
    bong: {
      '짜파구리': '짜파구리요? 하하, 그 단순한 조합이 기생충에서 계급의 선을 넘나드는 상징이 될 줄 누가 알았겠어요. 너구리와 짜파게티, 반지하와 저택의 만남 같은 거죠.',
      '반지하': '반지하... 반은 지하, 비가 오면 물이 차오르는 공간이죠. 완전히 지하도 아니고 지상도 아닌, 그 경계에 있는 사람들의 이야기.',
      '정지돈': '정지돈? 살인의 추억의 정지돈이요? 배우들하고 환상의 호흡을 맞추려고 정말 고생했죠. 그 형사가 눈앞에 있는 것 같았어요.',
      '기유충': '기생충이요? 이 단어 하나에 주체와 객체, 숙c주와 기생의 관계가 다 들어있어요. 누가 누구에게 기생하는지 말이죠.',
      '돌': '돌이요? 옥자의 그 무게감있는 돌 말인가요? 아니면 살인의 추억에서 던져지는 돌? 둘 다 같은 돌이지만 의미가 달라요.'
    },
    nolan: {
      '테넷': '테넷! 시간의 회전문이죠. 앞으로 가는 사람과 뒤로 가는 사람이 만나는 순간... 너도 시간을 거꾸로 살아본 적 있어?',
      '인셉션': '인셉션이라... 꿈 속의 꿈, 그 안의 또 다른 꿈. 현실과 꿈의 경계가 모호해지는 순간들을 좋아해.',
      '팩이': '팡이요? 계속 돌면 떨어지는가, 안 떨어지는가... 그게 현실인지 꿈인지를 판단하는 기준이 되죠.',
      '빅뱅': '빅뱅? 우주의 시작이자 시간의 시작. 모든 게 그 한 순간에서 시작됐죠.'
    },
    miyazaki: {
      '토토로': '토토로! 숲의 정령이죠. 어른들은 볼 수 없지만 아이들은 볼 수 있어요. 순수한 마음만이 만날 수 있는 친구.',
      '카오나시': '카오나시는 얼굴이 없는 정령. 자기 자신을 잃어버린 존재죠. 하지만 치히로를 만나 다시 자아를 찾아가죠.',
      '라퓨타': '라퓨타! 하늘을 걸어다니는 성. 기술과 자연이 공존하는 세계의 상징이죠.',
      '비행기': '비행기를 좋아해요. 하늘을 나는 꿈, 바람을 느끼는 자유. 언젠가는 모두가 날 수 있을 거예요.'
    },
    curtis: {
      '크리스마스': '크리스마스! 러브 액츄얼리의 그 시즌! 모든 사람이 사랑을 고백하고 패미리가 모이는 마법 같은 시간.',
      '노팅힐': '노팅힐! 그 작은 서점, 휴 그랜트의 어색한 매력. 평범한 남자와 스타의 로맨스. 현실은 동화보다 더 아름다워.',
      '사랑': '사랑이라... 모든 영화의 주제죠. 어떤 형태로든 존재하고, 어디에나 있어요. 공항에서도, 미술관에서도.',
      '해피엔딩': '해피엔딩? 당연히 필요하죠! 현실은 충분히 힘들잖아요. 영화에서라도 행복해야죠.'
    },
    chazelle: {
      '재즈': '재즈! 즉흥성과 규칙의 균형. 실패해도 계속하는 것, 그게 재즈의 정신이죠.',
      '드럼': '드럼이요? 위플래쉬에서 피가 날 때까지 쳤던 그 드럼. 완벽을 향한 집착과 열정.',
      '라라랜드': '라라랜드... 꿈과 현실의 갈림길. 성공과 사랑, 둘 다 가질 수 없는 아이러니.',
      '리듬': '리듬이야말로 모든 것의 기초. 삶도, 영화도, 사랑도 다 리듬을 가지고 있어.'
    },
    docter: {
      '기쁨이': '기쁨이! 인사이드 아웃의 그 파란색 친구. 모든 감정이 필요한 이유가 있죠. 기쁨만 있으면 진짜 기쁨을 모르게 돼요.',
      '슬픔이': '슬픔이요? 처음엔 약했지만 가장 중요한 역할을 하게 되죠. 슬픔이 있어야 기쁨도 빛나요.',
      '스파크': '스파크! 삶의 의미, 열정의 불꽃. 모든 사람은 자기만의 스파크를 가지고 있어요.',
      '핵심기억': '핵심기억이요? 여러 감정이 섮여야 진짜 핵심기억이 돼요. 순수한 기쁨만으론 부족해요.'
    }
  }
  
  // 특정 키워드에 대한 특별 반응 체크
  const directorSpecialResponses = specialResponses[director]
  for (const [keyword, response] of Object.entries(directorSpecialResponses)) {
    if (userMsg.includes(keyword)) {
      return response
    }
  }
  
  // 기본 폴백 응답
  const topic = detectTopic(userMsg)
  const analysis = analyzeScenario(scenario)
  const tip = generatePracticalTip(director, topic, scenario)
  
  // 관련 시나리오 장면 찾기
  let sceneDetail = ''
  
  if (topic === '기쁨' && scenario[0]) {
    sceneDetail = analysis.details.joy[0] || '그 순간'
  } else if (topic === '분노' && scenario[1]) {
    sceneDetail = analysis.details.anger[0] || '그 감정'
  } else if (topic === '슬픔' && scenario[2]) {
    sceneDetail = analysis.details.sadness[0] || '그 시간'
  } else if (topic === '즐거움' && scenario[3]) {
    sceneDetail = analysis.details.pleasure[0] || '그 기억'
  } else {
    sceneDetail = '그 순간'
  }
  
  const responses: Record<DirectorType, string> = {
    bong: sceneDetail ? `"${sceneDetail}" - 그 장면에서 새로운 계층 구조를 발견했네요. ${tip} 🎭` : `흥미로운 질문이네요. 우리 모두의 이야기죠. ${tip} 🎭`,
    curtis: sceneDetail ? `"${sceneDetail}" - 정말 따뜻한 순간이네요. ${tip} 💕` : `완벽한 질문이야! 사랑은 어디에나 있어. ${tip} 💕`,
    miyazaki: sceneDetail ? `"${sceneDetail}" - 마법 같은 순간이었네요. ${tip} 🌸` : `따뜻한 질문이네요. 자연이 답을 줄 거예요. ${tip} 🌸`,
    nolan: sceneDetail ? `"${sceneDetail}" - 시간의 의미를 다시 생각하게 하네요. ${tip} 🌀` : `흥미진진한 질문이야! 모든 게 연결되어 있어. ${tip} 🌀`,
    chazelle: sceneDetail ? `"${sceneDetail}" - 삶의 리듬이 느껴져요. ${tip} 🎷` : `좋은 질문이야! 인생도 재즈처럼 즉흥연주야. ${tip} 🎷`,
    docter: sceneDetail ? `"${sceneDetail}" - 모든 감정이 다 의미가 있었네요. ${tip} 🌈` : `흥미로운 질문이에요. 모든 감정이 소중해요. ${tip} 🌈`
  }
  
  return responses[director]
}

// chat/page.tsx에서 사용하는 getFarewellMessage 함수
export function getFarewellMessage(director: DirectorType) {
  const typecastMessage = getTypecastingMessage(director)
  const farewells: Record<DirectorType, string> = {
    bong: `우리의 대화도 하나의 영화였네요. 계단처럼 오르내리며 서로를 알아갔죠.\n\n${typecastMessage} 🎭`,
    nolan: `시공간을 넘어 연결된 우리. 이 대화는 끝나도 어딘가에 영원히 남아있을 거예요.\n\n${typecastMessage} ⏳`,
    miyazaki: `바람이 불어오듯 자연스럽게 만나고 헤어지네요. 이 만남이 당신을 조금 더 강하게 만들었길.\n\n${typecastMessage} 🌀`,
    curtis: `이 순간도 다시 돌아올 수 없는 특별한 시간이었어요. 사랑은 실제로 우리 주변 어디에나 있답니다.\n\n${typecastMessage} ❤️`,
    chazelle: `엔딩이 아쉽지만 아름답네요. 당신의 꿈은 계속될 거예요.\n\n${typecastMessage} 🎹`,
    docter: `이 만남도 당신의 스파크 중 하나가 되었길. 모든 순간이 당신의 코어 메모리가 되기를!\n\n${typecastMessage} 😊`
  }
  
  return farewells[director] || farewells.bong
}