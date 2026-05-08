'use client'

import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Menu, Sparkles } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useChatStore } from '@/store/chatStore'
import { truncate } from '@/lib/utils'

const PAGE_TITLES: Record<string, string> = {
  '/chat':     'Chat',
  '/agents':   'AI Agents',
  '/settings': 'Settings',
}

export function TopBar() {
  const pathname     = usePathname()
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const sidebarOpen  = useUIStore((s) => s.sidebarOpen)
  const conversations = useChatStore((s) => s.conversations)
  const activeId      = useChatStore((s) => s.activeConversationId)

  // Determine current page title
  let title = 'Prime'
  for (const [key, val] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(key)) {
      title = val
      break
    }
  }

  // For active chat, show the conversation title
  if (pathname.startsWith('/chat/') && activeId) {
    const conv = conversations.find((c) => c.id === activeId)
    if (conv) title = truncate(conv.title, 48)
  }

  return (
    <header className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)] shrink-0 h-14">
      {/* Hamburger for mobile */}
      <button
        onClick={toggleSidebar}
        className="p-2 -ml-1 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors lg:hidden"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Title */}
      <motion.h1
        key={title}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="text-sm font-semibold text-[var(--text-primary)] truncate flex-1"
      >
        {title}
      </motion.h1>

      {/* Status indicator */}
      <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-slow" />
        <span className="hidden sm:inline">Online</span>
      </div>
    </header>
  )
}
