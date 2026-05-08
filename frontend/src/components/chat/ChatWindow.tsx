'use client'

import { useEffect, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import { MessageBubble } from './MessageBubble'
import { TypingIndicator } from './TypingIndicator'
import { useChatStore } from '@/store/chatStore'
import { useAuthStore } from '@/store/authStore'
import { useChat } from '@/hooks/useChat'

interface ChatWindowProps {
  conversationId: string
}

export function ChatWindow({ conversationId }: ChatWindowProps) {
  const messages      = useChatStore((s) => s.messages)
  const isStreaming   = useChatStore((s) => s.isStreaming)
  const user          = useAuthStore((s) => s.user)
  const { retryMessage } = useChat()
  const bottomRef     = useRef<HTMLDivElement>(null)
  const containerRef  = useRef<HTMLDivElement>(null)
  const shouldAutoScrollRef = useRef(true)

  // Auto-scroll logic
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function onScroll() {
      const { scrollTop, scrollHeight, clientHeight } = container!
      shouldAutoScrollRef.current = scrollHeight - scrollTop - clientHeight < 120
    }

    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isStreaming])

  // On mount, scroll instantly
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [conversationId])

  const conversationMessages = messages.filter(
    (m) => m.conversationId === conversationId
  )

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto py-6 space-y-4"
    >
      {conversationMessages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          userName={user?.displayName ?? user?.username}
          userAvatar={user?.avatarUrl}
          onRetry={message.status === 'error' ? retryMessage : undefined}
        />
      ))}

      <AnimatePresence>
        {isStreaming && conversationMessages[conversationMessages.length - 1]?.role !== 'assistant' && (
          <TypingIndicator />
        )}
      </AnimatePresence>

      <div ref={bottomRef} className="h-4" />
    </div>
  )
}
