import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { getStoredToken, clearTokens } from './auth'
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  User,
} from '@/types/auth'
import type {
  Conversation,
  ConversationsResponse,
  SendMessageRequest,
  SendMessageResponse,
  ModelId,
} from '@/types/chat'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

// Request interceptor: attach Bearer token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getStoredToken()
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor: handle 401 → redirect to login
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearTokens()
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// ─── Auth API ───────────────────────────────────────────────────────────────

const auth = {
  login: (data: LoginRequest): Promise<AxiosResponse<AuthResponse>> =>
    apiClient.post<AuthResponse>('/auth/login', data),

  register: (data: RegisterRequest): Promise<AxiosResponse<AuthResponse>> =>
    apiClient.post<AuthResponse>('/auth/register', data),

  logout: (): Promise<AxiosResponse<void>> =>
    apiClient.post('/auth/logout'),

  me: (): Promise<AxiosResponse<User>> =>
    apiClient.get<User>('/auth/me'),

  refreshToken: (refreshToken: string): Promise<AxiosResponse<AuthResponse>> =>
    apiClient.post<AuthResponse>('/auth/refresh', { refreshToken }),
}

// ─── Chat API ────────────────────────────────────────────────────────────────

const chat = {
  getConversations: (
    page = 1,
    pageSize = 20
  ): Promise<AxiosResponse<ConversationsResponse>> =>
    apiClient.get<ConversationsResponse>('/conversations', {
      params: { page, pageSize },
    }),

  getConversation: (id: string): Promise<AxiosResponse<Conversation>> =>
    apiClient.get<Conversation>(`/conversations/${id}`),

  createConversation: (model: ModelId): Promise<AxiosResponse<Conversation>> =>
    apiClient.post<Conversation>('/conversations', { model }),

  deleteConversation: (id: string): Promise<AxiosResponse<void>> =>
    apiClient.delete(`/conversations/${id}`),

  sendMessage: (
    data: SendMessageRequest
  ): Promise<AxiosResponse<SendMessageResponse>> =>
    apiClient.post<SendMessageResponse>('/messages', data),

  getMessages: (conversationId: string) =>
    apiClient.get(`/conversations/${conversationId}/messages`),

  streamUrl: (conversationId: string): string =>
    `${API_BASE}/api/v1/conversations/${conversationId}/stream`,
}

// ─── Voice API ───────────────────────────────────────────────────────────────

const voice = {
  transcribe: async (audioBlob: Blob): Promise<{ text: string }> => {
    const formData = new FormData()
    formData.append('audio', audioBlob, 'recording.webm')
    const response = await apiClient.post<{ text: string }>(
      '/voice/transcribe',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return response.data
  },
}

// ─── Streaming helper ────────────────────────────────────────────────────────

export function createSSEStream(
  conversationId: string,
  messageId: string,
  onDelta: (text: string) => void,
  onDone: () => void,
  onError: (err: Error) => void
): () => void {
  const token = getStoredToken()
  const url = new URL(`${API_BASE}/api/v1/conversations/${conversationId}/stream`)
  url.searchParams.set('messageId', messageId)

  const eventSource = new EventSource(url.toString())

  // EventSource doesn't support custom headers natively; for auth we use URL params
  // For production, consider using fetch with ReadableStream instead
  eventSource.onmessage = (event) => {
    if (event.data === '[DONE]') {
      onDone()
      eventSource.close()
      return
    }
    try {
      const parsed = JSON.parse(event.data) as {
        choices?: Array<{ delta?: { content?: string } }>
        error?: string
      }
      if (parsed.error) {
        onError(new Error(parsed.error))
        eventSource.close()
        return
      }
      const delta = parsed.choices?.[0]?.delta?.content ?? ''
      if (delta) onDelta(delta)
    } catch {
      // Non-JSON lines are ignored
    }
  }

  eventSource.onerror = () => {
    onError(new Error('Stream connection failed'))
    eventSource.close()
  }

  return () => eventSource.close()
}

export async function streamChatMessage(
  data: SendMessageRequest & { token?: string },
  onDelta: (text: string) => void,
  onDone: () => void,
  onError: (err: Error) => void
): Promise<void> {
  const token = getStoredToken()
  const controller = new AbortController()

  try {
    const response = await fetch(`${API_BASE}/api/v1/messages/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ ...data, stream: true }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith(':')) continue
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6)
          if (data === '[DONE]') {
            onDone()
            return
          }
          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string } }>
              error?: string
            }
            if (parsed.error) {
              onError(new Error(parsed.error))
              return
            }
            const delta = parsed.choices?.[0]?.delta?.content ?? ''
            if (delta) onDelta(delta)
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    }
    onDone()
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      onError(err instanceof Error ? err : new Error('Unknown streaming error'))
    }
  }
}

export { auth, chat, voice }
export default apiClient
