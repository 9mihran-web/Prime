export type MessageRole = 'user' | 'assistant' | 'system'

export type MessageStatus = 'sending' | 'sent' | 'error' | 'streaming'

export interface Message {
  id: string
  conversationId: string
  role: MessageRole
  content: string
  status: MessageStatus
  createdAt: string
  model?: string
  tokens?: {
    prompt: number
    completion: number
    total: number
  }
}

export type ModelId =
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'claude-3-5-sonnet-20241022'

export interface ModelOption {
  id: ModelId
  name: string
  description: string
  maxTokens: number
  contextWindow: number
}

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Most capable, best for complex tasks',
    maxTokens: 4096,
    contextWindow: 128000,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Fast and efficient for everyday tasks',
    maxTokens: 16384,
    contextWindow: 128000,
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    description: 'Exceptional reasoning and writing',
    maxTokens: 8192,
    contextWindow: 200000,
  },
]

export interface Conversation {
  id: string
  title: string
  lastMessage?: string
  lastMessageAt?: string
  messageCount: number
  model: ModelId
  createdAt: string
  updatedAt: string
  userId: string
  isArchived: boolean
  isPinned: boolean
}

export interface SendMessageRequest {
  conversationId?: string
  content: string
  model: ModelId
  stream?: boolean
}

export interface SendMessageResponse {
  messageId: string
  conversationId: string
}

export interface SSEDelta {
  type: 'delta' | 'done' | 'error'
  content?: string
  error?: string
}

export interface ConversationsResponse {
  conversations: Conversation[]
  total: number
  page: number
  pageSize: number
}

export interface QuickAction {
  id: string
  label: string
  prompt: string
  icon: string
}

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'summarize',
    label: 'Summarize a document',
    prompt: 'Please summarize the following document for me:',
    icon: 'FileText',
  },
  {
    id: 'code',
    label: 'Write code',
    prompt: 'Help me write code for:',
    icon: 'Code2',
  },
  {
    id: 'search',
    label: 'Search the web',
    prompt: 'Search the web and tell me about:',
    icon: 'Globe',
  },
  {
    id: 'plan',
    label: 'Plan my day',
    prompt: 'Help me plan my day. Here is what I need to accomplish:',
    icon: 'CalendarDays',
  },
]
