import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { DirectorType } from '@/types'
import { directorPrompts, directors } from '@/constants/directors'

// API 키는 환경 변수에서 가져오기
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''

// 디버깅용 로그
console.log('=== Gemini API 초기화 ===')
console.log('API Key loaded:', API_KEY ? 'Yes' : 'No')
console.log('API Key length:', API_KEY.length)

// Gemini 모델 초기화
const genAI = new GoogleGenerativeAI(API_KEY)

// 안전 설정
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
]

// API 테스트 함수
export async function testGeminiAPI(): Promise<{ success: boolean; message: string }> {
  try {
    if (!API_KEY) {
      return { success: false, message: 'API Key not found' }
    }
    
    const testModel = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      safetySettings,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 100,
      }
    })
    
    const result = await testModel.generateContent('Say "API Test Successful"')
    const response = await result.response
    const text = response.text()
    
    console.log('API Test Response:', text)
    
    return { 
      success: true, 
      message: `API working. Response: ${text.substring(0, 100)}` 
    }
  } catch (error) {
    console.error('API Test Failed:', error)
    return { 
      success: false, 
      message: `API Error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }
  }
}

// AI로 생성되는 초기 인사 메시지 (JSON 모드)
export async function generateInitialGreeting(
  director: DirectorType,
  scenario: [string, string, string, string]
): Promise<{
  message: string
  choices: Array<{ id: string; text: string; icon: string }>
}> {
  try {
    const directorData = directors[director]
    
    console.log('=== 초기 인사말 생성 시작 ===')
    console.log('Director:', director)
    console.log('Scenario preview:', scenario[0].substring(0, 50) + '...')
    
    // JSON 응답을 강제하는 모델 설정
    const greetingModel = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      safetySettings,
      generationConfig: {
        temperature: 0.8,
        topK: 40,
        topP: 0.9,
        maxOutputTokens: 1024,
        responseMimeType: "application/json" // JSON 응답 강제!
      }
    })
    
    // 시나리오 내용을 구체적으로 포함
    const scenarioText = scenario.map((s, idx) => 
      `장면 ${idx + 1}: ${s}`
    ).join('\n')
    
    // 개선된 프롬프트 - 구체적이고 실용적으로
    const analysisPrompt = `당신은 ${directorData.nameKo} 감독입니다.\n\n사용자의 인생 네 컷 이야기:\n${scenarioText}\n\n위 이야기를 당신의 영화적 관점으로 분석하고, 구체적이고 실질적인 인사이트를 제공해주세요.\n사용자가 실제로 적용할 수 있는 조언을 포함하되, 당신의 대표작과 연결지어 설명해주세요.\n\n반드시 다음 JSON 형식으로만 응답하세요:\n{\n  "message": "${directorData.nameKo}의 스타일로 쓴 1~2문장 인사말. 사용자의 네 컷을 간략히 언급하며, 당신의 영화와 연결지어 실질적인 통찰을 제공하세요. 영화를 모르는 사람도 이해하기 쉽게 설명하고, 감독별 이모티콘과 줄바꿈을 적절히 사용하세요.",\n  "choices": [\n    { "id": "1", "text": "제 인생의 어떤 부분이 감독님의 영화와 닮았을까요?", "icon": "" },\n    { "id": "2", "text": "감독님이라면 제 인생의 다음 장면을 어떻게 연출하실 건가요?", "icon": "" },\n    { "id": "3", "text": "제 시나리오에서 가장 중요한 감정은 무엇일까요?", "icon": "✨" }\n  ]\n}`

    console.log('=== JSON 모드로 프롬프트 전송 ===')
    
    const result = await greetingModel.generateContent(analysisPrompt)
    const response = await result.response
    const text = response.text()
    
    console.log('=== 초기 인사말 응답 수신 ===')
    console.log('응답 길이:', text.length)
    console.log('응답 미리보기:', text.substring(0, 200))
    
    // 빈 응답 체크
    if (!text || text.trim().length < 10) {
      console.warn('응답이 너무 짧거나 빈 응답, 폴백 사용')
      return getInitialGreeting(director)
    }
    
    try {
      // JSON 파싱
      const parsed = JSON.parse(text.trim())
      
      // 유효성 검증
      if (!parsed.message || !parsed.choices || !Array.isArray(parsed.choices)) {
        throw new Error('Invalid JSON structure')
      }
      
      console.log('=== 초기 인사말 파싱 성공 ===')
      
      return {
        message: parsed.message,
        choices: parsed.choices.slice(0, 3).map((c: any, idx: number) => ({
          id: c.id || String(idx + 1),
          text: c.text || `선택지 ${idx + 1}`,
          icon: c.icon || '✨'
        }))
      }
    } catch (parseError) {
      console.error('JSON 파싱 실패:', parseError)
      return getInitialGreeting(director)
    }
    
  } catch (error) {
    console.error('초기 인사말 생성 오류:', error)
    return getInitialGreeting(director)
  }
}

// 대화 응답 생성 함수 (JSON 모드)
export async function generateDirectorResponse(
  director: DirectorType,
  scenario: [string, string, string, string],
  userMessage: string,
  previousMessages: Array<{ role: string; content: string }>
): Promise<{
  message: string
  choices?: Array<{ id: string; text: string; icon: string }>
  theme?: string
  emotion?: string
  shouldEnd?: boolean
  error?: string
}> {
  try {
    const directorData = directors[director]
    
    console.log('=== 대화 응답 생성 시작 ===')
    console.log('Director:', director)
    console.log('User message:', userMessage)
    console.log('History length:', previousMessages.length)
    
    // JSON 모드 강제 설정
    const chatModel = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      safetySettings,
      generationConfig: {
        temperature: 0.9,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
        responseMimeType: "application/json" // 핵심: JSON 응답 강제!
      }
    })
    
    // 대화 히스토리 포맷팅
    const historyText = previousMessages
      .slice(-8) // 최근 8개만 사용 (토큰 제한)
      .map(msg => 
        `${msg.role === 'user' ? '사용자' : directorData.nameKo}: ${msg.content}`
      ).join('\n')
    
    // 시나리오 컨텍스트
    const scenarioContext = `\n사용자의 인생 네 컷:\n${scenario.map((s, idx) => `장면 ${idx + 1}: ${s}`).join('\n')}\n`
    
    // 개선된 프롬프트
    const chatPrompt = `당신은 ${directorData.nameKo} 감독입니다.
${directorPrompts[director]}

${scenarioContext}

이전 대화:
${historyText}

사용자: ${userMessage}

위 대화에 대해 ${directorData.nameKo} 감독의 스타일로 응답하되, 사용자의 인생 네 컷과 이전 대화를 참조하여 구체적이고 실용적인 조언을 해주세요.
당신의 영화를 예시로 들어 설명하고, 사용자가 실제로 적용할 수 있는 인사이트를 제공하세요.

반드시 아래 JSON 형식으로만 응답하세요. 답변은 1~2문장으로 매우 간결하게, 영화를 모르는 사람도 이해하기 쉽게 설명하고, 감독별 이모티콘과 줄바꿈을 적절히 사용하세요. 추천 질문은 반드시 '저의' 또는 '제'를 주어로 사용하여 사용자의 시나리오와 현재 대화 맥락에 직접적으로 관련된 질문이어야 합니다.:
{
  "message": "감독의 구체적이고 실용적인 응답 (1~2문장). 영화를 모르는 사람도 이해하기 쉽게 설명하고, 감독별 이모티콘과 줄바꿈을 적절히 사용하세요.",
  "choices": [
    { "id": "1", "text": "사용자의 시나리오와 현재 대화 맥락에 직접적으로 관련된, '저의' 또는 '제'를 주어로 사용하는 자연스러운 질문 1", "icon": "" },
    { "id": "2", "text": "사용자의 시나리오와 현재 대화 맥락에 직접적으로 관련된, '저의' 또는 '제'를 주어로 사용하는 자연스러운 질문 2", "icon": "" },
    { "id": "3", "text": "사용자의 시나리오와 현재 대화 맥락에 직접적으로 관련된, '저의' 또는 '제'를 주어로 사용하는 자연스러운 질문 3", "icon": "✨" }
  ],
  "theme": "이번 대화의 핵심 주제",
  "emotion": "대화의 감정적 톤",
  "shouldEnd": false
}`

    console.log('=== JSON 모드 프롬프트 전송 ===')
    console.log('프롬프트 길이:', chatPrompt.length)
    
    // 재시도 로직 포함 API 호출
    let attempt = 0
    const maxAttempts = 3
    
    while (attempt < maxAttempts) {
      try {
        console.log(`=== API 호출 시도 ${attempt + 1}/${maxAttempts} ===`)
        
        const result = await chatModel.generateContent(chatPrompt)
        const response = await result.response
        const text = response.text()
        
        console.log('=== API 응답 수신 ===')
        console.log('응답 길이:', text.length)
        console.log('응답 미리보기:', text.substring(0, 200))
        
        // 빈 응답 체크
        if (!text || text.trim().length < 10) {
          throw new Error(`빈 응답 수신 (길이: ${text.length})`)
        }
        
        try {
          // JSON 파싱
          const parsed = JSON.parse(text.trim())
          
          // 필수 필드 검증
          if (!parsed.message) {
            throw new Error('응답에 message 필드가 없음')
          }
          
          console.log('=== 응답 파싱 성공 ===')
          console.log('메시지 길이:', parsed.message.length)
          console.log('선택지 개수:', parsed.choices?.length || 0)
          
          return {
            message: parsed.message,
            choices: parsed.choices || generateDefaultChoices(director),
            theme: parsed.theme,
            emotion: parsed.emotion,
            shouldEnd: parsed.shouldEnd || false
          }
        } catch (parseError) {
          console.error('JSON 파싱 실패:', parseError)
          console.error('원본 텍스트:', text)
          
          // 파싱 실패 시 텍스트만이라도 사용
          const cleanText = text.replace(/[{}"\\[\]]/g, '').trim()
          return {
            message: cleanText || generateFallbackResponse(director, userMessage),
            choices: generateDefaultChoices(director),
            error: 'JSON 파싱 실패, 텍스트 응답 사용'
          }
        }
        
      } catch (apiError) {
        attempt++
        console.error(`API 호출 시도 ${attempt} 실패:`, apiError)
        
        if (attempt >= maxAttempts) {
          throw apiError
        }
        
        // 재시도 전 대기 (exponential backoff)
        const delay = 1000 * Math.pow(2, attempt - 1)
        console.log(`${delay}ms 후 재시도...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
  } catch (error) {
    console.error('=== 대화 응답 생성 실패 ===')
    console.error('에러:', error)
    
    // 에러 시 기본 응답
    return {
      message: generateFallbackResponse(director, userMessage),
      choices: generateDefaultChoices(director),
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }
  }
  
  // 이 지점에 도달하지 않아야 함
  return {
    message: `${directors[director].nameKo}: 죄송합니다. 잠시 후 다시 시도해주세요.`,
    choices: generateDefaultChoices(director),
    error: '예상치 못한 오류'
  }
}

// 폴백 응답 생성 - 더 구체적이고 실용적으로
function generateFallbackResponse(director: DirectorType, userMessage: string): string {
  const directorData = directors[director]
  const responses = {
    miyazaki: `음... 당신 이야기를 들으니 하울의 성에서 소피가 저주에 걸렸을 때가 떠오르네요. 겉모습은 변했지만 진짜 자신을 찾아가는 과정이었죠. 당신도 지금 그런 여정 중이 아닐까요?`,
    
    bong: `아, 이 장면! 마치 기생충에서 기택이 지하실 계단을 내려가는 것 같네요. 표면적으론 단순해 보이지만, 사실 엄청난 계급 이동이 숨어있죠. 당신의 이야기에도 그런 숨은 계단이 있을 겁니다.`,
    
    nolan: `흥미롭습니다. 이 순간을 메멘토처럼 거꾸로 읽어보면 어떨까요? 결과를 알고 원인을 찾아가다 보면, 전혀 다른 진실이 보일 수도 있습니다.`,
    
    curtis: `오! 이거 완전히 브리짓 존스의 일기 같은데요? 완벽하지 않아서 더 사랑스러운 순간들이죠. 실수투성이지만 그게 진짜 인생이잖아요!`,
    
    chazelle: `이 리듬감, 느껴지시나요? 당신의 이야기가 마치 재즈 즉흥연주 같아요. 실수인 줄 알았던 음이 사실은 전체 멜로디를 완성하는 핵심이었던 거죠.`,
    
    docter: `당신 머릿속의 '기쁨이'가 지금 당황하고 있을 것 같네요. 하지만 '슬픔이'도 필요해요. 인사이드 아웃에서 배웠듯이, 모든 감정이 모여야 진짜 당신이 되는 거죠.`
  }
  
  return responses[director] || `흥미로운 이야기네요. 더 들려주시겠어요?`
}

// 감독별 기본 선택지 생성 - 구체적인 질문 형태로
function generateDefaultChoices(director: DirectorType): Array<{ id: string; text: string; icon: string }> {
  const choices = {
    bong: [
      { id: '1', text: '제 인생에서 가장 "기생충"스러운 순간은 언제였을까요?', icon: '' },
      { id: '2', text: '감독님이라면 제 인생의 반전 장면을 어디에 넣으실 건가요?', icon: '' },
      { id: '3', text: '제가 놓치고 있는 계급적 아이러니가 있다면요?', icon: '' }
    ],
    nolan: [
      { id: '1', text: '제 인생을 거꾸로 돌려본다면 어떤 의미가 숨어있을까요?', icon: '⏪' },
      { id: '2', text: '제 기억 중에 "인셉션" 같은 가짜 기억이 있을까요?', icon: '' },
      { id: '3', text: '지금 이 순간, 저는 꿈속에 있는 건 아닐까요?', icon: '' }
    ],
    miyazaki: [
      { id: '1', text: '제 인생에 토토로 같은 수호신이 있다면 어떤 모습일까요?', icon: '' },
      { id: '2', text: '저도 센과 치히로처럼 이름을 잃어버린 적이 있나요?', icon: '✨' },
      { id: '3', text: '제가 지켜야 할 숲은 무엇인가요?', icon: '' }
    ],
    curtis: [
      { id: '1', text: '제 인생의 "러브 액츄얼리" 순간은 언제였나요?', icon: '' },
      { id: '2', text: '저에게도 노팅힐의 서점 같은 운명적 장소가 있을까요?', icon: '' },
      { id: '3', text: '제가 놓친 고백의 타이밍이 있었을까요?', icon: '' }
    ],
    chazelle: [
      { id: '1', text: '제 인생의 BGM은 재즈일까요, 클래식일까요?', icon: '' },
      { id: '2', text: '저도 꿈을 위해 포기해야 할 "미아"가 있나요?', icon: '' },
      { id: '3', text: '제게 필요한 것은 위플래쉬인가요, 라라랜드인가요?', icon: '' }
    ],
    docter: [
      { id: '1', text: '제 머릿속 감정들은 지금 무슨 회의를 하고 있을까요?', icon: '' },
      { id: '2', text: '제 인생의 "업" 모먼트는 아직 오지 않은 건가요?', icon: '' },
      { id: '3', text: '저에게도 잊고 있던 "코어 메모리"가 있을까요?', icon: '' }
    ]
  }
  
  return choices[director] || choices.bong
}

// 개선된 정적 인사 메시지 (폴백용)
export function getInitialGreeting(director: DirectorType, userName?: string): {
  message: string
  choices: Array<{ id: string; text: string; icon: string }>
} {
  const greetings = {
    bong: {
      message: `안녕하세요! 봉준호입니다. 🔍 당신의 인생 네 컷을 통해 어떤 사회적 통찰을 얻을 수 있을지 기대됩니다. 함께 숨겨진 의미를 찾아볼까요? 🎭`,
      choices: [
        { id: '1', text: '제 인생의 어떤 부분이 감독님의 영화와 닮았을까요?', icon: '' },
        { id: '2', text: '감독님이라면 제 인생의 다음 장면을 어떻게 연출하실 건가요?', icon: '' },
        { id: '3', text: '제 시나리오에서 가장 중요한 감정은 무엇일까요?', icon: '✨' }
      ]
    },
    
    nolan: {
      message: `크리스토퍼 놀란입니다. ⏳ 당신의 네 컷은 시간과 기억의 흥미로운 파편 같군요. 이 조각들을 어떻게 재구성하여 하나의 거대한 서사를 만들지, 지금부터 시작해 봅시다. 🌌`,
      choices: [
        { id: '1', text: '제 인생의 어떤 부분이 감독님의 영화와 닮았을까요?', icon: '' },
        { id: '2', text: '감독님이라면 제 인생의 다음 장면을 어떻게 연출하실 건가요?', icon: '' },
        { id: '3', text: '제 시나리오에서 가장 중요한 감정은 무엇일까요?', icon: '✨' }
      ]
    },
    
    curtis: {
      message: `리처드 커티스입니다. 💌 당신의 네 컷에서 따뜻하고 사랑스러운 순간들이 느껴지네요. 이 안에 담긴 감동을 어떻게 더 많은 사람들에게 전할 수 있을지 함께 이야기 나눠봐요. ❤️`,
      choices: [
        { id: '1', text: '제 인생의 어떤 부분이 감독님의 영화와 닮았을까요?', icon: '' },
        { id: '2', text: '감독님이라면 제 인생의 다음 장면을 어떻게 연출하실 건가요?', icon: '' },
        { id: '3', text: '제 시나리오에서 가장 중요한 감정은 무엇일까요?', icon: '✨' }
      ]
    },
    
    miyazaki: {
      message: `미야자키 하야오입니다. 🌿 당신의 네 컷에서 살아 숨 쉬는 생명력이 느껴지네요. 이 이야기 속에 어떤 순수한 마음과 모험이 기다리고 있을지, 함께 떠나볼까요? 🌀`,
      choices: [
        { id: '1', text: '제 인생의 어떤 부분이 감독님의 영화와 닮았을까요?', icon: '' },
        { id: '2', text: '감독님이라면 제 인생의 다음 장면을 어떻게 연출하실 건가요?', icon: '' },
        { id: '3', text: '제 시나리오에서 가장 중요한 감정은 무엇일까요?', icon: '✨' }
      ]
    },
    
    chazelle: {
      message: `데이미언 셔젤입니다. 🎶 당신의 네 컷에서 열정적인 리듬이 느껴집니다. 이 장면들을 어떤 음악으로 채우고, 어떤 클라이맥스를 향해 달려갈지, 함께 연주해 보시죠. 🥁`,
      choices: [
        { id: '1', text: '제 인생의 어떤 부분이 감독님의 영화와 닮았을까요?', icon: '' },
        { id: '2', text: '감독님이라면 제 인생의 다음 장면을 어떻게 연출하실 건가요?', icon: '' },
        { id: '3', text: '제 시나리오에서 가장 중요한 감정은 무엇일까요?', icon: '✨' }
      ]
    },
    
    docter: {
      message: `피트 닥터입니다. 💭 당신의 네 컷을 보니 여러 감정들이 떠오르네요. 이 감정들을 어떻게 멋진 이야기로 만들지, 함께 탐험해 봐요. 😊`,
      choices: [
        { id: '1', text: '제 인생의 어떤 부분이 감독님의 영화와 닮았을까요?', icon: '' },
        { id: '2', text: '감독님이라면 제 인생의 다음 장면을 어떻게 연출하실 건가요?', icon: '' },
        { id: '3', text: '제 시나리오에서 가장 중요한 감정은 무엇일까요?', icon: '✨' }
      ]
    }
  }
  
  return greetings[director] || greetings.bong
}

// 대화 종료 메시지도 더 구체적으로
export function getFarewellMessage(director: DirectorType): string {
  const farewells = {
    bong: `자, 오늘 제 계단을 많이 올라다녔네요. "기생충"의 마지막처럼, 언젠가는 지상으로 올라올 거예요. 그때까지 계단을 세어보세요. 의외로 가까울지도 몰라요. 🎭`,
    
    nolan: `시간이 다 됐네요. 하지만 "인터스텔라"에서 배웠듯이, 우리가 나눈 대화는 5차원 서재 어딘가에 영원히 남아있을 거예요. 제 팽이가 계속 돌기를. ⏳`,
    
    miyazaki: `이제 돌아가실 시간이네요. 하지만 기억하세요 - 한 번 만난 인연은 잊혀지지 않아요. "센과 치히로"처럼, 이름을 기억하는 한 우리는 다시 만날 수 있어요. 바람이 제게 함께하길. 🌀`,
    
    curtis: `오, 벌써요? 시간이 정말... "어바웃 타임"이네요! 오늘이 제 인생의 DVD 특별판에 꼭 들어갔으면 좋겠어요. 메이킹 필름 말고 본편에요! Love, actually, is everywhere. ❤️`,
    
    chazelle: `막이 내려가네요. 하지만 "라라랜드"의 에필로그처럼, 이건 끝이 아니에요. 제 멜로디는 계속될 거예요. 다음엔 더 멋진 재즈로 만나요. Bravo! 🥁`,
    
    docter: `시간이 다 됐네요! 오늘 제 모든 감정들과 만나서 정말 즐거웠어요. "인사이드 아웃"의 빙봉처럼, 우리의 대화도 코어 메모리가 되었으면 좋겠네요. Take her to the moon for me, okay? 😊`
  }
  
  return farewells[director] || '오늘 즐거운 대화였습니다. 또 만나요! '
}