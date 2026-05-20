'use client'

import { useCallback } from 'react'
import { useChatStore } from '@/store/chatStore'
import { chat as chatApi, streamChatMessage } from '@/lib/api'
import { generateId } from '@/lib/utils'
import type { ModelId, Conversation, Message } from '@/types/chat'

// Individual selectors to prevent re-creating callbacks on unrelated state changes
const useSetConversations   = () => useChatStore((s) => s.setConversations)
const useAddConversation    = () => useChatStore((s) => s.addConversation)
const useRemoveConversation = () => useChatStore((s) => s.removeConversation)
const useSetActiveId        = () => useChatStore((s) => s.setActiveConversationId)
const useSetMessages        = () => useChatStore((s) => s.setMessages)
const useAddMessage         = () => useChatStore((s) => s.addMessage)
const useRemoveMessage      = () => useChatStore((s) => s.removeMessage)
const useAppendToMessage    = () => useChatStore((s) => s.appendToMessage)
const useUpdateStatus       = () => useChatStore((s) => s.updateMessageStatus)
const useSetStreaming        = () => useChatStore((s) => s.setStreaming)
const useSetLoadingMessages = () => useChatStore((s) => s.setLoadingMessages)
const useUpdateLastMessage  = () => useChatStore((s) => s.updateConversationLastMessage)

function mapConversation(c: Record<string, unknown>): Conversation {
  return {
    id:             String(c.id),
    title:          String(c.title ?? 'New Conversation'),
    model:          String(c.model_used ?? c.model ?? 'prime') as ModelId,
    isArchived:     Boolean(c.is_archived ?? c.isArchived ?? false),
    isPinned:       Boolean(c.is_pinned ?? c.isPinned ?? false),
    messageCount:   Number(c.message_count ?? c.messageCount ?? 0),
    userId:         String(c.user_id ?? c.userId ?? ''),
    createdAt:      String(c.created_at ?? c.createdAt ?? new Date().toISOString()),
    updatedAt:      String(c.updated_at ?? c.updatedAt ?? new Date().toISOString()),
    lastMessage:    (c.last_message ?? c.lastMessage) as string | undefined,
    lastMessageAt:  (c.last_message_at ?? c.lastMessageAt) as string | undefined,
  }
}

function mapMessage(m: Record<string, unknown>, fallbackConversationId: string): Message {
  return {
    id:             String(m.id),
    conversationId: String(m.conversation_id ?? m.conversationId ?? fallbackConversationId),
    role:           (m.role as Message['role']) ?? 'assistant',
    content:        String(m.content ?? ''),
    status:         'sent',
    createdAt:      String(m.created_at ?? m.createdAt ?? new Date().toISOString()),
  }
}

export function useChat() {
  const conversations     = useChatStore((s) => s.conversations)
  const messages          = useChatStore((s) => s.messages)
  const activeId          = useChatStore((s) => s.activeConversationId)
  const isStreaming       = useChatStore((s) => s.isStreaming)
  const isLoadingMessages = useChatStore((s) => s.isLoadingMessages)

  const setConversations   = useSetConversations()
  const addConversation    = useAddConversation()
  const removeConversation = useRemoveConversation()
  const setActiveId        = useSetActiveId()
  const setMessages        = useSetMessages()
  const addMessage         = useAddMessage()
  const removeMessage      = useRemoveMessage()
  const appendToMessage    = useAppendToMessage()
  const updateStatus       = useUpdateStatus()
  const setStreaming        = useSetStreaming()
  const setLoadingMessages = useSetLoadingMessages()
  const updateLastMessage  = useUpdateLastMessage()

  const loadConversations = useCallback(async () => {
    try {
      const res = await chatApi.getConversations()
      const data = res.data as unknown
      const raw: Record<string, unknown>[] = Array.isArray(data)
        ? (data as Record<string, unknown>[])
        : ((((data as Record<string, unknown>)?.conversations ?? []) as Record<string, unknown>[]))
      setConversations(raw.map(mapConversation))
    } catch {
      // Fail silently
    }
  }, [setConversations])

  const loadConversation = useCallback(
    async (conversationId: string) => {
      setActiveId(conversationId)
      setLoadingMessages(true)
      try {
        const res = await chatApi.getMessages(conversationId)
        const data = res.data as unknown
        const rawMsgs: Record<string, unknown>[] = Array.isArray(data)
          ? (data as Record<string, unknown>[])
          : ((((data as Record<string, unknown>).messages ?? []) as Record<string, unknown>[]))
        const msgs: Message[] = rawMsgs.map((m) => mapMessage(m, conversationId))
        setMessages(msgs)
      } catch {
        setMessages([])
      } finally {
        setLoadingMessages(false)
      }
    },
    [setActiveId, setLoadingMessages, setMessages]
  )

  const createConversation = useCallback(
    async (model: ModelId): Promise<Conversation | null> => {
      try {
        const res = await chatApi.createConversation(model)
        const conv = mapConversation(res.data as unknown as Record<string, unknown>)
        addConversation(conv)
        return conv
      } catch {
        return null
      }
    },
    [addConversation]
  )

  const deleteConversation = useCallback(
    async (conversationId: string) => {
      try {
        await chatApi.deleteConversation(conversationId)
      } catch {
        // Optimistic remove
      }
      removeConversation(conversationId)
    },
    [removeConversation]
  )

  const sendMessage = useCallback(
    async (content: string, model: ModelId, conversationId: string) => {
      const userMessage: Message = {
        id:             generateId(),
        conversationId,
        role:           'user',
        content,
        status:         'sent',
        createdAt:      new Date().toISOString(),
      }
      addMessage(userMessage)

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
      addMessage(aiMessage)
      setStreaming(true)

      // Batch delta updates to ~30fps to reduce re-renders during streaming
      let buffer = ''
      let flushTimer: ReturnType<typeof setTimeout> | null = null

      function flush() {
        if (buffer) {
          appendToMessage(aiMessageId, buffer)
          buffer = ''
        }
        flushTimer = null
      }

      try {
        await streamChatMessage(
          { conversationId, content, model, stream: true },
          (delta) => {
            buffer += delta
            if (!flushTimer) {
              flushTimer = setTimeout(flush, 32)
            }
          },
          () => {
            if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
            flush()
            updateStatus(aiMessageId, 'sent')
            setStreaming(false)
            updateLastMessage(conversationId, content)
          },
          (err) => {
            if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
            flush()
            console.error('Streaming error:', err)
            updateStatus(aiMessageId, 'error')
            appendToMessage(aiMessageId, '\n\n_An error occurred. Please try again._')
            setStreaming(false)
          }
        )
      } catch (err) {
        if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
        flush()
        console.error('sendMessage error:', err)
        updateStatus(aiMessageId, 'error')
        setStreaming(false)
      }
    },
    [addMessage, setStreaming, appendToMessage, updateStatus, setStreaming, updateLastMessage]
  )

  const retryMessage = useCallback(
    async (messageId: string) => {
      const msgs = useChatStore.getState().messages
      const failedMsg = msgs.find((m) => m.id === messageId)
      if (!failedMsg) return
      const idx     = msgs.indexOf(failedMsg)
      const userMsg = msgs.slice(0, idx).reverse().find((m) => m.role === 'user')
      if (!userMsg) return
      removeMessage(messageId)
      await sendMessage(
        userMsg.content,
        (failedMsg.model ?? 'prime') as ModelId,
        failedMsg.conversationId
      )
    },
    [removeMessage, sendMessage]
  )

  return {
    conversations,
    messages,
    activeId,
    isStreaming,
    isLoadingMessages,
    loadConversations,
    loadConversation,
    createConversation,
    deleteConversation,
    sendMessage,
    retryMessage,
  }
}
