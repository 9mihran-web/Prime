'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Settings,
  Plus,
  LogOut,
  PanelLeft,
  Sparkles,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { ConversationList } from '@/components/chat/ConversationList'
import { useAuth } from '@/hooks/useAuth'
import { useChat } from '@/hooks/useChat'
import { useUIStore } from '@/store/uiStore'
import { useChatStore } from '@/store/chatStore'
import { cn } from '@/lib/utils'

export function Sidebar() {
  const pathname      = usePathname()
  const router        = useRouter()
  const { user, logout } = useAuth()
  const { createConversation, deleteConversation, loadConversations } = useChat()
  const sidebarOpen   = useUIStore((s) => s.sidebarOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const conversations = useChatStore((s) => s.conversations)
  const selectedModel = useChatStore((s) => s.selectedModel)

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  async function handleNewChat() {
    const conv = await createConversation(selectedModel)
    if (conv) router.push(`/chat/${conv.id}`)
  }

  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  // ── Collapsed sidebar ──────────────────────────────────────────────────────
  if (!sidebarOpen) {
    return (
      <aside className="fixed left-0 top-0 z-40 h-screen w-16 flex flex-col items-center py-3 gap-1 bg-[var(--background-2)] border-r border-[var(--border)]">
        <button
          onClick={toggleSidebar}
          title="Open sidebar"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] transition-colors"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        <button
          onClick={handleNewChat}
          title="New chat"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>

        <div className="flex-1" />

        <Link
          href="/settings"
          title="Settings"
          className={cn(
            'w-9 h-9 flex items-center justify-center rounded-lg transition-colors',
            pathname.startsWith('/settings')
              ? 'bg-prime-500/15 text-prime-400'
              : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]'
          )}
        >
          <Settings className="w-4 h-4" />
        </Link>

        <Avatar
          src={user?.avatarUrl}
          name={user?.displayName ?? user?.username ?? 'U'}
          size="sm"
        />
      </aside>
    )
  }

  // ── Expanded sidebar ───────────────────────────────────────────────────────
  return (
    <>
      {/* Mobile overlay */}
      <div
        className="fixed inset-0 z-30 bg-black/50 lg:hidden"
        onClick={toggleSidebar}
      />

      <aside className="fixed left-0 top-0 z-40 h-screen w-64 flex flex-col bg-[var(--background-2)] border-r border-[var(--border)]">
        {/* Header row */}
        <div className="flex items-center justify-between px-3 pt-3 pb-2 shrink-0">
          <div className="flex items-center gap-2 px-1">
            <div className="w-7 h-7 rounded-lg prime-gradient flex items-center justify-center shadow-glow-sm shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-white" strokeWidth={2} />
            </div>
            <span className="text-sm font-bold tracking-tight">Prime</span>
          </div>

          <button
            onClick={toggleSidebar}
            title="Collapse sidebar"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] transition-colors"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        </div>

        {/* New Chat button */}
        <div className="px-3 pb-2 shrink-0">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] transition-colors border border-[var(--border)] hover:border-[var(--border-strong)]"
          >
            <Plus className="w-4 h-4 shrink-0" />
            New chat
          </button>
        </div>

        {/* Conversation history */}
        <div className="flex-1 overflow-y-auto px-2 min-h-0">
          <ConversationList
            conversations={conversations}
            onDelete={deleteConversation}
          />
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--border)] p-2 shrink-0 space-y-0.5">
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              pathname.startsWith('/settings')
                ? 'bg-prime-500/15 text-prime-400'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]'
            )}
          >
            <Settings className="w-4 h-4 shrink-0" />
            Settings
          </Link>

          <div className="flex items-center gap-2.5 px-3 py-2">
            <Avatar
              src={user?.avatarUrl}
              name={user?.displayName ?? user?.username ?? 'U'}
              size="sm"
              online
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate text-[var(--text-primary)]">
                {user?.displayName ?? user?.username}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] truncate">
                {user?.email}
              </p>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
