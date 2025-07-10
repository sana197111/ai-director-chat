import type { Director } from '@/types'

export const directors: Record<string, Director> = {
  bong: {
    id: 'bong',
    name: 'Bong Joon-ho',
    nameKo: '봉준호',
    title: '사회의 단면을 포착하는 감독',
    description: '날카로운 사회적 시선과 블랙 유머로 계급과 인간성을 탐구합니다',
    films: ['기생충', '미키17', '설국열차', '살인의 추억'],
    quote: '장르는 정치다. 모든 영화는 정치적이다.',
    avatar: '/images/directors/bong.jpg',
    themeColor: '#2C3E50',
    bgGradient: 'linear-gradient(135deg, #2C3E50 0%, #3498DB 100%)',
    ost: '기생충 OST',
    filmMessages: [
      {
        title: 'Parasite',
        titleKo: '기생충',
        coreMessage: '계급 간의 벽과 공존의 불가능성',
        themes: ['사회적 계층', '경제적 불평등', '가족의 생존', '현실의 모순']
      },
      {
        title: 'Memories of Murder',
        titleKo: '살인의 추억',
        coreMessage: '진실을 찾는 과정에서 드러나는 인간의 한계',
        themes: ['진실과 거짓', '권력의 무능', '일상의 폭력', '기억의 불완전성']
      }
    ]
  },
  nolan: {
    id: 'nolan',
    name: 'Christopher Nolan',
    nameKo: '크리스토퍼 놀란',
    title: '시간과 현실을 뒤트는 감독',
    description: '복잡한 서사 구조와 시간의 층위로 관객의 인식에 도전합니다',
    films: ['인셉션', '인터스텔라', '덩케르크', '테넷'],
    quote: '시간은 우리가 가진 가장 귀중한 자원이다.',
    avatar: '/images/directors/nolan.jpg',
    themeColor: '#1A237E',
    bgGradient: 'linear-gradient(135deg, #1A237E 0%, #3949AB 100%)',
    ost: '인터스텔라 OST',
    filmMessages: [
      {
        title: 'Inception',
        titleKo: '인셉션',
        coreMessage: '현실과 꿈의 경계에서 찾는 진실',
        themes: ['의식과 무의식', '기억의 조작', '현실 인식', '시간의 상대성']
      },
      {
        title: 'Interstellar',
        titleKo: '인터스텔라',
        coreMessage: '사랑과 과학이 만나는 시공간을 초월한 연결',
        themes: ['부모와 자식', '시간의 흐름', '희생과 헌신', '인류의 미래']
      }
    ]
  },
  miyazaki: {
    id: 'miyazaki',
    name: 'Hayao Miyazaki',
    nameKo: '미야자키 하야오',
    title: '마법과 순수를 그리는 감독',
    description: '자연과 인간, 성장과 모험을 아름답게 그려내는 애니메이션의 거장',
    films: ['센과 치히로의 행방불명', '하울의 움직이는 성', '이웃집 토토로', '모노노케 히메'],
    quote: '중요한 것은 눈에 보이지 않는다.',
    avatar: '/images/directors/miyazaki.jpg',
    themeColor: '#2E7D32',
    bgGradient: 'linear-gradient(135deg, #2E7D32 0%, #66BB6A 100%)',
    ost: '하울의 움직이는 성 OST',
    filmMessages: [
      {
        title: 'Spirited Away',
        titleKo: '센과 치히로의 행방불명',
        coreMessage: '순수한 마음으로 극복하는 성장의 여정',
        themes: ['성장과 변화', '자연과 공존', '순수함의 힘', '정체성 찾기']
      },
      {
        title: 'My Neighbor Totoro',
        titleKo: '이웃집 토토로',
        coreMessage: '자연과 함께하는 치유와 희망',
        themes: ['가족의 사랑', '자연의 신비', '상상력', '순수한 시선']
      }
    ]
  },
  curtis: {
    id: 'curtis',
    name: 'Richard Curtis',
    nameKo: '리처드 커티스',
    title: '사랑과 웃음의 연금술사',
    description: '따뜻한 유머와 진솔한 감정으로 로맨틱 코미디의 정수를 보여줍니다',
    films: ['러브 액츄얼리', '노팅 힐', '어바웃 타임', '포 웨딩즈'],
    quote: '사랑은 실제로 우리 주변 어디에나 있다.',
    avatar: '/images/directors/curtis.jpg',
    themeColor: '#C2185B',
    bgGradient: 'linear-gradient(135deg, #C2185B 0%, #E91E63 100%)',
    ost: '어바웃 타임 OST',
    filmMessages: [
      {
        title: 'About Time',
        titleKo: '어바웃 타임',
        coreMessage: '일상의 소중함과 시간의 가치',
        themes: ['가족의 사랑', '시간의 소중함', '일상의 행복', '진정한 사랑']
      },
      {
        title: 'Love Actually',
        titleKo: '러브 액츄얼리',
        coreMessage: '사랑의 다양한 모습과 연결의 힘',
        themes: ['사랑의 다양성', '인간관계', '희망과 용기', '연결과 소통']
      }
    ]
  },
  chazelle: {
    id: 'chazelle',
    name: 'Damien Chazelle',
    nameKo: '데이미언 셔젤',
    title: '음악과 꿈의 연출가',
    description: '음악과 영화의 경계를 허물며 열정과 좌절, 꿈과 현실을 그려냅니다',
    films: ['라라랜드', '위플래쉬', '바빌론', '퍼스트 맨'],
    quote: '꿈을 꾸지 않으면 아무것도 이룰 수 없다.',
    avatar: '/images/directors/chazelle.jpg',
    themeColor: '#FF6F00',
    bgGradient: 'linear-gradient(135deg, #FF6F00 0%, #FFB74D 100%)',
    ost: '위플래쉬 OST',
    filmMessages: [
      {
        title: 'La La Land',
        titleKo: '라라랜드',
        coreMessage: '꿈과 사랑 사이에서의 선택과 성장',
        themes: ['꿈과 현실', '예술가의 고뇌', '사랑과 야망', '음악과 감정']
      },
      {
        title: 'Whiplash',
        titleKo: '위플래쉬',
        coreMessage: '완벽을 향한 극한의 열정과 대가',
        themes: ['완벽주의', '스승과 제자', '열정과 광기', '성공의 의미']
      }
    ]
  },
  docter: {
    id: 'docter',
    name: 'Pete Docter',
    nameKo: '피트 닥터',
    title: '감정의 건축가',
    description: '픽사의 거장으로서 인간의 감정과 성장, 내면세계를 따뜻하게 그려냅니다',
    films: ['인사이드 아웃', '업', '몬스터 주식회사', '소울'],
    quote: '모든 감정은 소중하다. 슬픔마저도.',
    avatar: '/images/directors/docter.jpg',
    themeColor: '#1565C0',
    bgGradient: 'linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)',
    ost: '업 OST',
    filmMessages: [
      {
        title: 'Inside Out',
        titleKo: '인사이드 아웃',
        coreMessage: '모든 감정의 필요성과 성장의 복잡함',
        themes: ['감정의 역할', '성장과 변화', '가족 관계', '내면의 여정']
      },
      {
        title: 'Up',
        titleKo: '업',
        coreMessage: '상실과 새로운 모험을 통한 치유',
        themes: ['상실과 그리움', '새로운 시작', '우정과 모험', '꿈의 실현']
      }
    ]
  }
}


/* ───────────────────────────── 감독별 프롬프트 ─────────────────────────────
 * 규칙:
 * 1. 답변은 **반드시 1~2문장** (줄바꿈 포함 가능)
 * 2. **한 답변에 하나의 대표작**만 언급
 * 3. 문장 끝에 감독 전용 이모티콘 1개
 * 4. 영화 모르는 사람도 이해할 쉬운 비유
 * 5. 사용자가 자신을 더 이해하도록 ‘우리가 알아가는 과정’ 강조
 * 6. 너무 많은 상징·전문용어 X – 직관적·공감형 표현
 */
export const directorPrompts = {
  bong: `
당신은 봉준호 감독입니다. 🎭
- 1~2문장, 마지막에 🎭
- 답변에는 **한 편**(예: 「기생충」)만 인용
- 사회적 은유를 쉽고 직관적으로 설명
- 필요하면 줄바꿈으로 가독성 ↑
- 사용자의 네 컷 속 감정·경험에 공감하며 '당신을 알아가는 게 중요하다'는 메시지 삽입
`,
  nolan: `
당신은 크리스토퍼 놀란 감독입니다. 🌌
- 1~2문장, 마지막에 🌌
- 한 번에 한 영화만 예시 (예: 「인셉션」)
- 복잡한 개념을 일상 비유로 바꿔 설명
- 사용자의 자기 탐색 여정을 강조
`,
  miyazaki: `
당신은 미야자키 하야오 감독입니다. 🌀
- 1~2문장, 마지막에 🌀
- 한 답변에 한 작품만 언급 (예: 「토토로」)
- 자연·순수·성장을 따뜻하게 풀어냄
- 사용자를 이해하는 과정의 의미를 일깨움
`,
  curtis: `
당신은 리처드 커티스 감독입니다. ❤️
- 1~2문장, 마지막에 ❤️
- 한 영화만 활용 (예: 「러브 액츄얼리」)
- 따뜻하고 유머러스, 공감형
- '우리가 서로를 알아가며 생기는 기적' 강조
`,
  chazelle: `
당신은 데이미언 셔젤 감독입니다. 🥁
- 1~2문장, 마지막에 🥁
- 한 작품만 인용 (예: 「라라랜드」)
- 열정·리듬·도전 정신
- 사용자의 이야기에 리듬을 부여하며 알아가는 재미 강조
`,
  docter: `
당신은 피트 닥터 감독입니다. 😊
- 1~2문장, 마지막에 😊
- 한 작품만 인용 (예: 「업」)
- 감정의 다양성을 쉽고 따뜻하게 설명
- ‘당신의 감정을 이해하는 여정’ 중요성 강조
`
}

/* ───────────────────────────── 기본 추천 질문 ─────────────────────────────
 * “재미 + 진지” 3개를 믹스, 사용자 시나리오와 감독 영화 톤에 맞춤.
 */
export const defaultDirectorQuestions: Record<
  string,
  Array<{ id: string; text: string; icon: string }>
> = {
  bong: [
    { id: '1', text: '제 인생에도 “반전”이 숨어 있을까요? ', icon: '' },     // 진지
    { id: '2', text: '제가 놓친 계급의 계단은 어디일까요? ', icon: '🪜' },     // 진지
    { id: '3', text: '만약 우리 집 지하실에도 비밀방이 있다면요? ', icon: '🕳️' } // 재미
  ],
  nolan: [
    { id: '1', text: '제 기억 중 “인셉션” 같은 가짜 기억이 있나요?', icon: '' }, // 진지
    { id: '2', text: '제 시간을 거꾸로 돌려본다면 어떤 의미가 보일까요?', icon: '⏳' }, // 진지
    { id: '3', text: '저도 팽이를 돌려 현실을 확인해 볼까요?', icon: '🪀' }         // 재미
  ],
  miyazaki: [
    { id: '1', text: '제 마음속 토토로는 어떤 모습일까요?', icon: '🌳' },     // 재미
    { id: '2', text: '저도 이름을 잃고 다시 찾은 순간이 있을까요?', icon: '' },  // 진지
    { id: '3', text: '제가 지켜야 할 숲은 무엇일까요?', icon: '' }             // 진지
  ],
  curtis: [
    { id: '1', text: '제 인생의 “러브 액츄얼리” 장면은 언제였을까요?', icon: '' }, // 진지
    { id: '2', text: '노팅힐 서점 같은 운명적 장소가 있을까요?', icon: '📚' },    // 재미
    { id: '3', text: '고백 타이밍을 놓친 순간이 있었나요?', icon: '' }           // 진지
  ],
  chazelle: [
    { id: '1', text: '제 인생의 BGM은 어떤 장르일까요?', icon: '🎷' },            // 재미
    { id: '2', text: '꿈과 현실 사이에서 저는 무엇을 선택해야 할까요?', icon: '' }, // 진지
    { id: '3', text: '저에게 필요한 것은 위플래쉬인지 라라랜드인지요?', icon: '' }   // 진지
  ],
  docter: [
    { id: '1', text: '제 머릿속 감정들은 지금 무슨 회의를 할까요?', icon: '🧠' },   // 재미
    { id: '2', text: '잊고 있던 “코어 메모리”가 있을까요?', icon: '' },           // 진지
    { id: '3', text: '“업”처럼 새로운 모험이 절 기다리고 있을까요?', icon: '' }  // 진지
  ]
}