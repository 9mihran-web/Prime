'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { FileText, Code2, Globe, CalendarDays, Sparkles } from 'lucide-react'
import { ChatInput } from '@/components/chat/ChatInput'
import { useChatStore } from '@/store/chatStore'
import { useChat } from '@/hooks/useChat'
import { QUICK_ACTIONS } from '@/types/chat'
import type { ModelId } from '@/types/chat'
import { cn } from '@/lib/utils'

const quickActionIcons: Record<string, React.ElementType> = {
  FileText,
  Code2,
  Globe,
  CalendarDays,
}

const containerVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.08 } },
}
const itemVariants = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] } },
}

export default function ChatPage() {
  const router = useRouter()
  const { createConversation } = useChat()
  const selectedModel = useChatStore((s) => s.selectedModel)
  const setSelectedModel = useChatStore((s) => s.setSelectedModel)

  async function handleSend(content: string, model: ModelId) {
    const conv = await createConversation(model)
    if (conv) {
      router.push(`/chat/${conv.id}?q=${encodeURIComponent(content)}`)
    }
  }

  async function handleQuickAction(prompt: string) {
    const conv = await createConversation(selectedModel)
    if (conv) {
      router.push(`/chat/${conv.id}?q=${encodeURIComponent(prompt)}`)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Empty state */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-4">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-2xl flex flex-col items-center"
        >
          {/* Icon */}
          <motion.div
            variants={itemVariants}
            className="w-16 h-16 rounded-2xl prime-gradient flex items-center justify-center shadow-glow-md mb-6"
          >
            <Sparkles className="w-8 h-8 text-white" strokeWidth={1.8} />
          </motion.div>

          {/* Heading */}
          <motion.h1
            variants={itemVariants}
            className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-3"
          >
            <span className="prime-gradient-text">How can I help you today?</span>
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-[var(--text-muted)] text-center mb-10 max-w-md"
          >
            Ask me anything, start a project, or explore what Prime can do.
          </motion.p>

          {/* Quick action chips */}
          <motion.div
            variants={itemVariants}
            className="flex flex-wrap gap-2.5 justify-center mb-8"
          >
            {QUICK_ACTIONS.map((action) => {
              const Icon = quickActionIcons[action.icon] ?? Sparkles
              return (
                <button
                  key={action.id}
                  onClick={() => handleQuickAction(action.prompt)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium',
                    'glass border border-[var(--border)] text-[var(--text-secondary)]',
                    'hover:border-prime-500/40 hover:text-[var(--text-primary)] hover:bg-prime-500/10',
                    'transition-all duration-200 cursor-pointer'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {action.label}
                </button>
              )
            })}
          </motion.div>
        </motion.div>
      </div>

      {/* Input area */}
      <div className="px-4 pb-6 max-w-3xl mx-auto w-full">
        <ChatInput
          onSend={handleSend}
          model={selectedModel}
          onModelChange={setSelectedModel}
          placeholder="Message Prime…"
        />
      </div>
    </div>
  )
}
