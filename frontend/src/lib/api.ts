import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { getStoredToken, clearTokens } from './auth'
import type {
  BackendTokenResponse,
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
  login: (data: LoginRequest): Promise<AxiosResponse<BackendTokenResponse>> =>
    apiClient.post<BackendTokenResponse>('/auth/login', data),

  register: (data: RegisterRequest): Promise<AxiosResponse<BackendTokenResponse>> =>
    apiClient.post<BackendTokenResponse>('/auth/register', data),

  logout: (): Promise<AxiosResponse<void>> =>
    apiClient.post('/auth/logout'),

  me: (): Promise<AxiosResponse<User>> =>
    apiClient.get<User>('/auth/me'),

  refreshToken: (refreshToken: string): Promise<AxiosResponse<BackendTokenResponse>> =>
    apiClient.post<BackendTokenResponse>('/auth/refresh', { refresh_token: refreshToken }),
}

// ─── Chat API ────────────────────────────────────────────────────────────────

const chat = {
  getConversations: (
    page = 1,
    pageSize = 20
  ): Promise<AxiosResponse<ConversationsResponse>> =>
    apiClient.get<ConversationsResponse>('/chat/conversations', {
      params: { limit: pageSize, offset: (page - 1) * pageSize },
    }),

  getConversation: (id: string): Promise<AxiosResponse<Conversation>> =>
    apiClient.get<Conversation>(`/chat/conversations/${id}`),

  createConversation: (model: ModelId): Promise<AxiosResponse<Conversation>> =>
    apiClient.post<Conversation>('/chat/conversations', { model }),

  deleteConversation: (id: string): Promise<AxiosResponse<void>> =>
    apiClient.delete(`/chat/conversations/${id}`),

  sendMessage: (
    data: SendMessageRequest
  ): Promise<AxiosResponse<SendMessageResponse>> =>
    apiClient.post<SendMessageResponse>(
      `/chat/conversations/${data.conversationId}/messages`,
      data
    ),

  getMessages: (conversationId: string) =>
    apiClient.get(`/chat/conversations/${conversationId}`),

  streamUrl: (conversationId: string): string =>
    `${API_BASE}/api/v1/chat/conversations/${conversationId}/messages`,
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
  const { conversationId, content, model, stream } = data

  try {
    const response = await fetch(
      `${API_BASE}/api/v1/chat/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        // Backend ChatRequest uses "message" not "content"
        body: JSON.stringify({ message: content, model, stream: stream ?? true }),
      }
    )

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText)
      throw new Error(`HTTP ${response.status}: ${errText}`)
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
          const raw = trimmed.slice(6)
          try {
            // Backend sends StreamChunk: { event, delta?, message?, error?, tokens? }
            const chunk = JSON.parse(raw) as {
              event: string
              delta?: string
              error?: string
              tokens?: number
            }
            if (chunk.event === 'delta' && chunk.delta) {
              onDelta(chunk.delta)
            } else if (chunk.event === 'done') {
              onDone()
              return
            } else if (chunk.event === 'error') {
              onError(new Error(chunk.error ?? 'Stream error'))
              return
            }
          } catch {
            // Skip malformed lines
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
