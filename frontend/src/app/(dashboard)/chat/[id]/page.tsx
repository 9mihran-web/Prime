'use client'

import { useEffect, useRef } from 'react'
import { use } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChatWindow } from '@/components/chat/ChatWindow'
import { ChatInput } from '@/components/chat/ChatInput'
import { useChat } from '@/hooks/useChat'
import { useChatStore } from '@/store/chatStore'
import { Spinner } from '@/components/ui/Spinner'
import type { ModelId } from '@/types/chat'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function ActiveChatPage({ params }: PageProps) {
  const { id }       = use(params)
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q')

  const { loadConversation, sendMessage, isLoadingMessages } = useChat()
  const selectedModel    = useChatStore((s) => s.selectedModel)
  const setSelectedModel = useChatStore((s) => s.setSelectedModel)
  const activeId         = useChatStore((s) => s.activeConversationId)

  const sentInitialRef = useRef(false)

  useEffect(() => {
    loadConversation(id)
  }, [id, loadConversation])

  // Fire the initial query from URL params (new chat flow)
  useEffect(() => {
    if (
      initialQuery &&
      !sentInitialRef.current &&
      activeId === id &&
      !isLoadingMessages
    ) {
      sentInitialRef.current = true
      sendMessage(initialQuery, selectedModel, id)
    }
  }, [initialQuery, activeId, id, isLoadingMessages, sendMessage, selectedModel])

  async function handleSend(content: string, model: ModelId) {
    await sendMessage(content, model, id)
  }

  if (isLoadingMessages) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="md" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <ChatWindow conversationId={id} />

      <div className="px-4 pb-5 max-w-3xl mx-auto w-full shrink-0">
        <ChatInput
          onSend={handleSend}
          model={selectedModel}
          onModelChange={setSelectedModel}
          placeholder="Continue the conversation…"
        />
      </div>
    </div>
  )
}
