'use client'

import { useEffect, useRef, useMemo } from 'react'
import { MessageBubble } from './MessageBubble'
import { useChatStore } from '@/store/chatStore'
import { useAuthStore } from '@/store/authStore'
import { useChat } from '@/hooks/useChat'

interface ChatWindowProps {
  conversationId: string
}

export function ChatWindow({ conversationId }: ChatWindowProps) {
  const allMessages = useChatStore((s) => s.messages)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const user        = useAuthStore((s) => s.user)
  const { retryMessage } = useChat()

  const bottomRef           = useRef<HTMLDivElement>(null)
  const containerRef        = useRef<HTMLDivElement>(null)
  const shouldAutoScrollRef = useRef(true)

  const messages = useMemo(
    () => allMessages.filter((m) => m.conversationId === conversationId),
    [allMessages, conversationId]
  )

  // Track whether user is scrolled near the bottom
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function onScroll() {
      const { scrollTop, scrollHeight, clientHeight } = el!
      shouldAutoScrollRef.current = scrollHeight - scrollTop - clientHeight < 150
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Auto-scroll when messages or streaming state changes
  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length, isStreaming])

  // Instant scroll on conversation switch
  useEffect(() => {
    shouldAutoScrollRef.current = true
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [conversationId])

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto pt-6 pb-2">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            userName={user?.displayName ?? user?.username}
            userAvatar={user?.avatarUrl}
            onRetry={message.status === 'error' ? retryMessage : undefined}
          />
        ))}
        <div ref={bottomRef} className="h-6" />
      </div>
    </div>
  )
}
