'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare,
  Bot,
  Settings,
  Sparkles,
  Plus,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ConversationList } from '@/components/chat/ConversationList'
import { useAuth } from '@/hooks/useAuth'
import { useChat } from '@/hooks/useChat'
import { useUIStore } from '@/store/uiStore'
import { useChatStore } from '@/store/chatStore'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { id: 'chat',     href: '/chat',     icon: MessageSquare, label: 'Chat'     },
  { id: 'agents',   href: '/agents',   icon: Bot,           label: 'Agents'   },
  { id: 'settings', href: '/settings', icon: Settings,      label: 'Settings' },
] as const

export function Sidebar() {
  const pathname     = usePathname()
  const router       = useRouter()
  const { user, logout } = useAuth()
  const { createConversation, deleteConversation, loadConversations } = useChat()
  const sidebarOpen  = useUIStore((s) => s.sidebarOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const conversations  = useChatStore((s) => s.conversations)

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  async function handleNewChat() {
    const conv = await createConversation('gpt-4o')
    if (conv) router.push(`/chat/${conv.id}`)
  }

  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  const isExpanded = sidebarOpen

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={toggleSidebar}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        animate={{ width: isExpanded ? 240 : 64 }}
        transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
        className={cn(
          'fixed left-0 top-0 z-40 h-screen flex flex-col',
          'bg-[var(--surface)] border-r border-[var(--border)]',
          'overflow-hidden'
        )}
      >
        {/* Logo row */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--border)] shrink-0">
          <AnimatePresence mode="wait">
            {isExpanded ? (
              <motion.div
                key="expanded"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2.5 min-w-0"
              >
                <div className="w-8 h-8 rounded-lg prime-gradient flex items-center justify-center shadow-glow-sm shrink-0">
                  <Sparkles className="w-4 h-4 text-white" strokeWidth={2} />
                </div>
                <span className="text-base font-bold tracking-tight">Prime</span>
              </motion.div>
            ) : (
              <motion.div
                key="collapsed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-8 h-8 rounded-lg prime-gradient flex items-center justify-center shadow-glow-sm"
              >
                <Sparkles className="w-4 h-4 text-white" strokeWidth={2} />
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors shrink-0"
          >
            {isExpanded ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* New chat button */}
        <div className="px-3 py-3 shrink-0">
          {isExpanded ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={handleNewChat}
            >
              <Plus className="w-4 h-4 shrink-0" />
              New Chat
            </Button>
          ) : (
            <button
              onClick={handleNewChat}
              className="w-full p-2.5 flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
              title="New Chat"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="px-3 space-y-0.5 shrink-0">
          {NAV_ITEMS.map(({ id, href, icon: Icon, label }) => {
            const isActive =
              href === '/chat'
                ? pathname.startsWith('/chat')
                : pathname.startsWith(href)
            return (
              <Link
                key={id}
                href={href}
                title={!isExpanded ? label : undefined}
                className={cn(
                  'nav-item',
                  isActive && 'active',
                  !isExpanded && 'justify-center px-0 py-2.5'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <AnimatePresence>
                  {isExpanded && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden whitespace-nowrap"
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            )
          })}
        </nav>

        {/* Divider */}
        <div className="mx-3 my-3 border-t border-[var(--border)] shrink-0" />

        {/* Conversation history */}
        {isExpanded && (
          <div className="flex-1 overflow-y-auto px-3 min-h-0">
            <p className="px-1 mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
              Recent
            </p>
            <ConversationList
              conversations={conversations.slice(0, 20)}
              onDelete={deleteConversation}
              compact={false}
            />
          </div>
        )}

        {/* User footer */}
        <div className="border-t border-[var(--border)] p-3 shrink-0">
          {isExpanded ? (
            <div className="flex items-center gap-2.5">
              <Avatar
                src={user?.avatarUrl}
                name={user?.displayName ?? user?.username ?? 'User'}
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
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Avatar
                src={user?.avatarUrl}
                name={user?.displayName ?? user?.username ?? 'User'}
                size="sm"
                online
              />
              <button
                onClick={handleLogout}
                title="Sign out"
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </motion.aside>
    </>
  )
}
