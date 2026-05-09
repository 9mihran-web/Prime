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
  | 'llama3.2:3b'
  | 'llama3.2:1b'
  | 'prime'

export interface ModelOption {
  id: ModelId
  name: string
  description: string
  maxTokens: number
  contextWindow: number
}

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'llama3.2:3b',
    name: 'Prime (Llama 3.2 3B)',
    description: 'Local model — fast, private, no API key needed',
    maxTokens: 4096,
    contextWindow: 128000,
  },
  {
    id: 'llama3.2:1b',
    name: 'Prime Lite (Llama 3.2 1B)',
    description: 'Fastest local model, great for simple tasks',
    maxTokens: 4096,
    contextWindow: 128000,
  },
  {
    id: 'prime',
    name: 'Prime Custom',
    description: 'Your fine-tuned Prime model',
    maxTokens: 4096,
    contextWindow: 128000,
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
