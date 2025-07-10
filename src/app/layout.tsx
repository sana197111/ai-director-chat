import type { Metadata } from 'next'
import { Noto_Sans_KR, JetBrains_Mono } from 'next/font/google'
import '@/styles/globals.css'
import { ToastProvider } from '@/components/ui'
import PageTransition from '@/components/layouts/PageTransition'
import { AppProvider } from '@/contexts/AppContext'

const notoSansKr = Noto_Sans_KR({ 
  subsets: ['latin'],
  weight: ['300', '400', '500', '700', '900'],
  variable: '--font-noto-sans-kr',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: '거장과의 대화',
  description: '거장 감독과 함께 당신의 인생 네 컷을 분석하고 연출해보세요',
  icons: {
    icon: [
      { url: '/logo192.png', sizes: '192x192', type: 'image/png' },
      { url: '/logo512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: [
      { url: '/logo192.png', sizes: '192x192', type: 'image/png' }
    ]
  },
  manifest: '/manifest.json',
  openGraph: {
    title: '거장과의 대화',
    description: '거장 감독과 함께 당신의 인생 네 컷을 분석하고 연출해보세요',
    type: 'website',
    url: '/',
    images: [
      {
        url: '/logo512.png',
        width: 512,
        height: 512,
        alt: '거장과의 대화 로고'
      }
    ]
  },
  twitter: {
    card: 'summary',
    title: '거장과의 대화',
    description: '거장 감독과 함께 당신의 인생 네 컷을 분석하고 연출해보세요',
    images: ['/logo512.png']
  }
}

export function generateViewport() {
  return {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: '#000000',
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={`${notoSansKr.variable} ${jetbrainsMono.variable} font-sans antialiased`} suppressHydrationWarning={true}>
        <AppProvider>
          <ToastProvider>
            <PageTransition>
              <main className="fullscreen-safe">
                {children}
              </main>
            </PageTransition>
          </ToastProvider>
        </AppProvider>
      </body>
    </html>
  )
}
