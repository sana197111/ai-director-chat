// lib/gemini.ts
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold
} from '@google/generative-ai'
import { DirectorType } from '@/types'
import {
  directorPrompts,
  directors,
  defaultDirectorQuestions
} from '@/constants/directors'

/* ─────────────────────────── 기본 초기화 ────────────────────────── */
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
console.log('[Gemini] API init – key loaded:', !!API_KEY)
const genAI = new GoogleGenerativeAI(API_KEY)

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
]

/* 공통 util – JSON 짧은 모델 팩토리 */
function jsonModel(model = 'gemini-1.5-flash') {
  return genAI.getGenerativeModel({
    model,
    safetySettings,
    generationConfig: {
      temperature: 0.85,
      topK: 40,
      topP: 0.9,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json'
    }
  })
}

/* 한 줄만 남기기 도우미 */
const firstLines = (txt: string, n = 10) =>
  txt.split('\n').slice(0, n).join('\n').trim()

/* ─────────────────────── API 테스트용 헬퍼 ─────────────────────── */
export async function testGeminiAPI(): Promise<{ success: boolean; message: string }> {
  try {
    if (!API_KEY) return { success: false, message: 'API Key not found' }
    const mdl = jsonModel()
    const { response } = await mdl.generateContent('Say "API Test OK"')
    return { success: true, message: firstLines(response.text()) }
  } catch (e) {
    return { success: false, message: String(e) }
  }
}

/* ─────────────────────── 초기 인사 (5~10줄) ────────────────────── */
export async function generateInitialGreeting(
  director: DirectorType,
  scenario: [string, string, string, string]
): Promise<{ message: string; choices: Choice[] }> {

  const dir = directors[director]
  const model = jsonModel('gemini-2.5-flash')

  const prompt = `
<<ROLE>>
${directorPrompts[director]}
<<CONTEXT>>
사용자의 인생 네 컷:
${scenario.map((s,i)=>`장면 ${i+1}: ${s}`).join('\n')}
<<TASK>>
- 감독 스타일로 5~10줄(문장) 인사
- 한 작품(예:${dir.films[0]})만 언급
- 줄바꿈·이모티콘 포함
- 사용자가 “당신을 알아가는 과정”의 중요성 언급
- JSON 형식:
{
  "message": "...",
  "choices": [ { "id": "1", "text": "...", "icon": "" }, ... 최대3 ]
}`.trim()

  try {
    const { response } = await model.generateContent(prompt)
    const txt = response.text().trim()
    const parsed = JSON.parse(txt)
    if (parsed?.message) {
      return {
        message: firstLines(parsed.message, 10),
        choices: (parsed.choices ?? defaultDirectorQuestions[director]).slice(0, 3)
      }
    }
    throw new Error('Invalid JSON')
  } catch (e) {
    console.warn('[Gemini] Greeting fallback:', e)
    return getInitialGreeting(director, scenario[0])
  }
}

/* ─────────────────────── 메인 답변 생성 ─────────────────────── */
export async function generateDirectorResponse(
  director: DirectorType,
  scenario: [string, string, string, string],
  userMessage: string,
  previous: Array<{ role: string; content: string }>
): Promise<{
  message: string
  choices?: Choice[]
  theme?: string
  emotion?: string
  shouldEnd?: boolean
  error?: string
}> {

  const dir = directors[director]
  const model = jsonModel('gemini-1.5-flash')

  const history = previous
    .slice(-8)
    .map(m => `${m.role === 'user' ? '사용자' : dir.nameKo}: ${m.content}`)
    .join('\n')

  const prompt = `
<<ROLE>>
${directorPrompts[director]}
<<CONTEXT>>
사용자 네 컷: ${scenario.join(' / ')}
이전 대화:
${history}
<<USER>>
${userMessage}
<<TASK>>
JSON ONLY:
{
  "message":"1~2문장, 한 영화 인용, 이모티콘·줄바꿈",
  "choices":[…재미+진지 최대3…],
  "theme":"...",
  "emotion":"...",
  "shouldEnd":false
}`.trim()

  try {
    const { response } = await model.generateContent(prompt)
    const parsed = JSON.parse(response.text())
    if (!parsed.message) throw new Error('no message')
    return {
      message: firstLines(parsed.message, 4),
      choices: parsed.choices ?? defaultDirectorQuestions[director],
      theme: parsed.theme,
      emotion: parsed.emotion,
      shouldEnd: parsed.shouldEnd
    }
  } catch (e) {
    return {
      message: generateFallbackResponse(director, userMessage),
      choices: defaultDirectorQuestions[director],
      error: String(e)
    }
  }
}

/* ─────────────────────── Fallbacks & Helpers ─────────────────── */
export function getInitialGreeting(
  director: DirectorType,
  firstScene?: string
): { message: string; choices: Choice[] } {
  const d = directors[director]
  const emoji = directorPrompts[director].match(/.$/)?.[0] ?? ''
  const msg = [
    `${d.nameKo}입니다. ${firstScene ? `“${firstScene}” 장면이 특히 인상적이네요.` : ''}`,
    '당신 이야기를 영화 한 편처럼 풀어가는 데 함께하겠습니다.',
    '서로를 알아가는 여정, 기대해 주세요 ' + emoji
  ].join('\n')
  return { message: msg, choices: defaultDirectorQuestions[director] }
}

function generateFallbackResponse(director: DirectorType, userMsg: string) {
  const d = directors[director]
  const film = d.films[0]
  const emoji = directorPrompts[director].match(/.$/)?.[0] ?? ''
  return `지금 이야기는 「${film}」의 한 장면을 떠올리게 합니다.\n` +
         `당신을 더 알수록 이 순간을 깊게 다룰 수 있겠네요 ${emoji}`
}

/* ─────────────────────── 대화 종료 인사 ─────────────────────── */
export function getFarewellMessage(director: DirectorType): string {
  const msgs = {
    bong:  `자, 오늘 제 계단을 많이 올라다녔네요. "기생충"의 마지막처럼… 🎭`,
    nolan: `시간이 다 됐네요. 하지만 "인터스텔라"에서 배웠듯이… ⏳`,
    miyazaki:`이제 돌아가실 시간이네요. "센과 치히로"처럼… 🌀`,
    curtis:`오, 벌써요? 시간이 정말... "어바웃 타임"이네요! ❤️`,
    chazelle:`막이 내려가네요. 하지만 "라라랜드"의 에필로그처럼… 🥁`,
    docter:`시간이 다 됐네요! 오늘 제 모든 감정들과 만나서… 😊`
  } as Record<string,string>
  return msgs[director] ?? '오늘 즐거운 대화였습니다. 또 만나요!'
}

/* 내부 타입 */
type Choice = { id: string; text: string; icon: string }
