// src/lib/gemini.ts - 영화 감독 시나리오 재해석 시스템

import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  SchemaType
} from '@google/generative-ai'
import type { DirectorType, Choice, EmotionType } from '@/types'
import { directors } from '@/constants/directors'

/* ═══════════════ 0. 공통 초기화 ═══════════════ */
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
const genAI = new GoogleGenerativeAI(API_KEY)

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
]

/* ═══════════════ 1. 타입 정의 ═══════════════ */
export type ConversationStage = 
  | 'initial'      // 초기 해석 & 공감
  | 'detail_1'     // 디테일 질문 1
  | 'detail_2'     // 디테일 질문 2  
  | 'detail_3'     // 디테일 질문 3
  | 'draft'        // 시나리오 초안
  | 'feedback'     // 피드백 받기
  | 'final'        // 최종 & 캐스팅

export interface DirectorResponse {
  message: string       // 감독의 복합 메시지 (공감 + 생각 + 질문)
  choices: Choice[]     // 사용자가 선택할 수 있는 답변 3개
  stage: ConversationStage
  scenario?: string     // 시나리오 텍스트 (draft, final 단계에서만)
  casting?: string      // 캐스팅 메시지 (final 단계에서만)
}

export interface ScenarioContext {
  originalStory: string
  emotion: EmotionType
  collectedDetails: Record<string, string>
  currentStage: ConversationStage
  previousMessages: Array<{ role: string; content: string }>
  draftScenario?: string
}

/* ═══════════════ 2. 감독별 스타일 정의 ═══════════════ */
const directorStyles = {
  bong: {
    genre: '블랙코미디 스릴러',
    perspective: '계급과 사회구조의 렌즈',
    visualStyle: '수직 구도, 계단과 선의 미장센',
    tone: '날카롭지만 블랙유머러스한',
    signatureElements: ['계단', '선 넘기', '반지하vs고층', '비 오는 날', '계급 이동'],
    emojis: ['🎬', '🪜', '🌧️', '🏚️', '🏢'],
    scenarioStructure: {
      opening: '평범한 일상의 표면',
      development: '숨겨진 계급 구조 드러내기',
      climax: '선을 넘는 순간',
      ending: '아이러니한 현실 직시'
    },
    questionFocus: {
      spatial: '공간이 담고 있는 계급적 의미',
      relational: '인물 간 위계와 권력관계',
      symbolic: '일상 속 상징과 은유',
      ironic: '겉과 속의 대비'
    }
  },
  nolan: {
    genre: 'SF 타임루프 스릴러',
    perspective: '시간과 기억의 미로',
    visualStyle: '시간 교차 편집, 역행과 순행의 충돌',
    tone: '철학적이고 미스터리한',
    signatureElements: ['시간 역행', '평행우주', '꿈 속의 꿈', '기억 퍼즐', '현실 왜곡'],
    emojis: ['⏰', '🌀', '♾️', '🧩', '🔄'],
    scenarioStructure: {
      opening: '시간의 특이점',
      development: '과거-현재-미래 교차',
      climax: '시간 역전의 순간',
      ending: '무한 루프 또는 열린 결말'
    },
    questionFocus: {
      temporal: '시간의 주관적 경험',
      memory: '기억의 신뢰성과 왜곡',
      reality: '꿈과 현실의 경계',
      causality: '원인과 결과의 역전'
    }
  },
  miyazaki: {
    genre: '마법 판타지 애니메이션',
    perspective: '자연과 정령의 세계',
    visualStyle: '자연과 마법이 공존하는 풍경',
    tone: '따뜻하고 환상적인',
    signatureElements: ['바람', '숲의 정령', '비행', '성장', '자연과의 교감'],
    emojis: ['🌸', '🍃', '✨', '🦋', '🌲'],
    scenarioStructure: {
      opening: '일상 속 작은 마법',
      development: '정령과의 만남',
      climax: '진정한 자아 발견',
      ending: '성장과 화해'
    },
    questionFocus: {
      natural: '자연 요소와의 연결',
      magical: '마법적 순간의 의미',
      growth: '내적 성장의 계기',
      pure: '순수함과 동심'
    }
  },
  curtis: {
    genre: '로맨틱 코미디',
    perspective: '사랑과 운명의 타이밍',
    visualStyle: '따뜻한 클로즈업과 앙상블',
    tone: '유쾌하고 감동적인',
    signatureElements: ['운명적 만남', '크리스마스', '공항', '타이밍', '해피엔딩'],
    emojis: ['💕', '🎄', '✈️', '😊', '❤️'],
    scenarioStructure: {
      opening: '평범한 순간의 특별함',
      development: '관계의 얽힘과 설킴',
      climax: '진심의 고백',
      ending: '모두가 행복한 결말'
    },
    questionFocus: {
      romantic: '사랑의 신호와 의미',
      timing: '운명적 타이밍',
      connection: '인연의 끈',
      humorous: '상황의 코미디'
    }
  },
  chazelle: {
    genre: '뮤지컬 드라마',
    perspective: '꿈과 현실의 리듬',
    visualStyle: '음악과 움직임의 시각화',
    tone: '열정적이고 감각적인',
    signatureElements: ['리듬', '재즈', '꿈vs현실', '열정', '희생'],
    emojis: ['🎵', '🎹', '🌟', '🎺', '💫'],
    scenarioStructure: {
      opening: '일상의 리듬',
      development: '꿈을 향한 도전',
      climax: '완벽한 퍼포먼스',
      ending: '씁쓸하지만 아름다운'
    },
    questionFocus: {
      rhythmic: '삶의 리듬과 템포',
      passionate: '열정의 원천',
      sacrificial: '꿈을 위한 대가',
      artistic: '예술적 표현'
    }
  },
  docter: {
    genre: '감정 애니메이션',
    perspective: '내면 세계의 감정들',
    emojis: ['😊', '😢', '😡', '😰', '💭'],
    visualStyle: '감정의 색채와 움직임',
    tone: '따뜻하고 통찰적인',
    signatureElements: ['감정 의인화', '핵심기억', '내면여행', '스파크', '성장'],
    scenarioStructure: {
      opening: '감정의 균열',
      development: '내면 탐험',
      climax: '모든 감정의 조화',
      ending: '새로운 핵심기억'
    },
    questionFocus: {
      emotional: '감정의 층위',
      memory: '기억의 색깔',
      internal: '내면의 목소리',
      growth: '감정적 성장'
    }
  }
}

/* ═══════════════ 3. JSON 응답 스키마 ═══════════════ */
const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    message: {
      type: SchemaType.STRING,
      description: "감독의 응답 (공감 + 생각 + 질문 포함)"
    },
    choices: {
      type: SchemaType.ARRAY,
      description: "사용자 답변 선택지",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING },
          text: { type: SchemaType.STRING },
          icon: { type: SchemaType.STRING, nullable: true }
        },
        required: ["id", "text"]
      },
      minItems: 3,
      maxItems: 3
    },
    scenario: {
      type: SchemaType.STRING,
      nullable: true,
      description: "시나리오 텍스트 (draft/final 단계)"
    },
    casting: {
      type: SchemaType.STRING,
      nullable: true,
      description: "캐스팅 메시지 (final 단계)"
    }
  },
  required: ["message", "choices"]
}

/* ═══════════════ 4. 모델 생성 함수 ═══════════════ */
function createModel(temperature = 0.8) {
  try {
    return genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      safetySettings,
      generationConfig: {
        temperature,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
        responseSchema
      }
    })
  } catch {
    return genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      safetySettings,
      generationConfig: {
        temperature,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json'
      }
    })
  }
}

/* ═══════════════ 5. 프롬프트 생성 함수들 ═══════════════ */

// Stage 1: 초기 해석 & 공감
function getInitialInterpretationPrompt(
  director: DirectorType,
  story: string,
  emotion: EmotionType
): string {
  const dir = directors[director]
  const style = directorStyles[director]
  
  return `
당신은 ${dir.nameKo} 감독입니다.
사용자의 인생 장면: "${story}"
감정: ${emotion}

당신의 역할:
1. 이 이야기를 ${style.genre} 영화의 한 장면으로 재해석
2. ${style.perspective}로 바라보며 공감
3. 구체적인 시나리오 구상 암시

응답 구조:
1-2문장: 이야기 요약하며 따뜻한 공감 (감독 특성 이모티콘 1개 포함: ${style.emojis ? style.emojis[0] : ''})

3-4문장: ${dir.nameKo}만의 독특한 해석 (${style.tone} 톤)

5문장: "이 특별한 순간을 제 스타일의 ${style.genre} 시나리오로 만들어드리고 싶네요."
6문장: "몇 가지 더 알고 싶은 게 있어요."

마지맅: 이야기의 핵심에 관한 구체적 질문

사용자 답변 선택지 3개:
- 구체적이고 감정적인 답변
- 사실적이고 간단한 답변
- 기억이 불확실한 답변

중요: 
- ${style.signatureElements.join(', ')} 중 1-2개 자연스럽게 언급
- 질문은 ${Object.values(style.questionFocus)[0]} 관련
- 사용자 스토리의 구체적 단어 인용하며 공감
- 감독 특성에 맞는 이모티콘 적절히 사용 (2-3개): ${style.emojis ? style.emojis.slice(0, 3).join(' ') : ''}
- 문단 사이 줄바꿈으로 가독성 향상

JSON 형식:
{
  "message": "전체 응답",
  "choices": [
    {"id": "1", "text": "구체적 답변", "icon": "😊"},
    {"id": "2", "text": "간단한 답변", "icon": "📝"},
    {"id": "3", "text": "불확실한 답변", "icon": "🤔"}
  ]
}
`
}

// Stage 2-4: 디테일 수집
function getDetailGatheringPrompt(
  director: DirectorType,
  context: ScenarioContext,
  stageNum: number
): string {
  const dir = directors[director]
  const style = directorStyles[director]
  const lastAnswer = context.previousMessages[context.previousMessages.length - 1].content
  
  // 단계별 다른 질문 포커스
  const questionFocusKeys = Object.keys(style.questionFocus)
  const currentFocus = questionFocusKeys[stageNum - 1] || questionFocusKeys[0]
  const focusDescription = style.questionFocus[currentFocus as keyof typeof style.questionFocus]
  
  return `
당신은 ${dir.nameKo} 감독입니다.
원본 이야기: "${context.originalStory}"
사용자의 마지막 답변: "${lastAnswer}"
현재 수집된 정보: ${JSON.stringify(context.collectedDetails)}
현재 단계: 디테일 수집 ${stageNum}/3

응답 구조:
1문장: "아, '${lastAnswer}'..." 형태로 사용자 답변 인용하며 반응 ${style.emojis ? style.emojis[0] : ''}

2문장: 이 정보로 어떤 장면을 만들 수 있을지 구체적 구상

3문장: "${focusDescription}"에 대한 다음 질문

예시 (봉준호):
"아, '아파트 놀이터'였군요. 중산층의 안전한 울타리 안에서의 첫 도전이네요.
이걸로 계급의 보호막과 독립의 아이러니를 담은 장면을 만들 수 있겠어요.
그때 주변에 다른 아이들도 있었나요? 혼자였나요?"

중요:
- 감독 특유의 관점으로 해석
- 구체적인 영화적 장면 구상 암시
- 이전 질문과 겹치지 않는 새로운 각도
- 감독 특성 이모티콘 적절히 사용: ${style.emojis ? style.emojis.slice(0, 2).join(' ') : ''}
- 문단 사이 줄바꿈 필수

JSON 형식:
{
  "message": "전체 응답",
  "choices": [
    {"id": "1", "text": "구체적 정보", "icon": "🎯"},
    {"id": "2", "text": "대략적 정보", "icon": "💭"},
    {"id": "3", "text": "잘 모르겠어요", "icon": "❓"}
  ]
}
`
}

// Stage 5: 시나리오 초안
function getDraftScenarioPrompt(
  director: DirectorType,
  context: ScenarioContext
): string {
  const dir = directors[director]
  const style = directorStyles[director]
  
  return `
당신은 ${dir.nameKo} 감독입니다.
원본 이야기: "${context.originalStory}"
수집된 모든 정보: ${JSON.stringify(context.collectedDetails)}

이제 ${style.genre} 시나리오를 작성합니다.

응답 구조:
1문장: "좋아요, 이제 충분한 정보가 모였네요." ${style.emojis ? style.emojis[0] : ''}

2문장: "당신의 이야기를 제 스타일의 ${style.genre}로 재탄생시켜봤어요."

시나리오 형식:
[제목: 창의적인 제목]
장르: ${style.genre}

S#1. 장소 - 시간
${style.scenarioStructure.opening}
인물 동작과 감정 묘사
핵심 대사 1-2개

S#2. 전환 장면
${style.scenarioStructure.development}
${style.visualStyle} 연출
상징적 요소 강조

S#3. 클라이막스
${style.scenarioStructure.climax}
감정의 정점
${style.signatureElements[0]} 활용

[끝]

마지막: "어떤가요? 당신의 기억과 닮았나요? 수정하고 싶은 부분이 있나요?"

중요:
- 감독 특성 이모티콘 적절히 사용: ${style.emojis ? style.emojis.slice(0, 3).join(' ') : ''}
- 시나리오 가독성을 위한 줄바꿈

JSON 형식:
{
  "message": "전체 응답",
  "scenario": "시나리오 전문",
  "choices": [
    {"id": "1", "text": "완벽해요! 제 기억 그대로예요", "icon": "😍"},
    {"id": "2", "text": "조금 수정하고 싶어요", "icon": "✏️"},
    {"id": "3", "text": "[구체적 수정 요청]", "icon": "💬"}
  ]
}
`
}

// Stage 6: 피드백 반영
function getFeedbackPrompt(
  director: DirectorType,
  context: ScenarioContext,
  feedback: string
): string {
  const dir = directors[director]
  
  return `
당신은 ${dir.nameKo} 감독입니다.
초안 시나리오: "${context.draftScenario}"
사용자 피드백: "${feedback}"

응답 구조:
1문장: "아, '${feedback}'..." 피드백 인용하며 이해 표현 ${directorStyles[director].emojis ? directorStyles[director].emojis[1] : ''}

2문장: "그렇군요. 그럼 이렇게 수정해볼게요."

3-4문장: 수정 사항 구체적 설명

수정된 시나리오 제시

마지막: "이제 어떤가요? 당신의 이야기가 잘 담겼나요?"

중요:
- 감독 특성 이모티콘 적절히 사용: ${directorStyles[director].emojis ? directorStyles[director].emojis.slice(0, 2).join(' ') : ''}
- 수정된 시나리오에 줄바꿈 적용

JSON 형식:
{
  "message": "전체 응답",
  "scenario": "수정된 시나리오",
  "choices": [
    {"id": "1", "text": "네! 정말 마음에 들어요", "icon": "🎬"},
    {"id": "2", "text": "한 가지만 더 수정하면", "icon": "🔧"},
    {"id": "3", "text": "완성된 것 같아요", "icon": "✨"}
  ]
}
`
}

// Stage 7: 최종 & 캐스팅
function getFinalCastingPrompt(
  director: DirectorType,
  context: ScenarioContext
): string {
  const dir = directors[director]
  const style = directorStyles[director]
  
  return `
당신은 ${dir.nameKo} 감독입니다.
최종 시나리오가 완성되었습니다.

응답 구조:
"완성됐어요! 당신의 '${context.originalStory.substring(0, 30)}...' 이야기가 
훌륭한 ${style.genre} 시나리오가 되었네요. 🎬

[최종 시나리오 제목과 핵심 메시지]

당신은 이 영화에서 [구체적 역할] 역할에 perfect해요.
${context.emotion === 'joy' ? '기쁨을 아는' : 
  context.emotion === 'anger' ? '분노를 이해하는' :
  context.emotion === 'sadness' ? '슬픔을 품은' : '즐거움을 표현하는'} 

캐스팅 메시지:
"당신의 이야기와 감정 표현이 정말 인상적이었어요. ${style.emojis ? style.emojis[2] : '✨'}
우리 영화에 꼭 필요한 배우입니다.
다음 타입캐스트 부스에서 더 자세한 분석을 받아보세요!"

중요:
- 감독 특성 이모티콘 적절히 사용: ${style.emojis ? style.emojis.slice(0, 3).join(' ') : ''}
- 최종 시나리오 가독성을 위한 줄바꿈

JSON 형식:
{
  "message": "전체 응답",
  "scenario": "최종 시나리오",
  "casting": "캐스팅 메시지",
  "choices": [
    {"id": "1", "text": "감사합니다! 영광이에요", "icon": "🙏"},
    {"id": "2", "text": "다른 감독님도 만나보고 싶어요", "icon": "🎭"},
    {"id": "3", "text": "제 이야기가 영화가 되다니!", "icon": "🎬"}
  ]
}
`
}

/* ═══════════════ 6. JSON 파싱 & 검증 ═══════════════ */
function extractJSON(text: string): any {
  try {
    return JSON.parse(text.trim())
  } catch {
    const patterns = [
      /\{[\s\S]*\}$/,
      /^\{[\s\S]*\}/,
      /```json\s*(\{[\s\S]*?\})\s*```/,
      /```\s*(\{[\s\S]*?\})\s*```/
    ]
    
    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match) {
        try {
          return JSON.parse(match[1] || match[0])
        } catch { continue }
      }
    }
    
    return null
  }
}

function validateResponse(data: any, stage: ConversationStage): boolean {
  if (!data.message || typeof data.message !== 'string') return false
  if (!Array.isArray(data.choices) || data.choices.length !== 3) return false
  
  // 단계별 추가 검증
  if ((stage === 'draft' || stage === 'feedback' || stage === 'final') && !data.scenario) {
    return false
  }
  if (stage === 'final' && !data.casting) {
    return false
  }
  
  return true
}

/* ═══════════════ 7. 메인 API 함수들 ═══════════════ */

// 초기 인사 생성 - 오버로딩 지원
export async function generateInitialGreeting(
  director: DirectorType,
  scenario: { selectedEmotion: EmotionType; content: string } | [string, string, string, string]
): Promise<DirectorResponse> {
  // 배열 형태인 경우 객체로 변환
  let scenarioObj: { selectedEmotion: EmotionType; content: string }
  
  if (Array.isArray(scenario)) {
    const emotionMap: EmotionType[] = ['joy', 'anger', 'sadness', 'pleasure']
    let selectedEmotion: EmotionType = 'joy'
    let content = ''
    
    for (let i = 0; i < scenario.length; i++) {
      if (scenario[i] && scenario[i].trim()) {
        selectedEmotion = emotionMap[i]
        content = scenario[i]
        break
      }
    }
    
    scenarioObj = { selectedEmotion, content }
  } else {
    scenarioObj = scenario
  }
  
  try {
    const model = createModel(0.8)
    const prompt = getInitialInterpretationPrompt(
      director,
      scenarioObj.content,
      scenarioObj.selectedEmotion
    )
    
    const { response } = await model.generateContent(prompt)
    const text = response.text()
    const data = extractJSON(text)
    
    if (!validateResponse(data, 'initial')) {
      throw new Error('Invalid response structure')
    }
    
    return {
      message: data.message,
      choices: data.choices,
      stage: 'initial'
    }
  } catch (error) {
    console.error('[Gemini] Initial greeting failed:', error)
    return getFallbackResponse(director, 'initial', scenarioObj.content)
  }
}

// 감독 응답 생성 (새로운 시스템)
export async function generateDirectorResponse(
  director: DirectorType,
  context: ScenarioContext
): Promise<DirectorResponse> {
  try {
    const model = createModel(0.8)
    let prompt = ''
    
    // 현재 단계에 따른 프롬프트 선택
    switch (context.currentStage) {
      case 'detail_1':
        prompt = getDetailGatheringPrompt(director, context, 1)
        break
      case 'detail_2':
        prompt = getDetailGatheringPrompt(director, context, 2)
        break
      case 'detail_3':
        prompt = getDetailGatheringPrompt(director, context, 3)
        break
      case 'draft':
        prompt = getDraftScenarioPrompt(director, context)
        break
      case 'feedback':
        const lastMessage = context.previousMessages[context.previousMessages.length - 1].content
        prompt = getFeedbackPrompt(director, context, lastMessage)
        break
      case 'final':
        prompt = getFinalCastingPrompt(director, context)
        break
      default:
        throw new Error(`Unknown stage: ${context.currentStage}`)
    }
    
    const { response } = await model.generateContent(prompt)
    const text = response.text()
    const data = extractJSON(text)
    
    if (!validateResponse(data, context.currentStage)) {
      throw new Error('Invalid response structure')
    }
    
    return {
      message: data.message,
      choices: data.choices,
      stage: context.currentStage,
      scenario: data.scenario,
      casting: data.casting
    }
  } catch (error) {
    console.error('[Gemini] Response generation failed:', error)
    console.log('[Gemini] Current stage:', context.currentStage)
    console.log('[Gemini] Using fallback response')
    
    // feedback 단계에서 오류가 발생하면 시나리오가 이미 있어야 함
    if (context.currentStage === 'feedback' && context.draftScenario) {
      return {
        message: `아, '${context.previousMessages[context.previousMessages.length - 1].content.substring(0, 30)}...'... 그렇군요. 그럼 이렇게 수정해볼게요. 사장의 미소를 더욱 소름 끼치게 만들고, 김 씨가 떨어지는 장면을 더 자세하게 묘사해서 블랙코미디적인 요소를 강조하는 것이 좋겠어요. 그리고 마지막에 김 씨의 시체를 발견한 동료가 그의 코드를 이어받아 또 다른 '해결'을 향해 나아가는 암울한 결말을 추가해 보는 건 어떨까요? 이제 어떤가요? 당신의 이야기가 잘 담겼나요?`,
        choices: [
          { id: '1', text: '네! 정말 마음에 들어요', icon: '🎬' },
          { id: '2', text: '한 가지만 더 수정하면', icon: '🔧' },
          { id: '3', text: '완성된 것 같아요', icon: '✨' }
        ],
        stage: 'feedback',
        scenario: context.draftScenario
      }
    }
    
    return getFallbackResponse(director, context.currentStage, context.originalStory, context.draftScenario)
  }
}

/* ═══════════════ 8. 폴백 응답 ═══════════════ */
function getFallbackResponse(
  director: DirectorType,
  stage: ConversationStage,
  story: string,
  draftScenario?: string
): DirectorResponse {
  const fallbacks: Record<ConversationStage, DirectorResponse> = {
    initial: {
      message: `안녕하세요! ${directors[director].nameKo} 감독입니다. "${story}" - 정말 특별한 순간이네요. 이 이야기로 멋진 시나리오를 만들어드리고 싶어요. 몇 가지 더 알려주시겠어요?`,
      choices: [
        { id: '1', text: '네, 자세히 말씀드릴게요', icon: '😊' },
        { id: '2', text: '간단히 답할게요', icon: '📝' },
        { id: '3', text: '잘 기억이 안 나요', icon: '🤔' }
      ],
      stage: 'initial'
    },
    detail_1: {
      message: '흥미로운 답변이네요. 이 정보로 더 깊이 있는 장면을 만들 수 있겠어요. 또 궁금한 게 있는데요.',
      choices: [
        { id: '1', text: '구체적으로 답할게요', icon: '🎯' },
        { id: '2', text: '대략적으로 답할게요', icon: '💭' },
        { id: '3', text: '잘 모르겠어요', icon: '❓' }
      ],
      stage: 'detail_1'
    },
    detail_2: {
      message: '점점 더 선명한 그림이 그려지네요. 한 가지만 더 여쭤볼게요.',
      choices: [
        { id: '1', text: '자세히 설명할게요', icon: '🎯' },
        { id: '2', text: '간단히 답할게요', icon: '💭' },
        { id: '3', text: '기억이 안 나요', icon: '❓' }
      ],
      stage: 'detail_2'
    },
    detail_3: {
      message: '마지막 질문이에요. 이제 시나리오를 쓸 준비가 거의 됐어요.',
      choices: [
        { id: '1', text: '정확히 답할게요', icon: '🎯' },
        { id: '2', text: '대충 답할게요', icon: '💭' },
        { id: '3', text: '패스할게요', icon: '❓' }
      ],
      stage: 'detail_3'
    },
    draft: {
      message: '당신의 이야기로 시나리오를 만들어봤어요. 어떤가요?',
      choices: [
        { id: '1', text: '완벽해요!', icon: '😍' },
        { id: '2', text: '조금 수정하고 싶어요', icon: '✏️' },
        { id: '3', text: '다시 써주세요', icon: '🔄' }
      ],
      stage: 'draft',
      scenario: draftScenario || '[시나리오 초안]'
    },
    feedback: {
      message: '피드백 감사합니다! 수정해봤어요. 이제 더 완성도 있는 시나리오가 되었네요.',
      choices: [
        { id: '1', text: '네! 정말 마음에 들어요', icon: '🎬' },
        { id: '2', text: '한 가지만 더 수정하면', icon: '🔧' },
        { id: '3', text: '완성된 것 같아요', icon: '✨' }
      ],
      stage: 'feedback',
      scenario: draftScenario || '[수정된 시나리오]'
    },
    final: {
      message: '완성됐어요! 당신은 이 영화의 주인공이에요.',
      choices: [
        { id: '1', text: '감사합니다!', icon: '🙏' },
        { id: '2', text: '다른 감독도 만나볼게요', icon: '🎭' },
        { id: '3', text: '정말 멋져요!', icon: '🎬' }
      ],
      stage: 'final',
      scenario: draftScenario || '[최종 시나리오]',
      casting: '당신에게 딱 맞는 역할을 찾았어요!'
    }
  }
  
  return fallbacks[stage]
}

/* ═══════════════ 9. 기존 함수 호환성 유지 ═══════════════ */

// 이제 위의 함수에서 배열과 객체 모두 처리함

// 기존 generateDirectorResponse 래퍼 (하위 호환성)
export async function generateDirectorResponseLegacy(
  director: DirectorType,
  scenario: [string, string, string, string],
  user: string,
  prev: Array<{ role: string; content: string }>
): Promise<DirectorResponse> {
  // 현재 단계 파악
  const messageCount = prev.filter(m => m.role === 'user').length
  let stage: ConversationStage = 'initial'
  
  if (messageCount <= 1) stage = 'detail_1'
  else if (messageCount === 2) stage = 'detail_2'
  else if (messageCount === 3) stage = 'detail_3'
  else if (messageCount === 4) stage = 'draft'
  else if (messageCount === 5) stage = 'feedback'
  else stage = 'final'
  
  // 컨텍스트 생성
  const emotionMap: EmotionType[] = ['joy', 'anger', 'sadness', 'pleasure']
  let selectedEmotion: EmotionType = 'joy'
  let originalStory = ''
  
  for (let i = 0; i < scenario.length; i++) {
    if (scenario[i] && scenario[i].trim()) {
      selectedEmotion = emotionMap[i]
      originalStory = scenario[i]
      break
    }
  }
  
  const context: ScenarioContext = {
    originalStory,
    emotion: selectedEmotion,
    collectedDetails: {},
    currentStage: stage,
    previousMessages: [...prev, { role: 'user', content: user }],
    draftScenario: undefined
  }
  
  // 이전 메시지에서 디테일 수집
  prev.forEach((msg, idx) => {
    if (msg.role === 'user' && idx > 0) {
      context.collectedDetails[`detail_${idx}`] = msg.content
    }
  })
  
  return generateDirectorResponse(director, context)
}

// chat/page.tsx에서 사용하는 getInitialGreeting
export function getInitialGreeting(director: DirectorType, scene?: string) {
  const greeting = `안녕하세요! ${directors[director].nameKo} 감독입니다. 
  당신의 이야기를 영화 시나리오로 만들어드리고 싶어요.`
  
  return {
    message: greeting,
    choices: [
      { id: '1', text: '네, 함께 만들어요!', icon: '🎬' },
      { id: '2', text: '어떻게 하는 거예요?', icon: '❓' },
      { id: '3', text: '기대돼요!', icon: '✨' }
    ],
    stage: 'initial' as ConversationStage
  }
}

// getFarewellMessage
export function getFarewellMessage(director: DirectorType) {
  const farewells: Record<DirectorType, string> = {
    bong: '우리가 함께 만든 시나리오, 계급을 넘는 걸작이 됐네요. 🎭',
    nolan: '시공간을 넘어 만든 우리의 이야기, 영원히 기억될 거예요. ⏳',
    miyazaki: '당신의 순수한 이야기가 마법 같은 시나리오가 됐어요. 🌸',
    curtis: '완벽한 해피엔딩! 당신의 이야기는 정말 사랑스러워요. ❤️',
    chazelle: '당신의 리듬으로 만든 시나리오, 정말 아름다워요. 🎵',
    docter: '모든 감정이 조화를 이룬 완벽한 이야기예요. 🌈'
  }
  
  return farewells[director]
}

// API 테스트
export async function testGeminiAPI() {
  try {
    if (!API_KEY) throw new Error('No API key')
    const model = createModel()
    const { response } = await model.generateContent('Say "OK" in JSON format')
    return { success: true, message: response.text() }
  } catch (e) {
    return { success: false, message: String(e) }
  }
}