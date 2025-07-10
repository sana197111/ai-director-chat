import { DirectorType } from '@/types'

// 감독별 오프라인 응답 세트
export const offlineResponses = {
  bong: {
    analyzing: [
      {
        message: '흥미롭네요. 이 장면에서 계급의 경계가 뚜렷하게 드러나는 것 같습니다. 계단이나 높낮이를 활용해서 시각적으로 표현하면 어떨까요? 🎭',
        choices: [
          { id: '1', text: '구체적인 촬영 기법을 알려주세요', icon: '📹' },
          { id: '2', text: '다른 장면도 분석해주세요', icon: '🎬' },
          { id: '3', text: '인물의 감정에 더 집중하고 싶어요', icon: '💭' }
        ]
      },
      {
        message: '이런 순간이야말로 가장 보편적이면서도 가장 특별한 것이죠. 일상 속에 숨겨진 부조리함을 포착하는 것, 그게 제가 추구하는 영화입니다. 🎥',
        choices: [
          { id: '1', text: '부조리함을 어떻게 표현할까요?', icon: '🤔' },
          { id: '2', text: '블랙 유머를 넣고 싶어요', icon: '😏' },
          { id: '3', text: '사회적 메시지를 강화하려면?', icon: '📢' }
        ]
      }
    ],
    deepening: [
      {
        message: '기생충에서 반지하 가족이 계단을 오르내리는 것처럼, 물리적 공간이 곧 계급을 상징하죠. 당신의 이야기에서도 그런 공간적 은유를 찾아볼 수 있을 것 같아요. 🏚️',
        choices: [
          { id: '1', text: '공간 설정에 대해 더 듣고 싶어요', icon: '🏠' },
          { id: '2', text: '인물 간 관계를 깊이 파고들어주세요', icon: '👥' },
          { id: '3', text: '상징과 은유를 더 활용하고 싶어요', icon: '🎭' }
        ]
      }
    ],
    concluding: [
      {
        message: '당신의 이야기는 우리 모두의 이야기입니다. 평범한 사람들의 특별하지 않은 일상, 하지만 그 안에 담긴 진실. 그것이 가장 강력한 영화가 됩니다. 🎬',
        choices: [
          { id: '1', text: '마지막 조언을 부탁드려요', icon: '💡' },
          { id: '2', text: '추천 작품이 있을까요?', icon: '📽️' },
          { id: '3', text: '감사합니다, 감독님', icon: '🙏' }
        ]
      }
    ]
  },
  
  nolan: {
    analyzing: [
      {
        message: '시간이란 선형적이지 않습니다. 당신의 네 컷도 마찬가지죠. 각 장면이 서로 다른 시간대에 존재하면서도 하나의 이야기를 만들어내고 있어요. ⏳',
        choices: [
          { id: '1', text: '시간의 복잡성을 더 탐구해주세요', icon: '🌀' },
          { id: '2', text: '기억과 현실의 관계를 알고 싶어요', icon: '🧠' },
          { id: '3', text: '서사 구조를 분석해주세요', icon: '📊' }
        ]
      },
      {
        message: '인셉션의 꿈속 꿈처럼, 당신의 기억도 여러 층위를 가지고 있네요. 어느 것이 가장 진실에 가까운 기억일까요? 아니면 모든 게 진실일까요? 🌀',
        choices: [
          { id: '1', text: '진실과 인식의 차이에 대해', icon: '🔍' },
          { id: '2', text: '기억의 신뢰성을 질문하고 싶어요', icon: '❓' },
          { id: '3', text: '다층적 구조를 활용하고 싶어요', icon: '🏗️' }
        ]
      }
    ],
    deepening: [
      {
        message: '인터스텔라에서 시간이 상대적이듯, 우리의 감정적 경험도 상대적입니다. 5분이 5년처럼 느껴지는 순간, 혹은 그 반대. 당신의 이야기에서 그런 순간이 있나요? 🌌',
        choices: [
          { id: '1', text: '감정과 시간의 관계를 더 깊이', icon: '💫' },
          { id: '2', text: '상대성의 원리를 적용해보고 싶어요', icon: '🔬' },
          { id: '3', text: '과학적 아름다움을 표현하려면?', icon: '🌟' }
        ]
      }
    ],
    concluding: [
      {
        message: '모든 이야기는 결국 시간에 관한 것입니다. 우리가 가진 것, 잃은 것, 그리고 되찾고 싶은 것. 당신의 이야기도 시간을 초월한 무언가를 담고 있네요. ⏰',
        choices: [
          { id: '1', text: '시간에 대한 마지막 통찰을', icon: '🎯' },
          { id: '2', text: '추천 작품을 알려주세요', icon: '🎞️' },
          { id: '3', text: '감사합니다, 놀란 감독님', icon: '🙏' }
        ]
      }
    ]
  },

  miyazaki: {
    analyzing: [
      {
        message: '당신의 이야기에서 바람이 느껴집니다. 변화의 바람, 성장의 바람... 토토로의 숲처럼, 모든 생명에는 이야기가 있죠. 🌿',
        choices: [
          { id: '1', text: '자연의 힘을 더 표현해주세요', icon: '🌱' },
          { id: '2', text: '성장의 과정을 그려주세요', icon: '🦋' },
          { id: '3', text: '판타지 요소를 더하고 싶어요', icon: '✨' }
        ]
      },
      {
        message: '센과 치히로처럼, 우리는 모두 자신만의 모험을 떠나죠. 때로는 무서워도, 앞으로 나아가야 합니다. 당신의 여정은 어떤가요? 🌊',
        choices: [
          { id: '1', text: '모험과 용기에 대해 더', icon: '⚔️' },
          { id: '2', text: '두려움을 극복하는 방법', icon: '🛡️' },
          { id: '3', text: '새로운 세계를 탐험하고 싶어요', icon: '🗺️' }
        ]
      }
    ],
    deepening: [
      {
        message: '자연은 파괴하면서도 치유합니다. 인간도 마찬가지죠. 나우시카가 독을 정화하듯, 우리도 상처를 치유할 힘이 있어요. 🌸',
        choices: [
          { id: '1', text: '치유와 재생의 힘에 대해', icon: '🌺' },
          { id: '2', text: '환경과 인간의 조화', icon: '🌍' },
          { id: '3', text: '희망의 메시지를 담고 싶어요', icon: '🕊️' }
        ]
      }
    ],
    concluding: [
      {
        message: '삶은 아름답습니다. 아픔도, 슬픔도 모두 포함해서요. 당신의 이야기도 그 아름다움을 담고 있네요. 계속 걸어가세요, 숲의 정령들이 지켜보고 있을 거예요. 🌟',
        choices: [
          { id: '1', text: '삶의 아름다움에 대한 조언을', icon: '🌈' },
          { id: '2', text: '추천 작품이 있을까요?', icon: '📚' },
          { id: '3', text: '감사합니다, 미야자키 감독님', icon: '🙏' }
        ]
      }
    ]
  },

  curtis: {
    analyzing: [
      {
        message: '오! 이 장면, 정말 러브 액츄얼리의 한 장면 같네요! 평범한 순간이지만 특별한 감정이 담겨있어요. 사랑은 정말 어디에나 있죠. 💕',
        choices: [
          { id: '1', text: '사랑의 순간들을 더 포착해주세요', icon: '💝' },
          { id: '2', text: '유머를 어떻게 넣을까요?', icon: '😄' },
          { id: '3', text: '감동적인 연출을 원해요', icon: '😢' }
        ]
      },
      {
        message: '실수도, 오해도 다 사랑의 일부예요. 노팅힐의 휴 그랜트처럼 어설픈 것도 매력이죠. 완벽하지 않아서 더 사랑스러운 거예요! 😊',
        choices: [
          { id: '1', text: '불완전함의 매력에 대해', icon: '🤷' },
          { id: '2', text: '로맨틱 코미디의 정수를', icon: '💑' },
          { id: '3', text: '진정성을 표현하고 싶어요', icon: '❤️' }
        ]
      }
    ],
    deepening: [
      {
        message: '어바웃 타임처럼, 우리에게 주어진 시간은 한정적이에요. 하지만 그 안에서 사랑하는 사람들과 보내는 매 순간이 기적이죠. 🕰️',
        choices: [
          { id: '1', text: '소중한 순간들을 더 깊이', icon: '⏰' },
          { id: '2', text: '가족의 사랑에 대해', icon: '👨‍👩‍👧‍👦' },
          { id: '3', text: '시간의 소중함을 표현하려면', icon: '💎' }
        ]
      }
    ],
    concluding: [
      {
        message: '결국 사랑이 답이에요. 크리스마스든 아니든, 공항이든 어디든, 사랑은 늘 우리 곁에 있죠. 당신의 이야기도 사랑으로 가득하네요! 🎄',
        choices: [
          { id: '1', text: '사랑에 대한 마지막 메시지를', icon: '💌' },
          { id: '2', text: '추천 영화가 있을까요?', icon: '🎭' },
          { id: '3', text: '고맙습니다, 커티스 감독님', icon: '🤗' }
        ]
      }
    ]
  },

  chazelle: {
    analyzing: [
      {
        message: '음악이 들려오네요! 당신의 이야기에서 라라랜드의 멜로디가 느껴져요. 각 장면이 하나의 악장을 이루고 있는 것 같아요. 🎵',
        choices: [
          { id: '1', text: '음악적 표현에 대해 더 듣고 싶어요', icon: '🎼' },
          { id: '2', text: '감정의 리듬을 분석해주세요', icon: '🥁' },
          { id: '3', text: '꿈과 현실의 경계를 탐구해주세요', icon: '🌟' }
        ]
      },
      {
        message: '위플래쉬의 앤드류처럼, 완벽을 추구하는 열정이 느껴져요. 때로는 고통스럽지만, 그것이 예술가의 운명이죠. 🥁',
        choices: [
          { id: '1', text: '열정과 고통의 관계를 알고 싶어요', icon: '🔥' },
          { id: '2', text: '예술가의 길에 대해 조언해주세요', icon: '🎭' },
          { id: '3', text: '균형 잡힌 삶이 가능할까요?', icon: '⚖️' }
        ]
      }
    ],
    deepening: [
      {
        message: '바빌론처럼, 모든 꿈에는 대가가 따르죠. 하지만 그 꿈을 포기할 수는 없어요. 음악이 당신을 부르고 있으니까요. 🎪',
        choices: [
          { id: '1', text: '꿈의 대가에 대해 더 이야기해주세요', icon: '💸' },
          { id: '2', text: '음악이 주는 위로를 나누고 싶어요', icon: '🎶' },
          { id: '3', text: '새로운 도전을 준비하고 있어요', icon: '🚀' }
        ]
      }
    ],
    concluding: [
      {
        message: '당신만의 라라랜드를 만들어가세요. 재즈처럼 즉흥적이면서도 조화로운... 그것이 인생이에요. 🌃',
        choices: [
          { id: '1', text: '마지막 조언을 주세요', icon: '🎯' },
          { id: '2', text: '추천하는 음악이 있나요?', icon: '🎧' },
          { id: '3', text: '감사합니다, 셰젤 감독님', icon: '🙏' }
        ]
      }
    ]
  },

  docter: {
    analyzing: [
      {
        message: '이 장면에서 많은 감정이 느껴져요. 상처, 두려움, 하지만 동시에 희망도... 모든 감정은 존재할 이유가 있어요. 그것들을 부정하지 마세요. 🌱',
        choices: [
          { id: '1', text: '감정을 더 깊이 탐구하고 싶어요', icon: '💭' },
          { id: '2', text: '상처와 마주하는 방법을 알려주세요', icon: '🩹' },
          { id: '3', text: '치유의 과정을 그려주세요', icon: '🌿' }
        ]
      },
      {
        message: '트라우마는 우리를 정의하지 않아요. 그것을 어떻게 극복하느냐가 우리를 만들죠. 당신은 이미 첫걸음을 뗐어요. 🦋',
        choices: [
          { id: '1', text: '회복탄력성에 대해 더 알고 싶어요', icon: '💪' },
          { id: '2', text: '성장의 의미를 탐구해주세요', icon: '🌳' },
          { id: '3', text: '새로운 시작을 준비하고 있어요', icon: '🌅' }
        ]
      }
    ],
    deepening: [
      {
        message: '상처받은 치유자가 가장 강한 치유자예요. 당신의 경험이 다른 사람에게 희망이 될 수 있어요. 그것이 연결의 힘이죠. 🤝',
        choices: [
          { id: '1', text: '공감과 연결에 대해 듣고 싶어요', icon: '❤️' },
          { id: '2', text: '나의 경험을 어떻게 승화시킬까요?', icon: '✨' },
          { id: '3', text: '타인을 돕는 방법을 알려주세요', icon: '🤲' }
        ]
      }
    ],
    concluding: [
      {
        message: '당신은 충분해요. 있는 그대로의 당신이 아름다워요. 상처도, 회복도 모두 당신의 일부이고, 그것이 당신을 특별하게 만들어요. 🌟',
        choices: [
          { id: '1', text: '마지막 위로의 말씀을 주세요', icon: '🕊️' },
          { id: '2', text: '추천하는 치유 방법이 있나요?', icon: '📖' },
          { id: '3', text: '감사합니다, 닥터 감독님', icon: '🙏' }
        ]
      }
    ]
  }
}

// 대화 단계별 응답 선택 함수
export function getOfflineResponse(
  director: DirectorType,
  turnCount: number,
  userMessage?: string
): {
  message: string
  choices: Array<{ id: string; text: string; icon: string }>
} {
  const responses = offlineResponses[director]
  
  // 대화 단계 결정
  let category: 'analyzing' | 'deepening' | 'concluding'
  if (turnCount <= 3) {
    category = 'analyzing'
  } else if (turnCount <= 7) {
    category = 'deepening'
  } else {
    category = 'concluding'
  }
  
  const categoryResponses = responses[category]
  const randomIndex = Math.floor(Math.random() * categoryResponses.length)
  
  return categoryResponses[randomIndex]
}

// 네트워크 상태 확인
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine
}

// 오프라인 모드 안내 메시지
export function getOfflineModeMessage(): string {
  return '현재 오프라인 모드입니다. 기본 응답으로 대화를 계속할 수 있습니다.'
}