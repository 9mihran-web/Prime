'use client'

import { useCallback } from 'react'
import { useChatStore } from '@/store/chatStore'
import { chat as chatApi, streamChatMessage } from '@/lib/api'
import { generateId } from '@/lib/utils'
import type { ModelId, Conversation, Message } from '@/types/chat'

// Individual selectors to avoid re-creating callbacks on unrelated state changes
const useSetConversations  = () => useChatStore((s) => s.setConversations)
const useAddConversation   = () => useChatStore((s) => s.addConversation)
const useRemoveConversation = () => useChatStore((s) => s.removeConversation)
const useSetActiveId       = () => useChatStore((s) => s.setActiveConversationId)
const useSetMessages       = () => useChatStore((s) => s.setMessages)
const useAddMessage        = () => useChatStore((s) => s.addMessage)
const useRemoveMessage     = () => useChatStore((s) => s.removeMessage)
const useAppendToMessage   = () => useChatStore((s) => s.appendToMessage)
const useUpdateStatus      = () => useChatStore((s) => s.updateMessageStatus)
const useSetStreaming       = () => useChatStore((s) => s.setStreaming)
const useSetLoadingMessages = () => useChatStore((s) => s.setLoadingMessages)
const useUpdateLastMessage  = () => useChatStore((s) => s.updateConversationLastMessage)

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
      // Backend returns a plain array, not { conversations: [] }
      const list: Conversation[] = Array.isArray(res.data)
        ? res.data
        : ((res.data as { conversations?: Conversation[] }).conversations ?? [])
      setConversations(list)
    } catch {
      // Fail silently; user may have no conversations yet
    }
  }, [setConversations])

  const loadConversation = useCallback(
    async (conversationId: string) => {
      setActiveId(conversationId)
      setLoadingMessages(true)
      try {
        const res = await chatApi.getMessages(conversationId)
        // Backend returns ConversationRead with inline messages array
        const data = res.data as { messages?: Message[] } | Message[]
        const msgs: Message[] = Array.isArray(data)
          ? data
          : (data.messages ?? [])
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
        const conv = res.data as Conversation
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
        // Optimistic — remove regardless
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

      try {
        await streamChatMessage(
          { conversationId, content, model, stream: true },
          (delta) => { appendToMessage(aiMessageId, delta) },
          () => {
            updateStatus(aiMessageId, 'sent')
            setStreaming(false)
            updateLastMessage(conversationId, content)
          },
          (err) => {
            console.error('Streaming error:', err)
            updateStatus(aiMessageId, 'error')
            appendToMessage(aiMessageId, '\n\n_An error occurred. Please try again._')
            setStreaming(false)
          }
        )
      } catch (err) {
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
        (failedMsg.model ?? 'gpt-4o') as ModelId,
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
