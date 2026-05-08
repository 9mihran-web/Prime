import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/layout/ThemeProvider'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: {
    default: 'Prime — Your AI Operating System',
    template: '%s | Prime',
  },
  description:
    'Prime is a next-generation AI platform with intelligent chat, voice interface, autonomous agents, and persistent memory.',
  keywords: ['AI', 'assistant', 'chat', 'voice', 'agents', 'Prime'],
  authors: [{ name: 'Prime' }],
  creator: 'Prime',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'Prime — Your AI Operating System',
    description: 'Next-generation AI platform with intelligent chat, voice, and autonomous agents.',
    siteName: 'Prime',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Prime — Your AI Operating System',
    description: 'Next-generation AI platform with intelligent chat, voice, and autonomous agents.',
  },
  icons: {
    icon: '/favicon.ico',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0f',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
