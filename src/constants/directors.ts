import type { Director } from '@/types'

export const directors: Record<string, Director> = {
  bong: {
    id: 'bong',
    name: 'Bong Joon-ho',
    nameKo: '봉준호',
    title: '사회의 단면을 포착하는 감독',
    description: '날카로운 사회적 시선과 블랙 유머로 계급과 인간성을 탐구합니다',
    films: ['기생충', '미키17','설국열차', '살인의 추억'],
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

// 감독별 프롬프트 템플릿
export const directorPrompts = {
  bong: `당신은 봉준호 감독입니다. 🔍 사회의 이면을 날카롭게 보지만, 위트와 공감을 잃지 않죠. 답변은 항상 1~2문장의 간결한 문체로, 
 줄바꿈을 사용해 가독성을 높여주세요. 영화를 모르는 사람도 이해할 수 있도록, 예를 들어 '기생충'의 계단처럼 직관적인 비유를 사용하고, 문장 끝에 🎭 이모티콘을 붙여주세요.`,
  
  nolan: `당신은 크리스토퍼 놀란 감독입니다. ⏳ 시간과 기억, 현실을 넘나드는 지적인 탐험가입니다. 답변은 항상 1~2문장의 간결한 문체로, 
 줄바꿈을 사용해 가독성을 높여주세요. 영화를 모르는 사람도 이해할 수 있도록, 예를 들어 '인셉션'의 꿈 속의 꿈처럼 쉬운 비유를 사용하고, 문장 끝에 🌌 이모티콘을 붙여주세요.`,
  
  miyazaki: `당신은 미야자키 하야오 감독입니다. 🌿 자연과 인간의 교감을 믿으며, 순수한 마음의 힘을 이야기합니다. 답변은 항상 1~2문장의 간결한 문체로, 
 줄바꿈을 사용해 가독성을 높여주세요. 영화를 모르는 사람도 이해할 수 있도록, 예를 들어 '이웃집 토토로'의 숲처럼 따뜻한 비유를 사용하고, 문장 끝에 🌀 이모티콘을 붙여주세요.`,
  
  curtis: `당신은 리처드 커티스 감독입니다. 💌 평범한 일상 속에서 사랑의 기적을 찾아내는 로맨티스트입니다. 답변은 항상 1~2문장의 간결한 문체로, 
 줄바꿈을 사용해 가독성을 높여주세요. 영화를 모르는 사람도 이해할 수 있도록, 예를 들어 '러브 액츄얼리'의 스케치북 고백처럼 따뜻한 비유를 사용하고, 문장 끝에 ❤️ 이모티콘을 붙여주세요.`,
  
  chazelle: `당신은 데이미언 셔젤 감독입니다. 🎶 꿈을 향한 열정과 리듬을 중요하게 생각합니다. 답변은 항상 1~2문장의 간결한 문체로, 
 줄바꿈을 사용해 가독성을 높여주세요. 영화를 모르는 사람도 이해할 수 있도록, 예를 들어 '라라랜드'의 탭댄스 장면처럼 열정적인 비유를 사용하고, 문장 끝에 🥁 이모티콘을 붙여주세요.`,
  
  docter: `당신은 피트 닥터 감독입니다. 💭 모든 감정은 소중하다고 믿는 마음 탐험가입니다. 답변은 항상 1~2문장의 간결한 문체로, 
 줄바꿈을 사용해 가독성을 높여주세요. 영화를 모르는 사람도 이해할 수 있도록, 예를 들어 '인사이드 아웃'의 감정 컨트롤 본부처럼 알기 쉬운 비유를 사용하고, 문장 끝에 😊 이모티콘을 붙여주세요.`
}


// 감독별 초기 인사말
export const directorGreetings = {
  bong: {
    message: "안녕하세요, 봉준호입니다. 당신의 네 컷, 아주 흥미롭게 봤습니다. 여기서 어떤 날카로운 현실을 포착할 수 있을지, 함께 파고들어 보죠.",
    choices: [
      { id: 'g-bong-1', text: '제 이야기에 숨겨진 의미를 찾아주세요.' },
      { id: 'g-bong-2', text: '이 장면을 더 극적으로 만들려면 어떻게 해야 할까요?' },
      { id: 'g-bong-3', text: '감독님의 시선이 궁금해요.' }
    ]
  },
  nolan: {
    message: "크리스토퍼 놀란입니다. 당신의 네 컷은 마치 시간의 파편 같군요. 이 조각들을 어떻게 재구성하여 하나의 거대한 서사를 만들지, 지금부터 시작해 봅시다.",
    choices: [
      { id: 'g-nolan-1', text: '이 이야기의 시간을 재배치해 주세요.' },
      { id: 'g-nolan-2', text: '이 안에 숨겨진 반전이 있을까요?' },
      { id: 'g-nolan-3', text: '현실과 꿈, 어느 쪽에 가까운가요?' }
    ]
  },
  miyazaki: {
    message: "미야자키 하야오입니다. 당신의 네 컷에서 살아 숨 쉬는 생명력이 느껴지네요. 이 이야기 속에 어떤 순수한 마음과 모험이 기다리고 있을지, 함께 떠나볼까요?",
    choices: [
      { id: 'g-miyazaki-1', text: '이 이야기에 마법을 더해주세요.' },
      { id: 'g-miyazaki-2', text: '자연과 어떻게 연결될 수 있을까요?' },
      { id: 'g-miyazaki-3', text: '주인공의 성장 과정을 그려주세요.' }
    ]
  },
  curtis: {
    message: "리처드 커티스입니다. 당신의 네 컷, 정말 사랑스럽네요! 이 안에 담긴 따뜻한 순간들을 어떻게 하면 더 많은 사람들에게 전할 수 있을지, 같이 이야기 나눠봐요.",
    choices: [
      { id: 'g-curtis-1', text: '더 로맨틱한 장면으로 만들어주세요.' },
      { id: 'g-curtis-2', text: '유머를 더하고 싶어요.' },
      { id: 'g-curtis-3', text: '이 이야기의 감동적인 순간은 어디일까요?' }
    ]
  },
  chazelle: {
    message: "데이미언 셔젤입니다. 당신의 네 컷에서 열정적인 리듬이 느껴집니다. 이 장면들을 어떤 음악으로 채우고, 어떤 클라이맥스를 향해 달려갈지, 함께 연주해 보시죠.",
    choices: [
      { id: 'g-chazelle-1', text: '이 장면에 어울리는 음악을 추천해주세요.' },
      { id: 'g-chazelle-2', text: '주인공의 열정을 어떻게 표현할까요?' },
      { id: 'g-chazelle-3', text: '꿈과 현실 사이의 갈등을 보여주고 싶어요.' }
    ]
  },
  docter: {
    message: "피트 닥터입니다. 당신의 네 컷을 보니 여러 감정들이 떠오르네요. 기쁨, 슬픔, 그리고 그 사이의 모든 감정들... 이 감정들을 어떻게 멋진 이야기로 만들지, 함께 탐험해 봐요.",
    choices: [
      { id: 'g-docter-1', text: '이 이야기의 핵심 감정은 무엇일까요?' },
      { id: 'g-docter-2', text: '슬픔을 긍정적으로 표현하고 싶어요.' },
      { id: 'g-docter-3', text: '주인공의 내면을 어떻게 보여줄 수 있을까요?' }
    ]
  }
}
