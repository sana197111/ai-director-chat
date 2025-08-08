// Director types
export type DirectorType = 'bong' | 'nolan' | 'miyazaki' | 'curtis' | 'chazelle' | 'docter'

export interface FilmMessage {
  title: string
  titleKo: string
  coreMessage: string
  themes: string[]
}

export interface Director {
  id: DirectorType
  name: string
  nameKo: string
  title: string
  description: string
  films: string[]
  quote: string
  avatar: string
  themeColor: string
  bgGradient: string
  ost: string // Add this line
  filmMessages: [FilmMessage, FilmMessage] // 두 개의 대표 영화와 메시지
}

// Session types
export interface Session {
  id: string
  startTime: Date
  currentStep: 'start' | 'scenario' | 'director' | 'chat'
  lastActivity: Date
}

// Scenario types
export type EmotionType = 'joy' | 'anger' | 'sadness' | 'pleasure'

export interface Scenario {
  selectedEmotion: EmotionType | null
  cuts: {
    joy?: string
    anger?: string
    sadness?: string
    pleasure?: string
  }
  completed: boolean
  savedAt?: Date
}

// Chat types
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  choices?: Choice[]
}

export interface Choice {
  id: string
  text: string
  icon?: string
}

export interface ChatState {
  messages: Message[]
  currentTurn: number
  startTime: Date
  timeRemaining: number
  isExtended: boolean
  extensionCount: number
}

// App State
export interface AppState {
  session: Session
  director: {
    selected: DirectorType | null
    data: Director | null
  }
  scenario: Scenario
  chat: ChatState
}

// UI Component Props
export interface TouchButtonProps {
  onClick: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  haptic?: boolean
  loading?: boolean
  className?: string
  children: React.ReactNode
}

export interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'warning' | 'info'
  duration?: number
  onClose?: () => void
}

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  closeOnOverlayClick?: boolean
}
