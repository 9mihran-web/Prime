'use client'

import { useRouter } from 'next/navigation'
import { Sparkles, Code2, Globe, FileText, CalendarDays } from 'lucide-react'
import { ChatInput } from '@/components/chat/ChatInput'
import { useChatStore } from '@/store/chatStore'
import { useChat } from '@/hooks/useChat'
import { useAuthStore } from '@/store/authStore'
import { QUICK_ACTIONS } from '@/types/chat'
import type { ModelId } from '@/types/chat'
import { cn } from '@/lib/utils'

const QUICK_ICONS: Record<string, React.ElementType> = {
  FileText,
  Code2,
  Globe,
  CalendarDays,
}

export default function ChatPage() {
  const router           = useRouter()
  const { createConversation } = useChat()
  const selectedModel    = useChatStore((s) => s.selectedModel)
  const setSelectedModel = useChatStore((s) => s.setSelectedModel)
  const user             = useAuthStore((s) => s.user)

  async function handleSend(content: string, model: ModelId) {
    const conv = await createConversation(model)
    if (conv) router.push(`/chat/${conv.id}?q=${encodeURIComponent(content)}`)
  }

  async function handleQuickAction(prompt: string) {
    const conv = await createConversation(selectedModel)
    if (conv) router.push(`/chat/${conv.id}?q=${encodeURIComponent(prompt)}`)
  }

  const firstName = (user?.displayName ?? user?.username ?? '').split(' ')[0]

  return (
    <div className="flex flex-col h-full">
      {/* Center content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-4 min-h-0">
        <div className="w-full max-w-2xl">
          {/* Prime icon + greeting */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-2xl prime-gradient flex items-center justify-center shadow-glow-md mx-auto mb-4">
              <Sparkles className="w-6 h-6 text-white" strokeWidth={2} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-1.5">
              {firstName ? `Hello, ${firstName}` : 'Hello'}
            </h1>
            <p className="text-[var(--text-muted)] text-sm sm:text-base">
              How can I help you today?
            </p>
          </div>

          {/* Quick action cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {QUICK_ACTIONS.map((action) => {
              const Icon = QUICK_ICONS[action.icon] ?? Sparkles
              return (
                <button
                  key={action.id}
                  onClick={() => handleQuickAction(action.prompt)}
                  className={cn(
                    'flex flex-col items-start gap-2 p-3.5 rounded-xl text-left',
                    'bg-[var(--surface)] border border-[var(--border)]',
                    'hover:bg-[var(--surface-2)] hover:border-[var(--border-strong)]',
                    'transition-all duration-200'
                  )}
                >
                  <Icon className="w-4 h-4 text-[var(--text-muted)]" />
                  <span className="text-xs font-medium text-[var(--text-secondary)] leading-snug">
                    {action.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Input pinned to bottom */}
      <div className="px-4 pb-5 max-w-2xl mx-auto w-full shrink-0">
        <ChatInput
          onSend={handleSend}
          model={selectedModel}
          onModelChange={setSelectedModel}
        />
        <p className="text-center text-[11px] text-[var(--text-muted)] mt-2.5">
          Prime can make mistakes. Double-check important information.
        </p>
      </div>
    </div>
  )
}
