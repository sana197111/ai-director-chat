// src/lib/gemini.ts - 완전한 버전

import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold
} from '@google/generative-ai'
import type { DirectorType, Choice } from '@/types'
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

/* ★ JSON 타입 응답 전용 모델 팩토리 */
function jsonModel(model = 'gemini-1.5-flash') { // 기본 모델로 변경
  return genAI.getGenerativeModel({
    model,
    safetySettings,
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.9,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json'
    }
  })
}

/* ─── JSON 파싱 보조 ─── */
function tryParseJSON(raw: string): any | null {
  try { return JSON.parse(raw) } catch { /* 못 읽음 */ }

  // "```json … ```" 형식 처리
  const match = raw.match(/\{[\s\S]*\}$/)
  if (match) {
    try { return JSON.parse(match[0]) } catch { /* noop */ }
  }
  return null
}

/* 최대 N번 요청 재시도 */
async function askWithRetry(
  model: ReturnType<typeof jsonModel>,
  prompt: string,
  maxTry = 3 // 3번으로 늘림
) {
  for (let i = 0; i < maxTry; i++) {
    try {
      const { response } = await model.generateContent(prompt)
      const text = response.text()
      
      console.log(`[Gemini] Raw response (attempt ${i + 1}):`, text.substring(0, 200))
      
      // 더 강력한 JSON 추출
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0])
        if (data.message && data.choices) {
          console.log('[Gemini] JSON parsed successfully')
          return data
        }
      }
    } catch (e) {
      console.error(`[Gemini] Attempt ${i + 1} failed:`, e)
      if (i === maxTry - 1) throw e
    }
  }
  throw new Error('JSON parse failed after ' + maxTry + ' attempts')
}

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

/* ═══════════════ 개선된 프롬프트 - 쉽고 실용적 ═══════════════ */

/* 더 쉽고 친근한 인사말 프롬프트 */
const greetingPrompt = (
  director: DirectorType,
  scenario: [string, string, string, string]
) => {
  const dir = directors[director]
  
  // 가장 감동적인 장면 하나만 선택
  const touchingScene = scenario[2] || scenario[3] || scenario[0]

  return `당신은 ${dir.nameKo} 감독입니다.
사용자 장면: "${touchingScene}"

5-7문장으로 따뜻하게 인사하세요. 쉬운 일상 언어를 사용하세요.

반드시 JSON으로만 응답:
{
  "message": "인사말 내용",
  "choices": [
    {"id": "1", "text": "질문1", "icon": "😊"},
    {"id": "2", "text": "질문2", "icon": "💭"},
    {"id": "3", "text": "질문3", "icon": "✨"}
  ]
}`
}

/* 더 실용적이고 공감가는 응답 프롬프트 */
const replyPrompt = (
  director: DirectorType,
  scenario: string[],
  history: string,
  user: string
) => {
  const dir = directors[director]
  
  // 대화 단계
  const turnCount = history.split('\n').length / 2
  const stage = turnCount < 3 ? 'early' : turnCount < 6 ? 'mid' : 'late'

  return `${dir.nameKo} 감독으로서 답변하세요.

사용자: "${user}"

2-4문장으로 답변하세요. 쉬운 일상 언어를 사용하세요. 실천 가능한 조언을 포함하세요.

반드시 JSON으로만 응답:
{
  "message": "답변 내용",
  "choices": [
    {"id": "1", "text": "추가 질문1", "icon": ""},
    {"id": "2", "text": "추가 질문2", "icon": ""},
    {"id": "3", "text": "추가 질문3", "icon": ""}
  ]
}`
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

// 영화 용어를 일상 언어로 변환
function simplifyMovieReference(text: string): string {
  const replacements = {
    '「기생충」': '계단을 오르내리는 영화',
    '「인셉션」': '꿈속의 꿈 이야기',
    '「토토로」': '숲의 정령 이야기',
    '「러브 액츄얼리」': '크리스마스 사랑 이야기',
    '「라라랜드」': '꿈과 사랑의 뮤지컬',
    '「인사이드 아웃」': '머릿속 감정들 이야기'
  }
  
  let simplified = text
  for (const [movie, simple] of Object.entries(replacements)) {
    simplified = simplified.replace(movie, simple)
  }
  
  return simplified
}

// 실용적 조언 생성
function generatePracticalTip(director: DirectorType, topic: string): string {
  const tips: Record<DirectorType, Record<string, string>> = {
    bong: {
      default: '오늘 지하철에서 사람들을 10초씩 관찰해보세요',
      가족: '가족과 함께 동네 산책하며 새로운 것 3개 발견하기',
      친구: '친구의 말투나 습관에서 새로운 면 찾아보기'
    },
    curtis: {
      default: '오늘 만나는 사람에게 진심 담은 칭찬 한마디 하기',
      사랑: '좋아하는 사람에게 이유 없이 간식 사주기',
      가족: '가족 단체 사진 찍고 액자에 넣어 선물하기'
    },
    miyazaki: {
      default: '점심시간에 5분만 하늘 구경하기',
      자연: '집에 작은 화분 하나 들여놓기',
      성장: '어릴 때 좋아했던 것 하나 다시 해보기'
    },
    nolan: {
      default: '하루를 거꾸로 일기 써보기',
      시간: '휴대폰 없이 30분 보내보기',
      기억: '오늘 있었던 일 3가지를 자세히 기록하기'
    },
    chazelle: {
      default: '좋아하는 노래 들으며 5분 자유롭게 움직이기',
      꿈: '꿈 일기장 만들어서 매일 한 줄씩 쓰기',
      열정: '포기했던 취미 다시 시작하기'
    },
    docter: {
      default: '오늘 느낀 감정 3개를 색으로 표현해보기',
      감정: '거울 보고 자신에게 위로의 말 해주기',
      가족: '가족 각자의 감정을 캐릭터로 그려보기'
    }
  }
  
  const directorTips = tips[director]
  return directorTips[topic] || directorTips.default
}

/* ═══════════════ 테스트 헬퍼 ═══════════════ */
export async function testGeminiAPI() {
  try {
    if (!API_KEY) throw new Error('no key')
    const { response } = await jsonModel().generateContent('Say "OK"')
    return { success: true, message: response.text() }
  } catch (e) {
    return { success: false, message: String(e) }
  }
}

/* ═══════════════ 개선된 메인 함수들 ═══════════════ */

export async function generateInitialGreeting(
  director: DirectorType,
  scenario: [string, string, string, string]
) {
  try {
    const startTime = Date.now()
    const data = await askWithRetry(
      jsonModel('gemini-1.5-flash'), // 기본 모델 사용
      greetingPrompt(director, scenario)
    )
    
    // 영화 용어를 쉽게 변환
    const simplifiedMessage = simplifyMovieReference(tidy(data.message)) // tidy 적용
    
    console.log(`[Gemini] Greeting in ${Date.now() - startTime}ms`)
    
    return {
      message: simplifiedMessage,
      choices: data.choices || easyDirectorQuestions[director].early
    }
  } catch (e) {
    console.warn('[Gemini] Using easy fallback')
    return {
      message: getEasyGreeting(director, scenario[0]),
      choices: easyDirectorQuestions[director].early
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
  
  // 간단한 대화 맥락만
  const history = prev.slice(-4).map(m =>
    `${m.role === 'user' ? '나' : dir.nameKo}: ${m.content.slice(0, 50)}...`
  ).join('\n')

  try {
    const startTime = Date.now()
    const data = await askWithRetry(
      jsonModel('gemini-1.5-flash'), // 기본 모델 사용
      replyPrompt(director, scenario, history, user)
    )
    
    // 응답 단순화
    const simplifiedMessage = simplifyMovieReference(tidy(data.message)) // tidy 적용
    
    console.log(`[Gemini] Response in ${Date.now() - startTime}ms`)
    
    return {
      message: simplifiedMessage,
      choices: data.choices || easyDirectorQuestions[director][stage]
    }
  } catch (e) {
    return {
      message: getEasyFallback(director, user),
      choices: easyDirectorQuestions[director][stage],
      error: String(e)
    }
  }
}

/* ═══════════════ 쉬운 폴백 응답들 ═══════════════ */

function getEasyGreeting(director: DirectorType, scene?: string): string {
  const greetings: Record<DirectorType, string> = {
    bong: `안녕하세요! ${scene ? `"${scene}" - 정말 ` : ''}인생이란 계단을 함께 오르내려볼까요? 🎭`,
    curtis: `만나서 반가워요! ${scene ? `"${scene}" - ` : ''}모든 순간이 러브스토리가 될 수 있어요. 💕`,
    miyazaki: `어서오세요! ${scene ? `"${scene}" - ` : ''}일상 속 작은 마법을 찾아볼까요? 🌸`,
    nolan: `흥미롭네요. ${scene ? `"${scene}" - ` : ''}시간이란 퍼즐을 함께 맞춰볼까요? 🌀`,
    chazelle: `안녕하세요! ${scene ? `"${scene}" - ` : ''}인생의 리듬을 함께 찾아가요. 🎷`,
    docter: `반가워요! ${scene ? `"${scene}" - ` : ''}모든 감정이 소중한 이유를 알아볼까요? 🌈`
  }
  
  return greetings[director]
}

// chat/page.tsx에서 사용하는 getInitialGreeting 함수 export
export function getInitialGreeting(director: DirectorType, scene?: string) {
  return {
    message: getEasyGreeting(director, scene),
    choices: easyDirectorQuestions[director].early
  }
}

function getEasyFallback(director: DirectorType, userMsg: string): string {
  // 키워드 감지
  const topic = detectSimpleTopic(userMsg)
  const tip = generatePracticalTip(director, topic)
  
  const responses: Record<DirectorType, string> = {
    bong: `그 이야기 속에서 새로운 각도를 발견했어요. ${tip} 🎭`,
    curtis: `정말 따뜻한 이야기네요. ${tip} 💕`,
    miyazaki: `마법 같은 순간이네요. ${tip} 🌸`,
    nolan: `시간의 의미를 다시 생각하게 하네요. ${tip} 🌀`,
    chazelle: `삶의 리듬이 느껴져요. ${tip} 🎷`,
    docter: `모든 감정이 다 의미가 있네요. ${tip} 🌈`
  }
  
  return responses[director]
}

function detectSimpleTopic(text: string): string {
  const topics = ['가족', '친구', '사랑', '시간', '꿈', '자연', '감정', '성장', '열정']
  
  for (const topic of topics) {
    if (text.includes(topic)) return topic
  }
  
  return 'default'
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
function generateFallbackResponse(director: DirectorType, msg: string) {
  return getEasyFallback(director, msg)
}