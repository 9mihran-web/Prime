'use client'

import { useCallback } from 'react'
import { useChatStore } from '@/store/chatStore'
import { chat as chatApi, streamChatMessage } from '@/lib/api'
import { generateId } from '@/lib/utils'
import type { ModelId, Conversation, Message } from '@/types/chat'

export function useChat() {
  const store = useChatStore()

  // ── Load conversations list ──────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      const res = await chatApi.getConversations()
      store.setConversations(res.data.conversations)
    } catch {
      // Fail silently; user may not have any conversations yet
    }
  }, [store])

  // ── Load a single conversation's messages ────────────────────────────────
  const loadConversation = useCallback(
    async (conversationId: string) => {
      store.setActiveConversationId(conversationId)
      store.setLoadingMessages(true)
      try {
        const res = await chatApi.getMessages(conversationId)
        const messages = (res.data as { messages?: Message[]; data?: Message[] })
          .messages ?? (res.data as { data?: Message[] }).data ?? []
        store.setMessages(messages)
      } catch {
        store.setMessages([])
      } finally {
        store.setLoadingMessages(false)
      }
    },
    [store]
  )

  // ── Create a new conversation ────────────────────────────────────────────
  const createConversation = useCallback(
    async (model: ModelId): Promise<Conversation | null> => {
      try {
        const res = await chatApi.createConversation(model)
        const conv = res.data
        store.addConversation(conv)
        return conv
      } catch {
        return null
      }
    },
    [store]
  )

  // ── Delete a conversation ────────────────────────────────────────────────
  const deleteConversation = useCallback(
    async (conversationId: string) => {
      try {
        await chatApi.deleteConversation(conversationId)
        store.removeConversation(conversationId)
      } catch {
        // Optimistic delete still removes from local state
        store.removeConversation(conversationId)
      }
    },
    [store]
  )

  // ── Send a message with streaming ────────────────────────────────────────
  const sendMessage = useCallback(
    async (content: string, model: ModelId, conversationId: string) => {
      // 1. Optimistically add user message
      const userMessage: Message = {
        id:             generateId(),
        conversationId,
        role:           'user',
        content,
        status:         'sent',
        createdAt:      new Date().toISOString(),
      }
      store.addMessage(userMessage)

      // 2. Add a placeholder AI message in streaming state
      const aiMessageId = generateId()
      const aiMessage: Message = {
        id:             aiMessageId,
        conversationId,
        role:           'assistant',
        content:        '',
        status:         'streaming',
        createdAt:      new Date().toISOString(),
        model,
      }
      store.addMessage(aiMessage)
      store.setStreaming(true)

      try {
        await streamChatMessage(
          { conversationId, content, model, stream: true },
          // onDelta
          (delta) => {
            store.appendToMessage(aiMessageId, delta)
          },
          // onDone
          () => {
            store.updateMessageStatus(aiMessageId, 'sent')
            store.setStreaming(false)
            // Update conversation's lastMessage preview
            store.updateConversationLastMessage(conversationId, content)
          },
          // onError
          (err) => {
            console.error('Streaming error:', err)
            store.updateMessageStatus(aiMessageId, 'error')
            store.appendToMessage(aiMessageId, '\n\n_An error occurred. Please try again._')
            store.setStreaming(false)
          }
        )
      } catch (err) {
        console.error('sendMessage error:', err)
        store.updateMessageStatus(aiMessageId, 'error')
        store.setStreaming(false)
      }
    },
    [store]
  )

  // ── Retry a failed message ────────────────────────────────────────────────
  const retryMessage = useCallback(
    async (messageId: string) => {
      const messages = useChatStore.getState().messages
      const failedMsg = messages.find((m) => m.id === messageId)
      if (!failedMsg) return

      // Find the user message preceding this one
      const idx     = messages.indexOf(failedMsg)
      const userMsg = messages.slice(0, idx).reverse().find((m) => m.role === 'user')
      if (!userMsg) return

      // Remove the failed AI message and re-send
      store.removeMessage(messageId)
      await sendMessage(
        userMsg.content,
        (failedMsg.model ?? 'gpt-4o') as ModelId,
        failedMsg.conversationId
      )
    },
    [store, sendMessage]
  )

  return {
    conversations:     store.conversations,
    messages:          store.messages,
    activeId:          store.activeConversationId,
    isStreaming:       store.isStreaming,
    isLoadingMessages: store.isLoadingMessages,
    loadConversations,
    loadConversation,
    createConversation,
    deleteConversation,
    sendMessage,
    retryMessage,
  }
}
