export const tokens = {
  touch: {
    minSize: 48,
    targetSize: '48px',
    padding: {
      sm: '8px',
      md: '16px',
      lg: '24px'
    }
  },
  animation: {
    duration: {
      instant: 50,
      fast: 150,
      normal: 300,
      slow: 500,
      verySlow: 1000
    },
    easing: {
      default: 'cubic-bezier(0.4, 0, 0.2, 1)',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      smooth: 'cubic-bezier(0.25, 0.1, 0.25, 1)'
    }
  },
  fontSize: {
    xs: '14px',
    sm: '16px',
    base: '18px',
    lg: '20px',
    xl: '24px',
    xxl: '32px'
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75
  },
  colors: {
    primary: '#000000',
    secondary: '#666666',
    accent: '#FF6B6B',
    background: '#FFFFFF',
    surface: '#F8F9FA',
    border: '#E9ECEF',
    text: {
      primary: '#212529',
      secondary: '#6C757D',
      disabled: '#ADB5BD'
    },
    status: {
      success: '#51CF66',
      warning: '#FFD43B',
      error: '#FF6B6B',
      info: '#339AF0'
    }
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px'
  },
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px'
  },
  shadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
  },
  zIndex: {
    base: 0,
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
    toast: 1080
  }
} as const

export type Tokens = typeof tokens
