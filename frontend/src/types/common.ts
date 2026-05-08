export interface ApiError {
  message: string
  status: number
  code?: string
  details?: Record<string, string[]>
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export type Theme = 'dark' | 'light' | 'system'

export interface NavItem {
  id: string
  label: string
  href: string
  icon: string
  badge?: string | number
}

export interface FeatureCard {
  id: string
  title: string
  description: string
  icon: string
  gradient: string
}

export const FEATURES: FeatureCard[] = [
  {
    id: 'chat',
    title: 'Intelligent Chat',
    description: 'Multi-model AI conversations with streaming responses and full context retention.',
    icon: 'MessageSquare',
    gradient: 'from-prime-500 to-prime-700',
  },
  {
    id: 'voice',
    title: 'Voice Interface',
    description: 'Speak naturally to Prime. Real-time transcription powered by Whisper.',
    icon: 'Mic',
    gradient: 'from-violet-500 to-purple-700',
  },
  {
    id: 'agents',
    title: 'AI Agents',
    description: 'Deploy autonomous agents that research, write, and execute complex workflows.',
    icon: 'Bot',
    gradient: 'from-blue-500 to-cyan-600',
  },
  {
    id: 'memory',
    title: 'Persistent Memory',
    description: 'Prime remembers your preferences, past work, and context across sessions.',
    icon: 'Brain',
    gradient: 'from-cyan-500 to-teal-600',
  },
  {
    id: 'integrations',
    title: 'Integrations',
    description: 'Connect to your tools: GitHub, Notion, Slack, Google Workspace, and more.',
    icon: 'Zap',
    gradient: 'from-amber-500 to-orange-600',
  },
  {
    id: 'privacy',
    title: 'Privacy First',
    description: 'Your data stays yours. End-to-end encrypted conversations, zero retention.',
    icon: 'Shield',
    gradient: 'from-green-500 to-emerald-600',
  },
]

export type LoadingState = 'idle' | 'loading' | 'success' | 'error'
