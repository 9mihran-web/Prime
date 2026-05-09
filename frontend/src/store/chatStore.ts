import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Conversation, Message, ModelId } from '@/types/chat'

interface ChatState {
  conversations:        Conversation[]
  activeConversationId: string | null
  messages:             Message[]
  isStreaming:          boolean
  isLoadingMessages:    boolean
  selectedModel:        ModelId

  // Conversation actions
  setConversations:    (conversations: Conversation[]) => void
  addConversation:     (conversation: Conversation) => void
  removeConversation:  (id: string) => void
  updateConversationLastMessage: (id: string, lastMessage: string) => void
  setActiveConversationId: (id: string | null) => void

  // Message actions
  setMessages:          (messages: Message[]) => void
  addMessage:           (message: Message) => void
  removeMessage:        (id: string) => void
  appendToMessage:      (id: string, delta: string) => void
  updateMessageStatus:  (id: string, status: Message['status']) => void

  // UI state
  setStreaming:         (streaming: boolean) => void
  setLoadingMessages:   (loading: boolean) => void
  setSelectedModel:     (model: ModelId) => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      conversations:        [],
      activeConversationId: null,
      messages:             [],
      isStreaming:          false,
      isLoadingMessages:    false,
      selectedModel:        'prime',

      setConversations: (conversations) => set({ conversations: conversations ?? [] }),

      addConversation: (conversation) =>
        set((state) => ({
          conversations: [conversation, ...state.conversations.filter((c) => c.id !== conversation.id)],
        })),

      removeConversation: (id) =>
        set((state) => ({
          conversations: state.conversations.filter((c) => c.id !== id),
          activeConversationId: state.activeConversationId === id ? null : state.activeConversationId,
          messages: state.messages.filter((m) => m.conversationId !== id),
        })),

      updateConversationLastMessage: (id, lastMessage) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id
              ? { ...c, lastMessage, lastMessageAt: new Date().toISOString() }
              : c
          ),
        })),

      setActiveConversationId: (id) => set({ activeConversationId: id }),

      setMessages: (messages) => set({ messages }),

      addMessage: (message) =>
        set((state) => ({ messages: [...state.messages, message] })),

      removeMessage: (id) =>
        set((state) => ({ messages: state.messages.filter((m) => m.id !== id) })),

      appendToMessage: (id, delta) =>
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === id ? { ...m, content: m.content + delta } : m
          ),
        })),

      updateMessageStatus: (id, status) =>
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === id ? { ...m, status } : m
          ),
        })),

      setStreaming:       (isStreaming)       => set({ isStreaming }),
      setLoadingMessages: (isLoadingMessages) => set({ isLoadingMessages }),
      setSelectedModel:   (selectedModel)     => set({ selectedModel }),
    }),
    {
      name: 'prime-chat',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined'
          ? localStorage
          : {
              getItem: () => null,
              setItem: () => undefined,
              removeItem: () => undefined,
            }
      ),
      // Only persist conversations list and selected model; messages are session-only
      partialize: (state) => ({
        conversations:  state.conversations,
        selectedModel:  state.selectedModel,
      }),
    }
  )
)
